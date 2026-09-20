import { MODELS, normalizeScene } from '../plugin/core.mjs';
import { readNovelAiImage, importedConfig } from './metadata.mjs';
import { el, button, field, modal, notice } from './ui.mjs';

export function imageImport(api,onApplied){
    const {dialog,body}=modal('이미지 읽기');
    const drop=el('div','ap2-import-drop'),file=el('input');file.type='file';file.accept='.png,image/png';file.hidden=true;drop.tabIndex=0;
    drop.append(button('PNG 선택',()=>file.click(),false,'fa-file-image'),el('p','ap2-muted','여기에 놓거나 붙여넣기 · 원본 PNG, 최대 32MB'),file);
    const status=el('p','ap2-muted');status.setAttribute('role','status');const preview=el('div','ap2-import-preview');body.append(drop,status,preview);
    const footer=el('footer','ap2-footer');dialog.append(footer);let serial=0,url='';
    dialog.addEventListener('close',()=>{serial++;if(url)URL.revokeObjectURL(url);});
    async function read(input){
        const ticket=++serial;preview.replaceChildren();footer.replaceChildren();status.textContent='이미지 정보를 읽는 중…';
        if(url){URL.revokeObjectURL(url);url='';}
        try{
            const result=await readNovelAiImage(input);if(ticket!==serial||!dialog.open)return;
            status.textContent=`${input.name||'붙여넣은 이미지'} · ${result.storage}`;
            url=URL.createObjectURL(input);const img=el('img','ap2-import-thumb');img.src=url;img.alt='가져올 이미지';
            const summary=el('div'),model=field('적용 모델',result.patch.model??'',{choices:[['','모델 선택'],...Object.entries(MODELS).map(([id,m])=>[id,m.label])]});
            summary.append(model.wrap,el('p','ap2-muted',result.source));const head=el('div','ap2-import-head');head.append(img,summary);preview.append(head);
            const table=el('table','ap2-import-table'),caption=el('caption','','가져올 생성 설정');table.append(caption);
            const labels={width:'가로',height:'세로',steps:'Steps',scale:'Guidance',seed:'Seed',sampler:'샘플러',scheduler:'스케줄러',cfgRescale:'CFG rescale',transparent:'투명 배경',useCoords:'좌표 적용',useOrder:'인물 순서'};
            for(const [key,label]of Object.entries(labels))if(Object.hasOwn(result.patch,key)){const tr=el('tr');tr.append(el('th','',label),el('td','',typeof result.patch[key]==='boolean'?(result.patch[key]?'켜짐':'꺼짐'):String(result.patch[key])));table.append(tr);}preview.append(table);
            for(const [title,value]of [['장면 프롬프트',result.scene.prompt],['제외 요소',result.scene.negative],...result.scene.characters.map(c=>[`${c.name} · ${c.x}, ${c.y}`,`${c.prompt}${c.negative?'\n제외: '+c.negative:''}`])]){const d=el('details','ap2-guide-topic');d.append(el('summary','',title),el('pre','ap2-code',value||'없음'));preview.append(d);}
            const seed=field('시드 적용',result.patch.seed!==undefined,{type:'checkbox'});seed.input.disabled=result.patch.seed===undefined;preview.append(seed.wrap);
            const relax=field('비용 보호 해제',false,{type:'checkbox',help:'큰 해상도·28 Steps 초과 설정을 적용할 때만 직접 선택하세요.'});
            const current=api.settings(),large=(result.patch.width??current.width)*(result.patch.height??current.height)>1048576||(result.patch.steps??current.steps)>28;if(large&&current.budgetGuard)preview.append(relax.wrap);
            if(result.warnings.length){const warnings=el('ul','ap2-import-warnings');for(const message of result.warnings)warnings.append(el('li','',message));preview.append(warnings);}
            preview.append(el('p','ap2-muted','설정 적용은 생성 옵션만, 장면 편집은 프롬프트·인물까지 가져옵니다. 이미지를 생성하거나 파일을 업로드하지 않습니다.'));
            const config=forScene=>{normalizeScene(result.scene,model.read()||'nai-diffusion-5-full');return importedConfig(api.settings(),result,{model:model.read(),seed:seed.read(),relaxBudget:large&&relax.read(),forScene});};
            footer.append(button('설정 적용',async()=>{api.saveSettings(config(false));await onApplied();dialog.close();notice('이미지의 생성 설정을 적용했습니다.');}),button('장면 편집',async()=>{await api.importScene(result.scene,config(true));dialog.close();},true));
        }catch(e){if(ticket===serial){status.textContent=e.message;status.setAttribute('role','alert');}}
    }
    file.addEventListener('change',()=>{if(file.files?.[0])void read(file.files[0]);file.value='';});
    drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-over');});drop.addEventListener('dragleave',()=>drop.classList.remove('is-over'));
    drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-over');if(e.dataTransfer?.files?.[0])void read(e.dataTransfer.files[0]);});
    dialog.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files??[])][0];if(f){e.preventDefault();void read(f);}});
    drop.focus();return dialog;
}
