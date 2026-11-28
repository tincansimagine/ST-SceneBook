// Per-scene canvas orientation, camera shortcuts and chat frame styles.
export function orientation(value){
    const v=String(value??'').toLowerCase();
    return /land|wide|horizontal|가로/.test(v)?'landscape':/port|tall|vertical|세로/.test(v)?'portrait':/square|정사각/.test(v)?'square':'';
}
// Keep roughly the configured pixel count and only change the shape.
export function sizeFor(config,size){
    const long=Math.max(config.width,config.height),short=Math.min(config.width,config.height);
    if(size==='portrait')return{width:short,height:long};
    if(size==='landscape')return{width:long,height:short};
    if(size==='square'){
        let side=Math.round(Math.sqrt(long*short)/64)*64;
        if(config.budgetGuard&&side*side>1048576)side-=64;
        return{width:side,height:side};
    }
    return{width:config.width,height:config.height};
}
export const ORIENTATIONS=[['','설정값'],['portrait','세로'],['landscape','가로'],['square','정사각']];
// [tag, label, group]. One viewpoint and one shot size apply at a time.
export const CAMERA_TAGS=[
    ['from side','옆에서','view'],['from above','위에서','view'],['from below','아래에서','view'],['from behind','뒤에서','view'],['straight-on','정면','view'],['pov','1인칭','view'],
    ['close-up','클로즈업','shot'],['upper body','상반신','shot'],['cowboy shot','무릎 위','shot'],['full body','전신','shot'],['wide shot','멀리서','shot'],
];
const tags=text=>String(text??'').split(',').map(x=>x.trim()).filter(Boolean);
export const hasCameraTag=(camera,tag)=>tags(camera).some(x=>x.toLowerCase()===tag);
export function toggleCameraTag(camera,tag){
    const group=CAMERA_TAGS.find(x=>x[0]===tag)?.[2],siblings=CAMERA_TAGS.filter(x=>x[2]===group).map(x=>x[0]),on=hasCameraTag(camera,tag);
    const kept=tags(camera).filter(x=>!siblings.includes(x.toLowerCase()));
    return(on?kept:[tag,...kept]).join(', ');
}
// Built-in looks. Tags are generic medium and rendering terms, added in front
// of the user's own main prompt.
export const LOOKS=[
    ['','사용 안 함','',''],
    ['semi','반실사','semi-realistic, detailed skin, soft shading, depth of field','flat color, chibi'],
    ['cinema','시네마틱','cinematic lighting, dramatic shadows, depth of field, film grain','flat color, simple background'],
    ['watercolor','수채화','watercolor (medium), traditional media, soft edges, paper texture, pastel colors','3d, photorealistic'],
    ['manga','흑백 만화','monochrome, greyscale, manga, screentones, ink lines, high contrast','color, 3d'],
    ['webtoon','웹툰','flat color, clean lineart, thick outlines, cel shading, vivid colors','sketch, painterly'],
    ['retro','레트로 애니','retro artstyle, 1990s (style), anime screenshot, cel shading, film grain','3d, photorealistic'],
    ['sketch','연필 스케치','sketch, graphite (medium), traditional media, rough lines, unfinished, monochrome','3d, color'],
    ['pixel','도트','pixel art, limited palette, dithering, low resolution look','blurry, 3d, photorealistic'],
    ['chibi','치비','chibi, super deformed, big head, small body, cute, simple shading','realistic, tall'],
    ['oil','유화','oil painting (medium), impasto, visible brushstrokes, rich colors, classical lighting','flat color, lineart'],
    ['pastel','파스텔 동화','soft pastel colors, storybook illustration, gentle lighting, rounded shapes, dreamy','dark, high contrast'],
];
// Tags a look used to have. A picture drawn then still carries them in its saved
// prompt, so they are recognised and taken out like the current ones. "wide aspect
// composition" is not a tag NovelAI knows and pulled portrait pictures toward a wide
// frame; NovelAI knows the screentone tag as "screentones".
const LEGACY_LOOKS={
    cinema:[['cinematic lighting, dramatic shadows, depth of field, film grain, wide aspect composition','flat color, simple background']],
    manga:[['monochrome, greyscale, manga, screentone, ink lines, high contrast','color, 3d']],
};
// Longest first: an old tag list can begin with the current one and must be matched whole.
const lookVariants=()=>LOOKS.flatMap(([id,,tags,exclude])=>[[id,tags,exclude],...(LEGACY_LOOKS[id]??[]).map(([t,e])=>[id,t,e])]).sort((a,b)=>b[1].length-a[1].length);
const join=(a,b)=>[a,b].map(x=>String(x??'').trim()).filter(Boolean).join(', ');
// Takes a built-in look back out of a rendered config: its tags from the
// front of the main prompt and its exclusions from the end of the UC. A
// picture's saved config has the look applied, and an older version could
// apply it again on every regeneration, so every stacked copy is removed.
export function splitLook(config){
    let style=String(config?.style??'').trim(),negative=String(config?.negative??'').trim(),look='';
    for(let found=true;found;){
        found=false;
        for(const [id,tags,exclude]of lookVariants()){
            if(!id||(style!==tags&&!style.startsWith(`${tags}, `)))continue;
            style=style.slice(tags.length).replace(/^,\s*/,'');look||=id;found=true;
            if(negative===exclude||negative.endsWith(`, ${exclude}`))negative=negative.slice(0,negative.length-exclude.length).replace(/,\s*$/,'');
        }
    }
    return{style,negative,look};
}
// Applies a look exactly once, whatever the config already carries.
export function withLook(config,id){
    const plain=splitLook(config),look=LOOKS.find(x=>x[0]===id);
    if(!look||!look[0])return{...config,style:plain.style,negative:plain.negative};
    return{...config,style:join(look[2],plain.style),negative:join(plain.negative,look[3])};
}
export const FRAMES=[['soft','기본'],['none','없음'],['line','라인']];
