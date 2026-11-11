import { FRAMES } from './framing.mjs';
import { ORNAMENTS, ORNAMENT_PAD, ornamentSvg } from './ornaments.mjs';
import { safeFramePath } from './frame-import.mjs';

export const validFrame=(id,custom=[])=>FRAMES.some(([x])=>x===id)||ORNAMENTS.some(([x])=>`art:${x}`===id)||custom.some(f=>`image:${f.id}`===id);
// Decorates one picture. `picture` is the element holding the <img>.
export function applyFrame(figure,wrap,picture,width,height,config){
    let id=config.frame;const custom=config.customFrames??[];
    if(width>height&&config.frameWide&&validFrame(config.frameWide,custom))id=config.frameWide;
    if(id.startsWith('art:')){
        figure.dataset.frame='art';wrap.style.padding=`${ORNAMENT_PAD*100}%`;wrap.insertAdjacentHTML('beforeend',ornamentSvg(id.slice(4),width,height));return;
    }
    const frame=id.startsWith('image:')&&custom.find(f=>f.id===id.slice(6));
    if(frame&&safeFramePath(frame.url)){
        const [x,y,w,h]=frame.window;figure.dataset.frame='image';wrap.style.aspectRatio=`${frame.width} / ${frame.height}`;
        Object.assign(picture.style,{position:'absolute',left:`${x*100}%`,top:`${y*100}%`,width:`${w*100}%`,height:`${h*100}%`,maskImage:`url("${frame.mask}")`,webkitMaskImage:`url("${frame.mask}")`});
        const art=document.createElement('img');art.className='ap2-frame-art';art.src=frame.url;art.alt='';art.draggable=false;wrap.append(art);return;
    }
    figure.dataset.frame=FRAMES.some(([x])=>x===id)?id:'soft';
}
// Preview tile contents for the picker.
export function frameChoices(config){
    return[...FRAMES.map(([id,label])=>({id,label})),...ORNAMENTS.map(([id,label])=>({id:`art:${id}`,label})),...(config.customFrames??[]).map(f=>({id:`image:${f.id}`,label:f.name,custom:f}))];
}
