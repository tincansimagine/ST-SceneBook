import { mkdir,readFile,writeFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validatePng(data) {
    if(typeof data!=='string'||data.length>9000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw new Error('PNG 이미지 형식을 확인하세요.');
    const buffer=Buffer.from(data,'base64');
    if(buffer.length<24||buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('PNG 파일이 아닙니다.');
    const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
    if(width<1||height<1||width*height>2200000)throw new Error('레퍼런스 이미지는 220만 픽셀 이하여야 합니다.');
    return {buffer,width,height};
}
async function locations(dirs){const meta=path.join(dirs.root,'autopic2-references'),images=path.join(dirs.images,'autopic2');await Promise.all([mkdir(meta,{recursive:true}),mkdir(images,{recursive:true})]);return{meta,images};}
export async function saveReference(dirs,input){
    const {buffer,width,height}=validatePng(input?.image);const label=String(input?.label??'레퍼런스').slice(0,100),id=randomUUID();
    const loc=await locations(dirs);const record={id,label,width,height,url:`/user/images/autopic2/${id}.png`};
    await writeFile(path.join(loc.images,id+'.png'),buffer);await writeFile(path.join(loc.meta,id+'.json'),JSON.stringify(record));return record;
}
export async function listReferences(dirs){const {meta}=await locations(dirs);const files=(await readdir(meta)).filter(f=>f.endsWith('.json')&&idPattern.test(f.slice(0,-5)));return Promise.all(files.map(async f=>JSON.parse(await readFile(path.join(meta,f),'utf8'))));}
export async function applyReferences(payload,config,dirs,key,fetchImpl,signal){
    const loc=await locations(dirs);
    for(const ref of config.references??[]){
        if(!idPattern.test(ref.id))throw new Error('잘못된 레퍼런스 ID입니다.');
        const metadata=JSON.parse(await readFile(path.join(loc.meta,ref.id+'.json'),'utf8'));
        const image=(await readFile(path.join(loc.images,ref.id+'.png'))).toString('base64');
        if(ref.kind==='precise'){
            if(![[1024,1536],[1536,1024],[1472,1472]].some(([w,h])=>w===metadata.width&&h===metadata.height))throw new Error('Precise Reference를 허용된 캔버스 크기로 다시 등록하세요.');
            Object.assign(payload.parameters,{
                director_reference_images:[image],
                director_reference_descriptions:[{caption:{base_caption:ref.mode,char_captions:[]},use_coords:false,use_order:false,legacy_uc:false}],
                director_reference_strength_values:[ref.strength],director_reference_secondary_strength_values:[1-ref.fidelity],director_reference_information_extracted:[1],
            });
        }else{
            const digest=createHash('sha256').update(`${config.model}:${ref.id}:${ref.information}`).digest('hex');const cache=path.join(loc.meta,digest+'.vibe');let encoded;
            try{encoded=await readFile(cache,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
            if(!encoded){
                const result=await fetchImpl('https://image.novelai.net/ai/encode-vibe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({image,model:config.model,informationExtracted:ref.information}),signal});
                if(!result.ok)throw new Error(`Vibe 인코딩 실패 (${result.status}). 레퍼런스를 누락한 채 생성하지 않았습니다.`);
                const data=await result.arrayBuffer();if(data.byteLength>16000000)throw new Error('Vibe 응답이 너무 큽니다.');encoded=Buffer.from(data).toString('base64');await writeFile(cache,encoded,{mode:0o600});
            }
            (payload.parameters.reference_image_multiple??=[]).push(encoded);
            (payload.parameters.reference_information_extracted_multiple??=[]).push(ref.information);
            (payload.parameters.reference_strength_multiple??=[]).push(ref.strength);
        }
    }
}
