import { MODELS } from '../plugin/core.mjs';

// The prompt NovelAI receives for an ordinary scene, put together here rather than
// on the server so its order can be chosen: the subject count first (NovelAI reads
// the opening of a prompt most closely), then the art style, the camera, the scene
// and the quality tags. Tags already given by the style or the camera are not
// repeated, and a viewpoint tag in the scene that contradicts the camera is dropped.
const COUNT=/^(?:\d+\s*(?:girls?|boys?|others?)|no humans|multiple (?:girls|boys|others))$/i;
const VIEWS=['from side','three quarter view','from above','from below','from behind','straight-on','pov'];
// NovelAI knows the view as "three quarter view"; earlier rules taught the hyphenated spelling.
const spelled=value=>String(value??'').replace(/\bthree-quarter view\b/gi,'three quarter view');
// Commas inside braces, brackets, parentheses or a weight span (1.2::a, b::) do not split.
export function splitTags(value){
    const text=String(value??''),parts=[];let depth=0,weight=false,start=0;
    for(let i=0;i<text.length;i++){
        if(text.startsWith('::',i)){weight=!weight;i++;continue;}
        const ch=text[i];
        if('{[('.includes(ch))depth++;else if('}])'.includes(ch))depth=Math.max(0,depth-1);
        else if(ch===','&&!depth&&!weight){parts.push(text.slice(start,i));start=i+1;}
    }
    parts.push(text.slice(start));
    return parts.map(part=>part.trim()).filter(Boolean);
}
// A tag the art style or main prompt asks for and the UC refuses pulls both ways;
// the style wins. It happens when a UC preset meets a look (film grain, screentones,
// monochrome). Plural and singular count as the same tag; weights are read through.
const plainTag=tag=>String(tag).toLowerCase().replace(/^\s*[\d.]+::\s*|\s*::\s*$/g,'').replace(/^[\s{[(]+|[\s}\])]+$/g,'').trim();
const singular=tag=>tag.length>4?tag.replace(/s$/,''):tag;
export function withoutConflicts(negative,style){
    const asked=new Set(splitTags(style).filter(tag=>!/^\s*-/.test(tag)).map(tag=>singular(plainTag(tag))).filter(Boolean));
    if(!asked.size)return String(negative??'');
    return splitTags(negative).filter(tag=>!asked.has(singular(plainTag(tag)))).join(', ');
}
// NovelAI places character prompts in their listed order, top to bottom and left to
// right, and does best when the positions agree with that order (its multi-character
// guide). A plan's characters are put in that order when every one has a position.
export function readingOrder(characters){
    if(!Array.isArray(characters)||characters.length<2||!characters.every(c=>Number.isFinite(c?.x)&&Number.isFinite(c?.y)))return characters;
    const row=c=>Math.round((Math.min(.9,Math.max(.1,c.y))-.1)/.2);
    return characters.map((c,i)=>({c,i})).sort((a,b)=>row(a.c)-row(b.c)||a.c.x-b.c.x||a.i-b.i).map(x=>x.c);
}
export function compileScene(scene,config){
    if(!scene||scene.finalPrompt||scene.page)return scene;
    const camera=spelled(scene.camera).trim(),style=String(config.style??'').trim();
    const given=new Set([...splitTags(style),...splitTags(camera)].map(tag=>tag.toLowerCase()));
    const view=VIEWS.find(name=>splitTags(camera).some(tag=>tag.toLowerCase()===name));
    const counts=[],rest=[],seen=new Set();
    for(const tag of splitTags(spelled(scene.prompt))){
        const key=tag.toLowerCase();
        if(seen.has(key))continue;seen.add(key);
        if(COUNT.test(key)){counts.push(tag);continue;}
        if(given.has(key))continue;
        if(view&&VIEWS.includes(key)&&key!==view)continue;
        rest.push(tag);
    }
    const quality=config.quality?MODELS[config.model]?.quality??'':'';
    const prompt=[counts.join(', '),style,camera,rest.join(', '),quality,config.transparent?'transparent background, has alpha':''].filter(Boolean).join(', ');
    return{...scene,prompt,negative:withoutConflicts([config.negative,scene.negative].filter(Boolean).join(', '),style),camera:'',finalPrompt:true};
}
