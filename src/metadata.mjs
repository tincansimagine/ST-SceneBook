import { MODELS, SAMPLERS, validateConfig, normalizeScene } from '../plugin/core.mjs';

const MAX_FILE=32*1024*1024,MAX_TEXT=8*1024*1024,MAX_PIXELS=16*1024*1024;
const utf8=new TextDecoder('utf-8',{fatal:true}),latin=new TextDecoder('iso-8859-1');
const decodeText=bytes=>{try{return utf8.decode(bytes);}catch{return latin.decode(bytes);}};
const signature=[137,80,78,71,13,10,26,10];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
async function inflate(bytes,format){
    if(bytes.length>MAX_TEXT)throw new Error('메타데이터가 너무 큽니다.');
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
    const chunks=[];let length=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_TEXT)throw new Error('압축 해제된 메타데이터가 너무 큽니다.');chunks.push(value);}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const out=new Uint8Array(length);let p=0;for(const c of chunks){out.set(c,p);p+=c.length;}return out;
}
function zero(bytes,start){const p=bytes.indexOf(0,start);if(p<0)throw new Error('PNG 텍스트 정보가 손상되었습니다.');return p;}
export async function pngText(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<33||bytes.length>MAX_FILE||signature.some((b,i)=>bytes[i]!==b))throw new Error('NovelAI에서 저장한 원본 PNG를 선택하세요.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),fields=Object.create(null);let p=8,width=0,height=0,ended=false,total=0;
    while(p+12<=bytes.length){
        const length=view.getUint32(p),kind=latin.decode(bytes.subarray(p+4,p+8));
        if(length>MAX_FILE||p+12+length>bytes.length)throw new Error('PNG 파일이 중간에 잘렸습니다.');
        const data=bytes.subarray(p+8,p+8+length);
        if(p===8&&kind!=='IHDR')throw new Error('PNG 헤더가 없습니다.');
        if(kind==='IHDR'){if(length!==13||width)throw new Error('PNG 헤더가 올바르지 않습니다.');width=view.getUint32(p+8);height=view.getUint32(p+12);if(!width||!height||width*height>MAX_PIXELS)throw new Error('이미지는 최대 1,600만 픽셀까지 읽을 수 있습니다.');}
        if(['tEXt','iTXt','zTXt'].includes(kind)){
            if(crc32(bytes.subarray(p+4,p+8+length))!==view.getUint32(p+8+length))throw new Error('PNG 메타데이터의 오류 검사가 실패했습니다.');
            const separator=zero(data,0),key=latin.decode(data.subarray(0,separator));if(!key||separator>79)throw new Error('PNG 텍스트 키가 올바르지 않습니다.');
            let text;
            if(kind==='tEXt')text=decodeText(data.subarray(separator+1));
            if(kind==='zTXt'){if(data[separator+1]!==0)throw new Error('지원하지 않는 PNG 압축입니다.');text=decodeText(await inflate(data.subarray(separator+2),'deflate'));}
            if(kind==='iTXt'){
                const compressed=data[separator+1],method=data[separator+2];if(![0,1].includes(compressed)||method!==0)throw new Error('PNG 국제 텍스트 형식이 올바르지 않습니다.');
                const language=zero(data,separator+3),translated=zero(data,language+1),raw=data.subarray(translated+1);
                text=utf8.decode(compressed?await inflate(raw,'deflate'):raw);
            }
            total+=text.length;if(total>MAX_TEXT)throw new Error('메타데이터가 너무 큽니다.');
            if(['Comment','Description','Source','Software','Title'].includes(key))fields[key]=text;
        }
        p+=length+12;if(kind==='IEND'){if(length)throw new Error('PNG 종료 구간이 올바르지 않습니다.');ended=true;break;}
    }
    if(!ended)throw new Error('PNG 파일이 완전하지 않습니다.');return{fields,width,height};
}
export async function stealthMetadata({data,width,height}){
    const pixels=width*height;if(!Number.isSafeInteger(pixels)||pixels>MAX_PIXELS||data.length!==pixels*4)throw new Error('이미지 픽셀 정보를 확인하세요.');
    const magic='stealth_pngcomp';if(pixels<(magic.length+4)*8)return null;
    let cursor=0;
    const byte=()=>{let value=0;for(let bit=0;bit<8;bit++){if(cursor>=pixels)throw new Error('숨은 메타데이터가 중간에 잘렸습니다.');const x=Math.floor(cursor/height),y=cursor%height;value=(value<<1)|(data[(y*width+x)*4+3]&1);cursor++;}return value;};
    let found='';for(let i=0;i<magic.length;i++)found+=String.fromCharCode(byte());
    if(found!==magic&&found!=='stealth_pnginfo')return null;
    const bits=byte()*16777216+byte()*65536+byte()*256+byte();
    if(!bits||bits%8||bits>pixels-cursor||bits/8>MAX_TEXT)throw new Error('숨은 메타데이터 길이가 올바르지 않습니다.');
    const packed=Uint8Array.from({length:bits/8},byte),payload=found===magic?await inflate(packed,'gzip'):packed;
    const parsed=JSON.parse(utf8.decode(payload));if(!object(parsed))throw new Error('숨은 메타데이터 형식이 올바르지 않습니다.');return parsed;
}

