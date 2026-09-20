import { safeImagePath } from '../plugin/core.mjs';
export function positionPoint(x,y,model){
    const axis=value=>{
        const n=Number(value);if(!Number.isFinite(n))throw new Error('인물 위치는 숫자로 입력하세요.');
        const bounded=Math.max(0,Math.min(1,n));
        return Number((model.startsWith('nai-diffusion-5-')?bounded:Math.max(.1,Math.min(.9,Math.round((bounded-.1)/.2)*.2+.1))).toFixed(3));
    };
    return{x:axis(x),y:axis(y)};
}
export function positionEditor({model,width,height,entries,backgroundUrl,onSelect=()=>{},onMove=()=>{},showChoices=true}){
    const make=(tag,cls,text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
    const element=make('section','ap2-placement'),title=make('h4','','인물 배치'),hint=make('p','ap2-muted',`드래그 · 클릭 · 방향키로 이동. ${model.startsWith('nai-diffusion-5-')?'V5 자유 좌표':'V4.5 5 × 5 격자'}`);
    const choices=make('div','ap2-position-choices'),board=make('div','ap2-position-board'),readout=make('output','ap2-muted');
    board.style.aspectRatio=`${width} / ${height}`;board.style.maxWidth=`${Math.min(520,320*width/height)}px`;board.setAttribute('aria-label','인물 배치 화면');
    if(!model.startsWith('nai-diffusion-5-'))board.classList.add('ap2-grid5');
    const actions=make('div','ap2-actions');let selected=0,nodes=[],drag=null;
    const snapshot=()=>entries();
    const update=()=>{
        const list=snapshot();nodes.forEach((node,i)=>{const e=list[i];if(!e)return;let p;try{p=positionPoint(e.x,e.y,model);}catch{return;}
            node.style.left=`${p.x*100}%`;node.style.top=`${p.y*100}%`;node.classList.toggle('selected',selected===i);node.setAttribute('aria-label',`${e.name||`인물 ${i+1}`} 위치 ${p.x}, ${p.y}`);
        });
        [...choices.children].forEach((n,i)=>n.setAttribute('aria-pressed',String(i===selected)));
        const e=list[selected];readout.textContent=e?`${e.name||`인물 ${selected+1}`} · 가로 ${Number(e.x).toFixed(2)} / 세로 ${Number(e.y).toFixed(2)}`:'장면 인물을 추가하면 배치할 수 있습니다.';
    };
    const commit=(x,y)=>{const e=snapshot()[selected];if(!e)return;const p=positionPoint(x,y,model);e.set(p.x,p.y);onMove();update();};
    const fromPointer=e=>{const r=board.getBoundingClientRect();if(r.width&&r.height)commit((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);};
    const refresh=()=>{
        const list=snapshot();selected=Math.max(0,Math.min(selected,list.length-1));nodes=[];board.replaceChildren();choices.replaceChildren();
        if(safeImagePath(backgroundUrl)){const image=make('img','ap2-position-background');image.src=backgroundUrl;image.alt='';image.draggable=false;board.append(image);}
        list.forEach((e,i)=>{
            const label=e.name||`인물 ${i+1}`,choice=make('button','menu_button ap2-button',`${i+1}. ${label}`);choice.type='button';choice.addEventListener('click',()=>{selected=i;onSelect(i);update();nodes[i].focus();});choices.append(choice);
            const marker=make('button','ap2-position-person',String(i+1));marker.type='button';marker.title=label;
            marker.addEventListener('focus',()=>{if(selected!==i){selected=i;onSelect(i);update();}});
            marker.addEventListener('click',()=>{selected=i;onSelect(i);update();});
            marker.addEventListener('pointerdown',ev=>{if(ev.button!==0)return;ev.preventDefault();selected=i;onSelect(i);drag=ev.pointerId;marker.setPointerCapture(ev.pointerId);marker.focus();update();});
            marker.addEventListener('pointermove',ev=>{if(drag===ev.pointerId)fromPointer(ev);});
            const end=ev=>{if(drag===ev.pointerId){drag=null;if(marker.hasPointerCapture(ev.pointerId))marker.releasePointerCapture(ev.pointerId);}};
            marker.addEventListener('pointerup',end);marker.addEventListener('pointercancel',end);marker.addEventListener('lostpointercapture',()=>{drag=null;});
            marker.addEventListener('keydown',ev=>{
                const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[ev.key];if(!delta)return;
                ev.preventDefault();selected=i;const p=positionPoint(snapshot()[i].x,snapshot()[i].y,model),step=model.startsWith('nai-diffusion-5-')?(ev.shiftKey?.1:.01):.2;commit(p.x+delta[0]*step,p.y+delta[1]*step);
            });
            board.append(marker);nodes.push(marker);
        });update();
    };
    board.addEventListener('pointerdown',e=>{if(e.target===board&&e.button===0){e.preventDefault();fromPointer(e);}});
    for(const [label,apply]of [['균등 배치',(e,i,n)=>[(i+1)/(n+1),.5]],['좌우 뒤집기',e=>[1-Number(e.x),Number(e.y)]],['중앙',()=>[.5,.5]]]){
        const b=make('button','menu_button ap2-button',label);b.type='button';b.addEventListener('click',()=>{const list=snapshot();list.forEach((e,i)=>{if(label==='중앙'&&i!==selected)return;const p=positionPoint(...apply(e,i,list.length),model);e.set(p.x,p.y);});onMove();update();});actions.append(b);
    }
    choices.hidden=!showChoices;element.append(title,hint,choices,board,readout,actions);refresh();return{element,refresh,select(index){selected=index;update();},update};
}
