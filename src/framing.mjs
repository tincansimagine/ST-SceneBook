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
export const FRAMES=[['soft','기본'],['none','없음'],['line','라인'],['polaroid','폴라로이드'],['film','필름'],['gallery','액자'],['tape','마스킹테이프'],['neon','네온'],['sketch','스케치'],['glass','유리'],['vintage','빈티지'],['storybook','동화책']];
