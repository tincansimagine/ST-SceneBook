// Line-based illustration plan: one "key: value" field per line, each scene
// opened by a line reading "scene". It costs fewer reply tokens than JSON and
// has no brackets or escapes for a model to get wrong.
const SCENE_KEYS={camera:'camera',view:'camera',prompt:'prompt',negative:'negative',uc:'negative',quote:'evidence',evidence:'evidence',title:'title'};
const CHARACTER_KEYS={action:'action',outfit:'outfit',appearance:'appearance',profile:'profileId',profileid:'profileId'};
const header=/^[\s#\[\-=*]*scene\s*\d*[\s\]:\-=*]*$/i,field=/^\s*(?:[-*]\s*)?([A-Za-z]+)\s*[:=]\s*(.*)$/;
const clean=value=>{const v=value.trim();return v.length>1&&v.startsWith('"')&&v.endsWith('"')?v.slice(1,-1).trim():v;};
export function parsePlanText(input){
    if(typeof input!=='string'||input.length>60000)throw new Error('삽화 지시의 길이가 너무 큽니다.');
    const scenes=[],repairs=[];let scene=null,character=null,last=null;
    const open=()=>{scene={characters:[]};character=null;last=null;scenes.push(scene);};
    for(const line of input.replace(/\r\n?/g,'\n').split('\n')){
        if(!line.trim()||/^\s*(`{3,}|~{3,})/.test(line))continue;
        if(header.test(line)){open();continue;}
        const match=line.match(field),key=match?.[1].toLowerCase();
        if(match&&['char','character','name'].includes(key)){
            if(!scene)open();
            character={name:clean(match[2])};scene.characters.push(character);last=null;continue;
        }
        if(match&&character&&['pos','position','xy'].includes(key)){
            const [x,y]=(match[2].match(/-?\d*\.?\d+/g)??[]).map(Number);
            if(Number.isFinite(x)&&Number.isFinite(y)){character.x=Math.max(0,Math.min(1,x));character.y=Math.max(0,Math.min(1,y));}
            last=null;continue;
        }
        if(match&&character&&Object.hasOwn(CHARACTER_KEYS,key)){last=[character,CHARACTER_KEYS[key]];character[last[1]]=clean(match[2]);continue;}
        if(match&&Object.hasOwn(SCENE_KEYS,key)){
            const name=SCENE_KEYS[key];
            // A repeated shared field means the model forgot the "scene" line.
            if(!scene||(['camera','prompt'].includes(name)&&(scene[name]!==undefined&&scene.characters.length))){if(scene)repairs.push('장면 구분 복구');open();}
            character=null;last=[scene,name];scene[name]=clean(match[2]);continue;
        }
        // An unlabelled line continues the previous value.
        if(last)last[0][last[1]]=`${last[0][last[1]]} ${line.trim()}`.trim();
    }
    const usable=scenes.filter(s=>s.prompt||s.camera||s.characters.length);
    if(!usable.length)throw new Error('삽화 지시에서 장면을 찾지 못했습니다.');
    return{value:{scenes:usable},repairs:[...new Set(repairs)]};
}
