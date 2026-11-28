import { MODELS, referencePlan } from '../plugin/core.mjs';
import { prepareReference } from './images.mjs';
import { serverAtLeast } from './server-health.mjs';
import { el, button, iconButton, field, slider, section, saveBar, confirmAction, notice } from './ui.mjs';

// What a reference picture is used for. `vibe` is Vibe Transfer; the others
// are Precise Reference types.
const USES=[
    ['character&style','인물 + 그림체','인물의 생김새와 그림체를 함께 따라 그립니다.'],
    ['character','인물','인물의 생김새만 따라 그리고 그림체는 프롬프트를 따릅니다.'],
    ['style','그림체','그림체만 따라 그립니다.'],
    ['outfit','의상','옷차림만 따라 그립니다. V5 전용입니다.'],
    ['vibe','분위기 (Vibe)','그림의 분위기와 화풍을 옮깁니다. V4.5 전용입니다.'],
];
const usable=(use,support)=>use==='vibe'?support.vibe:use==='outfit'?support.outfit:support.precise>0;

export async function referencesPage(page,{api,open,isCurrent}){
    const c=api.settings(),model=MODELS[c.model],support=model.references,selected=structuredClone(c.references??[]);
    const intro=section(page,'참조 이미지','그림을 보여 주고 그 인물·그림체·의상을 따라 그리게 합니다.');
    intro.append(el('p','ap2-note',support.bucket
        ?`지금 모델 ${model.label}: 인물 · 그림체 · 의상 참조를 ${support.precise}장까지 함께 쓸 수 있고, 강도는 0~${support.strengthMax}입니다.`
        :`지금 모델 ${model.label}: 분위기(Vibe)와 Precise Reference 1장을 쓸 수 있습니다. 의상 참조와 여러 장 참조는 V5에서 지원합니다.`));
    const input=el('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.multiple=true;input.hidden=true;
    const upload=button('이미지 추가',()=>input.click(),true,'fa-plus'),tools=el('div','ap2-actions'),cost=el('p','ap2-muted');cost.setAttribute('role','status');
    // NovelAI blends several character references into one person instead of drawing each.
    const blend=el('p','ap2-note ap2-warning');blend.setAttribute('role','status');blend.hidden=true;
    tools.append(input,upload);intro.append(tools,cost,blend);
    input.addEventListener('change',async()=>{
        const files=[...(input.files??[])];if(!files.length)return;
        try{
            upload.disabled=true;
            for(const file of files)await api.uploadReference({label:file.name,...await prepareReference(file)});
            notice(files.length>1?`참조 이미지 ${files.length}장을 등록했습니다. 사용할 이미지를 켜세요.`:'참조 이미지를 등록했습니다. 사용하려면 켜세요.');await open('references',true);
        }catch(e){notice(e.message,true);}finally{upload.disabled=false;input.value='';}
    });
    let refs,health;
    try{[refs,health]=await Promise.all([api.references(),api.health()]);}
    catch{page.dataset.failed='true';upload.disabled=true;page.append(el('p','ap2-empty','서버에 연결되면 참조 이미지를 관리할 수 있습니다. 시작 탭에서 준비 상태를 확인하세요.'));return;}
    if(!isCurrent(page))return;
    const current=serverAtLeast(health.version,0,5);
    if(support.bucket&&!current)intro.append(el('p','ap2-note ap2-warning',`서버 플러그인 ${health.version}에서는 V5 참조를 쓸 수 없습니다. 서버 플러그인을 0.5.0 이상으로 교체하고 SillyTavern을 재시작하세요.`));
    // References registered before 0.5.0 get their V5 copy here, once.
    if(current&&refs.some(ref=>!ref.v5))api.prepareReferences(refs).catch(e=>notice(`기존 참조를 V5용으로 준비하지 못했습니다 · ${e.message}`,true));
    const list=el('div','ap2-reference-list');page.append(list);
    const empty=()=>{if(!rows.length&&!list.querySelector('.ap2-empty'))list.append(el('p','ap2-empty','등록한 참조 이미지가 없습니다. 이미지 추가를 눌러 인물이나 그림체가 담긴 그림을 올려 보세요.'));};
    const rows=[];
    for(const ref of refs){
        const saved=selected.find(x=>x.id===ref.id),card=el('article','ap2-reference'),thumb=el('div','ap2-reference-thumb'),main=el('div','ap2-reference-main');
        if(api.isImage(ref.url)){const img=el('img');img.loading='lazy';img.decoding='async';img.alt='';img.src=ref.url;thumb.append(img);}
        const enabled=field('사용',!!saved,{type:'checkbox'});enabled.wrap.classList.add('ap2-reference-toggle');
        const remove=iconButton('참조 삭제','fa-trash-can',async()=>{
            if(!await confirmAction('참조 삭제',`“${ref.label}”을 삭제할까요? 업로드한 원본을 서버에서 삭제하고 적용 목록과 프리셋에서도 해제합니다. 이미 생성한 삽화는 유지됩니다.`))return;
            await api.deleteReference(ref.id);
            const index=rows.findIndex(row=>row.id===ref.id);if(index>=0)rows.splice(index,1);card.remove();empty();update();
            notice('참조 이미지를 삭제했습니다.');
        });
        const head=el('div','ap2-reference-head');head.append(el('strong','',ref.label),enabled.wrap,remove);
        // A new reference starts as what the current model does best.
        const initial=saved?(saved.kind==='vibe'?'vibe':saved.mode):support.bucket?'character&style':'vibe';
        const use=field('용도',initial,{choices:USES.map(([id,label])=>[id,label])}),useHelp=el('small','ap2-muted');use.wrap.append(useHelp);
        const outfit=field('같은 의상 선호',saved?.sameOutfit??initial==='character&style',{type:'checkbox',help:'참조 이미지의 옷차림도 따라 그립니다.'});
        const strength=slider('강도',saved?.strength??(initial==='vibe'?0.6:1),{min:0,max:support.strengthMax,step:0.05});
        const fidelity=slider('충실도',saved?.fidelity??1,{min:0,max:1,step:0.05,help:'낮출수록 참조를 느슨하게 따릅니다.'});
        const information=slider('정보량',saved?.information??1,{min:0,max:1,step:0.05,help:'낮출수록 구도·내용보다 분위기만 가져옵니다.'});
        const warning=el('p','ap2-note ap2-warning');warning.setAttribute('role','status');
        const options=el('div','ap2-reference-options');options.append(use.wrap,outfit.wrap,strength.wrap,fidelity.wrap,information.wrap);
        main.append(head,options,warning);card.append(thumb,main);list.append(card);
        const row={id:ref.id,card,warning,enabled:()=>enabled.read(),read(){
            const value=use.read(),vibe=value==='vibe';
            return{id:ref.id,kind:vibe?'vibe':'precise',mode:vibe?'character':value,sameOutfit:outfit.read(),strength:strength.read(),fidelity:fidelity.read(),information:information.read()};
        },sync(){
            const value=use.read(),vibe=value==='vibe',on=enabled.read();
            useHelp.textContent=USES.find(([id])=>id===value)[2];
            options.hidden=!on;card.dataset.enabled=String(on);
            // Only the controls that mean something for this use and this model.
            outfit.wrap.hidden=!support.outfit||!['character','character&style'].includes(value);
            fidelity.wrap.hidden=vibe||!support.fidelity;information.wrap.hidden=!vibe;
            strength.limit(0,vibe?1:Math.max(1,support.strengthMax));
        }};
        use.input.addEventListener('change',()=>{
            // "Character & Style" keeps the outfit by default, "Character" does not, as on NovelAI.
            if(['character','character&style'].includes(use.read()))outfit.input.checked=use.read()==='character&style';
        });
        rows.push(row);
    }
    empty();
    function update(){
        for(const row of rows)row.sync();
        const active=rows.filter(row=>row.enabled()),plan=referencePlan(c.model,active.map(row=>row.read()));
        for(const row of rows){row.warning.textContent='';row.warning.hidden=true;}
        plan.forEach((entry,i)=>{if(entry.skip){active[i].warning.textContent=`${entry.skip} 이 참조는 건너뜁니다.`;active[i].warning.hidden=false;}});
        const applied=plan.filter(entry=>!entry.skip),precise=applied.filter(entry=>entry.ref.kind==='precise').length;
        cost.textContent=!applied.length?'켜 둔 참조가 없습니다. 참조 없이 그립니다.'
            :`참조 ${applied.length}장 적용 중${precise?` · 그림 한 장마다 Precise Reference ${precise}장 × 5 = ${precise*5} Anlas가 더 듭니다`:''} · 참조를 쓰는 그림은 Opus 무료 생성에 포함되지 않습니다.`;
        const people=applied.filter(entry=>entry.ref.kind==='precise'&&['character','character&style'].includes(entry.ref.mode)).length;
        blend.hidden=people<2;
        blend.textContent=people<2?'':`인물 참조가 ${people}장 켜져 있습니다. NovelAI는 인물 참조 여러 장을 사람마다 따로 그리지 않고 한 사람으로 섞어 그립니다. 두 사람이 나오는 장면이면 인물 참조는 한 장만 켜고, 다른 사람은 인물 탭의 고정 외형으로 그리세요.`;
    }
    list.addEventListener('input',update);list.addEventListener('change',update);update();
    if(refs.length){
        saveBar(page,()=>api.saveSettings({...api.settings(),references:rows.filter(row=>row.enabled()).map(row=>row.read())}));
        const tail=el('div','ap2-actions ap2-page-tail');tail.append(button('모두 끄기',()=>{api.saveSettings({...api.settings(),references:[]});return open('references',true);},false,'fa-power-off'));page.append(tail);
    }
}