// Source labels are identifiers published by the official NovelAI client. An
// unknown label stays unknown; it must not silently select a different model.
export function metadataModel(source,explicit){
    if(typeof explicit==='string'&&Object.hasOwn(MODELS,explicit))return explicit;
    if(typeof source!=='string')return null;
    if(Object.hasOwn(MODELS,source))return source;
    const v5=/NovelAI Diffusion V5\b/i.test(source),v45=/NovelAI Diffusion V4\.5\b|DiffusionModelMetaName\.NAIv4next/i.test(source);
    if(v5&&(/\bFull\b/i.test(source)||/\b(?:657484A5|0ADF9AB7)\b/i.test(source)))return'nai-diffusion-5-full';
    if(v5&&/\bCurated\b/i.test(source))return'nai-diffusion-5-curated';
    if(v45&&(/\bFull\b/i.test(source)||/\b(?:4BDE2A90|1229B44F|B9F340FD|F3D95188)\b/i.test(source)))return'nai-diffusion-4-5-full';
    if((v45&&/\bCurated\b/i.test(source))||((v45||/NovelAI Diffusion V4\b/.test(source))&&/\b(?:C02D4F98|5AB81C7C|B5A2A797)\b/i.test(source)))return'nai-diffusion-4-5-curated';
    return null;
}
export function normalizeMetadata(fields,dimensions={}){
    if(!object(fields))throw new Error('메타데이터 객체가 필요합니다.');
    let p=fields.Comment??{};if(typeof p==='string'){if(p.length>MAX_TEXT)throw new Error('메타데이터가 너무 큽니다.');try{p=JSON.parse(p);}catch{throw new Error('이미지의 생성 설정 JSON이 손상되었습니다.');}}
    if(!object(p))throw new Error('이미지의 생성 설정을 해석할 수 없습니다.');
    const positive=p.v4_prompt?.caption,negative=p.v4_negative_prompt?.caption;
    const prompt=positive?.base_caption??p.prompt??fields.Description;
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>12000)throw new Error('NovelAI 생성 프롬프트를 찾을 수 없습니다.');
    const patch={},warnings=[],unsupported=[];
    const model=metadataModel(fields.Source,p.model);if(model)patch.model=model;else warnings.push('모델을 확정할 수 없습니다. 적용할 모델을 직접 선택하세요.');
    // Image seeds are provenance, not settings to import. Some writers store
    // larger seeds or strings; neither should prevent importing the prompt.
    const numeric=[['width','width',64,2048,true],['height','height',64,2048,true],['steps','steps',1,50,true],['scale','scale',0,10,false],['cfg_rescale','cfgRescale',0,1,false]];
    for(const [from,to,min,max,integer]of numeric){const value=p[from]??(['width','height'].includes(from)?dimensions[from]:undefined);if(value===undefined)continue;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`${from}: 지원 범위를 벗어난 이미지 설정입니다.`);patch[to]=value;}
    if(p.sampler!==undefined){if(!SAMPLERS.includes(p.sampler))warnings.push(`지원하지 않는 샘플러: ${String(p.sampler).slice(0,100)}. 현재 샘플러를 유지합니다.`);else patch.sampler=p.sampler;}
    if(p.noise_schedule!==undefined){if(!['karras','native','exponential','polyexponential'].includes(p.noise_schedule))warnings.push('지원하지 않는 스케줄러는 적용하지 않습니다.');else patch.scheduler=p.noise_schedule;}
    if(p.straight_alpha!==undefined){if(typeof p.straight_alpha!=='boolean')throw new Error('투명 배경 값이 올바르지 않습니다.');patch.transparent=p.straight_alpha;}
    // Character prompts, their negatives and coordinates are deliberately ignored.
    const scene={title:typeof fields.Title==='string'?fields.Title.slice(0,150):'가져온 장면',prompt,camera:'',negative:negative?.base_caption??p.uc??p.negative_prompt??'',after:1,evidence:'',characters:[]};
    normalizeScene(scene,model??'nai-diffusion-5-full');
    const flags={sm:'SMEA',sm_dyn:'SMEA DYN',dynamic_thresholding:'동적 Guidance',legacy:'Legacy',legacy_v3_extend:'Legacy prompt',deliberate_euler_ancestral_bug:'구형 Euler 동작'};
    for(const [key,label]of Object.entries(flags))if(p[key])unsupported.push(label);
    if(p.uncond_scale!==undefined&&p.uncond_scale!==1)unsupported.push('Undesired Content strength');
    if(p.prefer_brownian===false)unsupported.push('Brownian noise 비활성');
    if(p.skip_cfg_above_sigma||p.skip_cfg_below_sigma)unsupported.push('Guidance skip');
    if(p.strength||p.noise||p.image||/img2img|inpaint|infilling/i.test(p.request_type??''))unsupported.push('Img2Img / Inpaint 원본');
    if(['reference_image_multiple','reference_strength_multiple','director_reference_images','director_reference_strength_values'].some(k=>Array.isArray(p[k])&&p[k].length))unsupported.push('Vibe / Precise 참조');
    if(unsupported.length)warnings.push(`가져오지 않는 항목: ${unsupported.join(', ')}. 이 항목을 사용한 원본과 결과가 달라질 수 있습니다.`);
    if(!model?.startsWith('nai-diffusion-5-')&&!patch.scheduler)warnings.push('스케줄러 정보가 없어 현재 값을 사용합니다.');
    return{patch,scene,source:String(fields.Source??p.model??'모델 정보 없음').slice(0,300),warnings};
}
export function importedConfig(current,result,{model=result.patch.model,relaxBudget=false,forScene=true}={}){
    if(!model||!Object.hasOwn(MODELS,model))throw new Error('적용할 이미지 모델을 선택하세요.');
    const patch=Object.fromEntries(['width','height','steps','scale','sampler','scheduler','cfgRescale','transparent'].filter(key=>Object.hasOwn(result.patch,key)).map(key=>[key,result.patch[key]]));patch.model=model;
    const next={...current,...patch,budgetGuard:relaxBudget?false:current.budgetGuard};
    if(model.startsWith('nai-diffusion-5-')&&!patch.scheduler)next.scheduler='karras';
    if(!model.startsWith('nai-diffusion-5-')&&patch.transparent===undefined)next.transparent=false;
    // Expanded prompts already contain their quality tags. Keep them once.
    if(forScene)Object.assign(next,{style:'',negative:'',quality:false,references:[],transparent:patch.transparent??false});
    else {
        Object.assign(next,{style:result.scene.prompt,negative:result.scene.negative,quality:false});
        if(!MODELS[model].references&&current.references?.length)throw new Error('현재 참조 적용을 해제한 뒤 V5 설정을 가져오세요.');
    }
    validateConfig(next);return next;
}
export async function readNovelAiImage(file){
    if(!file||file.size>MAX_FILE)throw new Error('32MB 이하 원본 PNG를 선택하세요.');
    const bytes=new Uint8Array(await file.arrayBuffer()),png=await pngText(bytes);
    let regularError;
    if(png.fields.Comment||png.fields.Description){try{return{...normalizeMetadata(png.fields,png),storage:'PNG 텍스트'};}catch(e){regularError=e;}}
    const bitmap=await createImageBitmap(file);
    try{
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('이미지 정보를 읽을 수 없는 브라우저입니다.');
        context.drawImage(bitmap,0,0);const hidden=await stealthMetadata(context.getImageData(0,0,bitmap.width,bitmap.height));canvas.width=canvas.height=1;
        if(hidden)return{...normalizeMetadata(hidden,png),storage:'알파 채널'};
    }finally{bitmap.close();}
    if(regularError)throw regularError;
    throw new Error('생성 정보가 없습니다. 스크린샷이나 변환본 대신 NovelAI에서 다운로드한 원본 PNG를 사용하세요.');
}
