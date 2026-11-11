import { CAMERA_TAGS, ORIENTATIONS, hasCameraTag, toggleCameraTag } from './framing.mjs';
import { el, button, field, modal, segmented } from './ui.mjs';

// Fast path for "this picture, but different": edit the few fields that decide
// the image and generate again into the same place.
export function quickEdit({scene,size='',onRewrite,onGenerate,onDetail}){
    const {dialog,body}=modal('장면 수정','바꿀 부분만 고친 뒤 다시 생성합니다. 이전 그림은 버전으로 남습니다.');dialog.classList.add('ap2-quick-edit');
    let draft=structuredClone(scene);
    const ask=field('원하는 장면','',{multiline:true,rows:2,placeholder:'예: 둘이 껴안은 모습이 옆에서 보이게, 배경은 노을 진 옥상'});
    const rewrite=button('AI로 고쳐 쓰기',async()=>{
        const request=ask.read().trim();if(!request)throw new Error('원하는 장면을 먼저 적어 주세요.');
        status.textContent='AI가 장면을 고쳐 쓰는 중…';
        try{draft={...await onRewrite(read(),request)};fill();status.textContent='고쳐 썼습니다. 내용을 확인하고 재생성을 누르세요.';}
        catch(e){status.textContent='고쳐 쓰지 못했습니다. 아래 내용을 직접 수정할 수 있습니다.';throw e;}
    },false,'fa-wand-magic-sparkles');
    const status=el('p','ap2-muted');status.setAttribute('role','status');
    const assist=el('section','ap2-quick-assist');assist.append(ask.wrap,rewrite,status);
    const chips=el('div','ap2-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label','구도 바로 고르기');
    const camera=field('구도','',{placeholder:'예: from side, upper body'}),prompt=field('장면','',{multiline:true,rows:4}),people=el('div','ap2-quick-people');
    camera.wrap.classList.add('ap2-field-wide');
    const shape=segmented('화면 비율',[['','그대로'],...ORIENTATIONS.slice(1)],size,value=>{size=value;}),shapeRow=el('div','ap2-quick-shape');shapeRow.append(el('span','','화면 비율'),shape.wrap);
    const syncChips=()=>{for(const chip of chips.children)chip.setAttribute('aria-pressed',String(hasCameraTag(camera.read(),chip.dataset.tag)));};
    for(const [tag,label,group]of CAMERA_TAGS){
        const chip=el('button','ap2-chip-button',label);chip.type='button';chip.dataset.tag=tag;chip.dataset.group=group;chip.title=tag;
        chip.addEventListener('click',()=>{camera.input.value=toggleCameraTag(camera.read(),tag);syncChips();});chips.append(chip);
    }
    camera.input.addEventListener('input',syncChips);
    let cast=[];
    function fill(){
        camera.input.value=draft.camera??'';prompt.input.value=draft.prompt??'';people.replaceChildren();
        cast=(draft.characters??[]).map((c,i)=>{const f=field(c.name||`인물 ${i+1}`,c.prompt??'',{multiline:true,rows:3});people.append(f.wrap);return f;});
        syncChips();
    }
    const read=()=>({...draft,camera:camera.read().trim(),prompt:prompt.read().trim(),finalPrompt:false,characters:(draft.characters??[]).map((c,i)=>({...c,prompt:cast[i].read()}))});
    body.append(assist,chips,camera.wrap,shapeRow,prompt.wrap,people);fill();
    const footer=el('footer','ap2-footer ap2-editor-footer'),left=el('div','ap2-actions'),right=el('div','ap2-actions');
    left.append(button('자세히 편집',()=>{dialog.close();return onDetail(read());},false,'fa-sliders'));
    right.append(button('재생성',async()=>{await onGenerate(read(),size);dialog.close();},true,'fa-rotate-right'));
    footer.append(left,right);dialog.append(footer);return dialog;
}
