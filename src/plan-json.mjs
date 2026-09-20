import { jsonrepair } from './vendor/jsonrepair/regular/jsonrepair.js';

export const JSON_OUTPUT_RULES = `Serialization check before sending: return one JSON object with a scenes array. Always use arrays for scenes and characters, including when there is only one entry. Quote keys and text with ASCII double quotes; escape double quotes, backslashes and newlines inside text. Put commas between fields and array entries, never after the final item. Coordinates and paragraph indices are numbers, not quoted text. Do not put explanations, comments, ellipses or Markdown inside JSON. Close every character object, characters array, scene object, scenes array and root object. Preserve weight syntax inside strings. Shorten optional descriptions or choose fewer scenes if needed to finish the entire structure; never cut a field or leave an unfinished scene.`;

const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const strings=/"(?:\\.|[^"\\])*"/g;

// Mask already-valid JSON strings before tolerant parsing. This protects locked
// appearance, weights, escapes and literal HTML entities from reinterpretation.
function protectedRepair(source) {
    let prefix='__scenebook_json_literal_';while(source.includes(prefix))prefix+='_';
    const literals=new Map();
    const masked=source.replace(strings,(token,offset)=>{
        let before=offset-1,after=offset+token.length;
        while(before>=0&&/\s/.test(source[before]))before--;
        while(after<source.length&&/\s/.test(source[after]))after++;
        // Do not mask fragments of an unescaped quoted phrase. Leave those for
        // the repair parser to disambiguate as a whole string.
        if(before>=0&&!'{[:,'.includes(source[before]))return token;
        if(after<source.length&&!'}],:'.includes(source[after])&&!/^"(?:\\.|[^"\\])*"\s*:/.test(source.slice(after)))return token;
        try{JSON.parse(token);}catch{return token;}
        const id=prefix+literals.size;literals.set(id,token);return JSON.stringify(id);
    });
    const repaired=jsonrepair(masked);
    return repaired.replace(strings,token=>{
        const value=JSON.parse(token);
        if(literals.has(value))return literals.get(value);
        if(value.includes(prefix))throw new Error('문자열 경계를 확정할 수 없어 프롬프트 복구를 중단했습니다.');
        return token;
    });
}

// Only known container/type mistakes are normalized. Values outside the schema
// still pass through normal scene, identity, coordinate and anchor validation.
function sceneShape(value,repairs) {
    if(Array.isArray(value)){value={scenes:value};repairs.push('장면 목록 포장 복구');}
    if(object(value)&&!Object.hasOwn(value,'scenes')&&typeof value.prompt==='string'&&(typeof value.evidence==='string'||value.after!==undefined)){
        value={scenes:[value]};repairs.push('단일 장면 목록 복구');
    }
    if(!object(value))throw new Error('삽화 지시의 JSON 객체를 찾지 못했습니다.');
    if(object(value.scenes)){value={...value,scenes:[value.scenes]};repairs.push('장면 배열 복구');}
    if(!Array.isArray(value.scenes))throw new Error('삽화 지시에 scenes 목록이 없습니다.');
    const numeric=(holder,key)=>{
        if(typeof holder[key]==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(holder[key].trim())){
            const number=Number(holder[key]);if(Number.isFinite(number)){holder[key]=number;repairs.push('숫자 필드 형식 복구');}
        }
    };
    const tags=(holder,keys)=>{
        for(const key of keys)if(Array.isArray(holder[key])&&holder[key].every(value=>typeof value==='string')){
            holder[key]=holder[key].join(', ');repairs.push('프롬프트 태그 목록 형식 복구');
        }
    };
    return{...value,scenes:value.scenes.map(raw=>{
        if(!object(raw))return raw;
        const scene={...raw};numeric(scene,'after');tags(scene,['prompt','camera','negative']);
        if(object(scene.characters)&&['name','id','prompt','appearance','action'].some(key=>Object.hasOwn(scene.characters,key))){scene.characters=[scene.characters];repairs.push('인물 배열 복구');}
        if(Array.isArray(scene.characters))scene.characters=scene.characters.map(rawCharacter=>{
            if(!object(rawCharacter))return rawCharacter;
            const character={...rawCharacter};numeric(character,'x');numeric(character,'y');tags(character,['prompt','appearance','outfit','action','negative']);return character;
        });
        return scene;
    })};
}

export function parsePlanJson(input) {
    if(typeof input!=='string'||input.length>60000)throw new Error('삽화 지시의 길이가 너무 큽니다.');
    let source=input.trim();const repairs=[];
    const fence=source.match(/^(`{3,}|~{3,})(?:json)?\s*\n([\s\S]*?)\n\1\s*$/i);
    if(fence){source=fence[2];repairs.push('코드 블록 포장 제거');}
    let value;
    for(let layer=0;layer<2;layer++){
        try{value=JSON.parse(source);}catch{
            // Restrict recovery to structured data. No prose search, execution
            // of wrappers, or inference of missing scene content is involved.
            if(!/^[{[\\"'“‘&]/.test(source.trimStart()))throw new Error('삽화 JSON의 시작을 찾지 못했습니다.');
            value=JSON.parse(protectedRepair(source));repairs.push('JSON 구두점·이스케이프 복구');
        }
        if(typeof value!=='string')break;
        source=value.trim();repairs.push('중첩 JSON 문자열 포장 제거');
    }
    value=sceneShape(value,repairs);
    return{value,repairs:[...new Set(repairs)]};
}
