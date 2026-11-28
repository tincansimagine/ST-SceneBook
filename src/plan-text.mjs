// Line-based illustration plan: one "key: value" field per line, each scene
// opened by a line reading "scene". It costs fewer reply tokens than JSON and
// has no brackets or escapes for a model to get wrong.
const SCENE_KEYS={camera:'camera',view:'camera',prompt:'prompt',negative:'negative',uc:'negative',quote:'evidence',evidence:'evidence',title:'ignored',layout:'layout',grid:'grid',size:'size',ratio:'size',after:'after',paragraph:'after'};
const CHARACTER_KEYS={action:'action',outfit:'outfit',appearance:'appearance',profile:'profileId',profileid:'profileId'};
// Models dress the keys up despite the layout: "- **prompt:** ...", "1. camera: ...",
// "char 2: ...". The key is read through bullets, numbering and bold marks.
const header=/^[\s#\[\-=*]*scene\s*\d*[\s\]:\-=*]*$/i,field=/^\s*(?:[-*•]\s*|\d+[.)]\s*)?\*{0,2}([A-Za-z]+)(?:[ \t]*\d+)?\*{0,2}[ \t]*[:=]\s*(.*)$/;
const clean=value=>{const v=value.trim().replace(/^\*{1,2}\s*/,'').replace(/\s*\*{1,2}$/,'');return v.length>1&&v.startsWith('"')&&v.endsWith('"')?v.slice(1,-1).trim():v;};
const KEYS=new Set([...Object.keys(SCENE_KEYS),...Object.keys(CHARACTER_KEYS),'char','character','name','pos','position','xy','panel','height']);
// True when the body opens like a line plan: a scene heading or a known key.
export function looksLikeLinePlan(input){
    const first=String(input??'').split('\n').find(line=>line.trim()&&!/^\s*(`{3,}|~{3,})/.test(line));
    if(!first)return false;
    if(header.test(first))return true;
    const key=first.match(field)?.[1].toLowerCase();
    return !!key&&KEYS.has(key)&&!/^\s*[{\["]/.test(first);
}
export function parsePlanText(input){
    if(typeof input!=='string'||input.length>60000)throw new Error('삽화 지시의 길이가 너무 큽니다.');
    const scenes=[],repairs=[];let scene=null,character=null,last=null,panel=null;
    const open=()=>{scene={characters:[]};character=null;last=null;panel=null;scenes.push(scene);};
    for(const line of input.replace(/\r\n?/g,'\n').split('\n')){
        if(!line.trim()||/^\s*(`{3,}|~{3,})/.test(line))continue;
        if(header.test(line)){open();continue;}
        const match=line.match(field),key=match?.[1].toLowerCase();
        // A page: each panel line, then the characters visible in that panel.
        if(match&&key==='panel'){
            if(!scene)open();
            panel={text:clean(match[2]),characters:[]};(scene.panels??=[]).push(panel);character=null;last=[panel,'text'];continue;
        }
        // A webtoon panel's height belongs to the panel, wherever it is written inside it.
        if(match&&panel&&key==='height'){panel.height=clean(match[2]).toLowerCase();last=null;continue;}
        if(match&&['char','character','name'].includes(key)){
            if(!scene)open();
            character={name:clean(match[2])};(panel?panel.characters:scene.characters).push(character);last=null;continue;
        }
        if(match&&character&&['pos','position','xy'].includes(key)){
            const [x,y]=(match[2].match(/-?\d*\.?\d+/g)??[]).map(Number);
            if(Number.isFinite(x)&&Number.isFinite(y)){character.x=Math.max(0,Math.min(1,x));character.y=Math.max(0,Math.min(1,y));}
            last=null;continue;
        }
        if(match&&character&&Object.hasOwn(CHARACTER_KEYS,key)){last=[character,CHARACTER_KEYS[key]];character[last[1]]=clean(match[2]);continue;}
        if(match&&Object.hasOwn(SCENE_KEYS,key)){
            const name=SCENE_KEYS[key];
            // A title line is read and dropped: pictures have no titles.
            if(name==='ignored'){last=null;continue;}
            // A repeated shared field means the model forgot the "scene" line.
            if(!scene||(['camera','prompt'].includes(name)&&(scene[name]!==undefined&&(scene.characters.length||scene.panels?.length)))){if(scene)repairs.push('장면 구분 복구');open();}
            character=null;last=[scene,name];scene[name]=clean(match[2]);continue;
        }
        // An unlabelled line continues the previous value.
        if(last)last[0][last[1]]=`${last[0][last[1]]} ${line.trim()}`.trim();
    }
    const usable=scenes.filter(s=>s.prompt||s.camera||s.characters.length||s.panels?.length);
    if(!usable.length)throw new Error('삽화 지시에서 장면을 찾지 못했습니다.');
    return{value:{scenes:usable},repairs:[...new Set(repairs)]};
}
