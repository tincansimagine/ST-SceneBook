import { MODELS, SAMPLERS, safeImagePath } from '../plugin/core.mjs';
import { prepareReference } from './images.mjs';
import { positionEditor } from './position.mjs';
import { HELP, showGuide } from './guide.mjs';
import { imageImport } from './import-ui.mjs';
import { promptEditor } from './prompt-ui.mjs';
import { notice,placeNotices } from './notifications.mjs';
import { workflowEnabled } from './automatic.mjs';
export { notice } from './notifications.mjs';
export { composer } from './editor.mjs';

export function el(tag, className = '', value = '') {
    const node = document.createElement(tag); node.className = className;
    if (value) node.textContent = value;
    return node;
}
export function button(label, action, primary = false, icon = '') {
    const b = el('button', `menu_button menu_button_icon ap2-button${primary ? ' ap2-primary' : ''}`); b.type = 'button';
    if(icon){const glyph=el('i',`fa-solid ${icon}`);glyph.setAttribute('aria-hidden','true');b.append(glyph);}
    b.append(el('span','',label));
    b.addEventListener('click', async () => {
        try { const result=action();if(result?.then){b.disabled=true;try{await result;}finally{b.disabled=false;}} } catch (e) { notice(e.message, true); }
    }); return b;
}
export function iconButton(label, icon, action) {
    const b=button('',action,false,icon);b.classList.add('ap2-icon-button');
    b.title=label;b.setAttribute('aria-label',label);return b;
}
// Native popovers stay above the scrolling dialog and dismiss on outside click.
export function actionMenu(actions,label='더 보기') {
    const wrap=el('div','ap2-action-menu'),panel=el('div','ap2-action-panel');panel.setAttribute('popover','auto');panel.setAttribute('role','group');panel.setAttribute('aria-label',label);
    const trigger=iconButton(label,'fa-ellipsis',()=>{
        if(panel.matches(':popover-open')){panel.hidePopover();return;}
        panel.showPopover();const r=trigger.getBoundingClientRect(),p=panel.getBoundingClientRect();
        panel.style.left=`${Math.max(8,Math.min(r.right-p.width,innerWidth-p.width-8))}px`;
        panel.style.top=`${Math.max(8,r.top>p.height+8?r.top-p.height-6:Math.min(r.bottom+6,innerHeight-p.height-8))}px`;
    });
    panel.id=`ap2-menu-${crypto.randomUUID()}`;trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');
    let events;
    panel.addEventListener('toggle',()=>{
        events?.abort();const open=panel.matches(':popover-open');trigger.setAttribute('aria-expanded',String(open));
        if(open){events=new AbortController();window.addEventListener('resize',()=>panel.hidePopover(),{signal:events.signal});}
    });
    for(const item of actions)panel.append(button(item.label,()=>{panel.hidePopover();return item.run();},false,item.icon??''));
    wrap.append(trigger,panel);return wrap;
}
export function modal(title, subtitle = '') {
    const previous = document.activeElement;
    const dialog = el('dialog', 'ap2-dialog');
    const header = el('header', 'ap2-header'), titleBox = el('div');
    const heading=el('h2','',title);heading.id=`ap2-title-${crypto.randomUUID()}`;dialog.setAttribute('aria-labelledby',heading.id);
    titleBox.append(heading);
    if (subtitle) titleBox.append(el('p', 'ap2-muted', subtitle));
    header.append(titleBox, button('닫기', () => dialog.close()));
    const body = el('div', 'ap2-body'); dialog.append(header, body); document.body.append(dialog);
    dialog.addEventListener('close', () => { placeNotices(); dialog.remove(); previous?.focus(); });
    for(const event of ['mousedown','pointerdown','click'])dialog.addEventListener(event,e=>e.stopPropagation());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.showModal();placeNotices(); return { dialog, body };
}
export function field(label, value, options = {}) {
    const wrap = el('label', 'ap2-field'); wrap.append(el('span', '', label));
    let input;
    if (options.choices) {
        input = el('select');
        for (const [id, caption] of options.choices) { const o = el('option', '', caption); o.value = id; input.append(o); }
    } else if (options.multiline) { input = el('textarea'); input.rows = options.rows ?? 3; }
    else { input = el('input'); input.type = options.type ?? 'text'; }
    if (options.type === 'checkbox') { input.checked = !!value; wrap.classList.add('ap2-check'); }
    else {input.value = value ?? '';input.classList.add('text_pole');}
    if(options.multiline)wrap.classList.add('ap2-field-wide');
    if(options.choices)wrap.classList.add('ap2-field-select');
    for (const key of ['min', 'max', 'step', 'placeholder']) if (options[key] !== undefined) input.setAttribute(key, options[key]);
    wrap.append(input);
    if (options.help) wrap.append(el('small', 'ap2-muted', options.help));
    return { wrap, input, read: () => options.type === 'checkbox' ? input.checked : options.type === 'number' ? Number(input.value) : input.value };
}
export function addField(parent, map, key, label, value, options) {
    const f = field(label, value, options);if(HELP[key]){f.input.title=HELP[key];f.wrap.title=HELP[key];}map[key] = f; parent.append(f.wrap); return f.input;
}
export function readFields(map) { return Object.fromEntries(Object.entries(map).map(([key, f]) => [key, f.read()])); }
export function confirmAction(title,message,confirmLabel='삭제'){
    return new Promise(resolve=>{const {dialog,body}=modal(title);body.append(el('p','',message));const footer=el('footer','ap2-footer');footer.append(button('취소',()=>dialog.close()),button(confirmLabel,()=>{dialog.returnValue='confirm';dialog.close();},true));dialog.append(footer);dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});footer.querySelector('button').focus();});
}
function settingGroup(parent,title,collapsed=false){
    const group=el(collapsed?'details':'fieldset','ap2-group');
    group.append(el(collapsed?'summary':'legend','',title));
    const content=el('div','ap2-group-content');group.append(content);parent.append(group);return content;
}
function saveBar(page,save){
    const row=el('div','ap2-savebar'),state=el('span','ap2-muted','');
    let revision=0;
    const commit=async()=>{const version=++revision;page.dataset.dirty='true';try{await save();if(version===revision){page.dataset.dirty='false';state.textContent='자동 저장';}}catch(e){if(version===revision)state.textContent=`저장 안 됨 · ${e.message}`;}};
    // Commit values to ST's settings on every edit. ST batches disk writes; a
    // closed drawer, tab switch or extension update cannot discard form-only edits.
    page.addEventListener('input',commit);page.addEventListener('change',commit);
    state.textContent='자동 저장';row.append(state,button('저장',commit,false,'fa-floppy-disk'));page.append(row);
}
function installationHelp(){
    const {body}=modal('연결 안내');
    body.append(el('p','','이미지 생성에는 씬북 서버 플러그인과 NovelAI 키가 필요합니다.'));
    const steps=el('ol','ap2-help-steps');
    for(const message of ['배포 파일의 server-plugin/autopic2 폴더를 SillyTavern/plugins/autopic2에 복사합니다.','SillyTavern의 config.yaml에서 enableServerPlugins를 true로 설정하고 서버를 재시작합니다.','SillyTavern API 연결에서 NovelAI 키를 저장한 뒤 씬북의 확인 버튼을 누릅니다.'])steps.append(el('li','',message));body.append(steps);
}
export function downloadJson(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function studio(api,host=null) {
    const { dialog, body } = host?{dialog:{close(){}},body:host}:modal('씬북');
    const connection=el('div','ap2-connection'),connectionText=el('span','ap2-connection-label','연결 확인 중');
    const help=button('설치 안내',()=>installationHelp(),false,'fa-circle-info');help.hidden=true;
    const check=async()=>{connectionText.textContent='연결 확인 중';try{const h=await api.health(true);connectionText.textContent=`서버 ${h.version} · ${h.hasKey?'연결됨':'NovelAI 키 미설정'}`;connection.dataset.state=h.hasKey?'ready':'warning';help.hidden=h.hasKey;}catch(e){connectionText.textContent=e.message;connection.dataset.state='warning';help.hidden=false;}};
    connection.append(connectionText,help,button('확인',check,false,'fa-rotate-right'),button('사용법',showGuide,false,'fa-circle-question'));
    const quick=el('div','ap2-quick');quick.append(button('장면 편집',async()=>{dialog.close();await api.compose();},false,'fa-pen'),button('이미지 읽기',()=>imageImport(api,()=>open('generation',true)),false,'fa-file-image'));
    const workflow=el('section','ap2-workflow'),mode=field('처리 방식',api.settings().automatic,{choices:[['generate','자동 생성'],['review','초안만']]}),injection=field('프롬프트 주입',workflowEnabled(api.settings()),{type:'checkbox'}),flowHelp=el('p','ap2-muted'),flowStatus=el('p','ap2-muted ap2-workflow-status');flowStatus.setAttribute('role','status');
    const editInjection=button('프롬프트',()=>promptEditor(api.settings(),value=>api.saveSettings({...api.settings(),...value}),{initial:'injection'}),false,'fa-pen');editInjection.title='기본 삽화 프롬프트 보기·수정';
    workflow.append(injection.wrap,editInjection,mode.wrap,flowHelp,flowStatus);
    const refreshWorkflow=()=>{const c=api.settings();mode.input.value=c.automatic==='off'?'generate':c.automatic;injection.input.checked=workflowEnabled(c);mode.input.disabled=!workflowEnabled(c);flowHelp.textContent=workflowEnabled(c)?'주입: 깊이 0 · System (최신 대화 위치) → '+(c.automatic==='review'?'초안만 저장':`이미지 생성 · ${c.every===1?'매 답변':`${c.every}개 답변마다`}`):'꺼짐 · 삽화 프롬프트 주입과 자동 처리를 모두 멈춥니다.';flowStatus.textContent=api.status?.()||'설정은 자동 저장됩니다.';};
    mode.input.addEventListener('change',()=>{api.saveSettings({...api.settings(),automatic:mode.read()});refreshWorkflow();});
    injection.input.addEventListener('change',()=>{const c=api.settings(),enabled=injection.read();api.saveSettings({...c,promptInjection:enabled,automatic:enabled&&c.automatic==='off'?'generate':c.automatic});refreshWorkflow();});
    document.addEventListener('scenebook-workflow-status',refreshWorkflow);document.addEventListener('scenebook-settings-changed',refreshWorkflow);
    if(!host)dialog.addEventListener('close',()=>{document.removeEventListener('scenebook-workflow-status',refreshWorkflow);document.removeEventListener('scenebook-settings-changed',refreshWorkflow);},{once:true});refreshWorkflow();
    const nav = el('nav', 'ap2-tabs'), pages = el('div','ap2-pages');nav.setAttribute('aria-label','씬북 설정');nav.setAttribute('role','tablist');
    body.append(connection,workflow,quick,nav,pages);
    const tabs = [ ['generation', '생성','fa-sliders'], ['characters', '인물','fa-user'], ['references','참조','fa-images'], ['gallery', '갤러리','fa-film'], ['queue', '작업','fa-list-check'] ];
    const cached=new Map(),instanceId=`ap2-${crypto.randomUUID()}`;let activeId='generation',characterScope=null;
    const open = async (id,refresh=false) => {
        activeId=id;
        nav.querySelectorAll('button').forEach(b => {const active=b.dataset.page===id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
        for(const p of pages.children)p.hidden=true;
        if(cached.has(id)&&!refresh&&!cached.get(id).dataset.failed&&['generation','characters','references'].includes(id)&&(id!=='characters'||cached.get(id).dataset.contextKey===api.contextKey())){cached.get(id).hidden=false;return;}
        cached.get(id)?.remove();const page=el('section','ap2-page');page.id=`${instanceId}-page-${id}`;page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',`${instanceId}-tab-${id}`);pages.append(page);cached.set(id,page);
        if (id === 'generation') {
            const c=api.settings(),fields={};
            const image=settingGroup(page,'이미지');
            const model=addField(image,fields,'model','모델',c.model,{choices:Object.entries(MODELS).map(([id,m])=>[id,m.label])});
            const dimensions=el('div','ap2-grid');image.append(dimensions);
            addField(dimensions,fields,'width','가로',c.width,{type:'number',min:64,max:2048,step:64});
            addField(dimensions,fields,'height','세로',c.height,{type:'number',min:64,max:2048,step:64});
            const sizes=el('div','ap2-size-presets');
            for(const [label,w,h]of [['세로',832,1216],['정사각',1024,1024],['가로',1216,832]])sizes.append(button(label,()=>{fields.width.input.value=w;fields.height.input.value=h;page.dispatchEvent(new Event('input',{bubbles:true}));}));
            image.append(sizes);
            const sampling=el('div','ap2-grid');image.append(sampling);
            addField(sampling,fields,'steps','Steps',c.steps,{type:'number',min:1,max:50,step:1});
            addField(sampling,fields,'scale','Guidance',c.scale,{type:'number',min:0,max:10,step:0.1});
            const analysis=settingGroup(page,'수동 분석',true);
            addField(analysis,fields,'profileId','연결 프로필',c.profileId,{choices:[['','현재 채팅 연결'],...api.profiles().map(p=>[p.id,p.name])],help:'따로 고르지 않아도 현재 대화에 사용하는 AI로 분석합니다.'});
            addField(analysis,fields,'analysisMode','분석 방식',c.analysisMode,{choices:[['quick','빠르게'],['precise','정밀하게']],help:'정밀 분석은 복장·외형 시점 확인에 LLM을 한 번 더 호출합니다.'});
            const counts=el('div','ap2-grid');analysis.append(counts);
            addField(counts,fields,'contextMessages','이전 메시지',c.contextMessages,{type:'number',min:0,max:30,step:1});
            analysis.append(button('분석',()=>api.analyze(),false,'fa-wand-magic-sparkles'),el('p','ap2-muted','삽화 지시가 없는 답변을 따로 분석합니다. 별도 AI 요청이 발생합니다.'));
            const prompts=settingGroup(page,'프롬프트',true);
            addField(prompts,fields,'style','메인 프롬프트',c.style,{multiline:true});
            addField(prompts,fields,'negative','UC 프롬프트',c.negative,{multiline:true,rows:2});
            prompts.append(button('편집 · 공유',()=>promptEditor({...api.settings(),...readFields(fields)},value=>{for(const key of ['style','negative'])fields[key].input.value=value[key];fields.quality.input.checked=value.quality;for(const key of ['analysisPrompt','injectionPrompt'])fields[key]={read:()=>value[key]};api.saveSettings({...api.settings(),...value});}),false,'fa-pen'));
            const automatic=settingGroup(page,'자동 생성 한도',true);
            const limits=el('div','ap2-grid');automatic.append(limits);
            addField(limits,fields,'maxScenes','최대 장면',c.maxScenes,{type:'number',min:1,max:6,step:1});
            addField(limits,fields,'every','답변 간격',c.every,{type:'number',min:1,max:20,step:1});
            addField(limits,fields,'sessionLimit','접속당 요청 한도',c.sessionLimit,{type:'number',min:1,max:100,step:1});
            const advanced=settingGroup(page,'고급 설정',true);
            addField(advanced,fields,'sampler','샘플러',c.sampler,{choices:SAMPLERS.map(v=>[v,v])});
            const scheduler=addField(advanced,fields,'scheduler','스케줄러',c.scheduler,{choices:['karras','exponential','polyexponential','native'].map(v=>[v,v])});
            const extra=el('div','ap2-grid');advanced.append(extra);
            addField(extra,fields,'seed','Seed',c.seed,{type:'number',min:-1,max:4294967295,step:1,help:'-1: 무작위'});
            addField(extra,fields,'cfgRescale','CFG rescale',c.cfgRescale,{type:'number',min:0,max:1,step:0.05});
            addField(advanced,fields,'quality','품질 태그',c.quality,{type:'checkbox'});
            addField(advanced,fields,'useCoords','좌표 적용',c.useCoords,{type:'checkbox'});
            addField(advanced,fields,'useOrder','인물 순서 적용',c.useOrder,{type:'checkbox'});
            const transparent=addField(advanced,fields,'transparent','투명 배경',c.transparent,{type:'checkbox',help:'V5 전용'});
            addField(advanced,fields,'budgetGuard','비용 보호',c.budgetGuard,{type:'checkbox',help:'1메가픽셀·28 Steps 제한. 무료 생성을 보장하지 않습니다.'});
            const updateModel=()=>{const v5=model.value.startsWith('nai-diffusion-5-');if(v5)scheduler.value='karras';scheduler.disabled=v5;transparent.disabled=!v5;if(!v5)transparent.checked=false;};model.addEventListener('change',updateModel);updateModel();
            const display=settingGroup(page,'채팅 표시',true);
            addField(display,fields,'placement','삽입 위치',c.placement,{choices:[['inline','문단 뒤'],['end','답변 아래']]});
            addField(display,fields,'displayWidth','최대 너비',c.displayWidth,{type:'number',min:240,max:1200,step:1});
            addField(display,fields,'compact','작게 표시',c.compact,{type:'checkbox'});
            saveBar(page,()=>api.saveSettings({...api.settings(),...readFields(fields)}));
            const presets=settingGroup(page,'프리셋 · 백업',true);
            const presetName=field('이름','');presets.append(presetName.wrap);
            presets.append(button('프리셋 저장',()=>{const name=presetName.read().trim();if(!name)throw new Error('프리셋 이름을 입력하세요.');const latest=api.settings(),list=[...(latest.presets??[])];if(list.some(p=>p.name===name))throw new Error('같은 이름의 프리셋이 있습니다.');list.push({name,config:readFields(fields)});api.saveSettings({...latest,...readFields(fields),presets:list});return open('generation',true);},false,'fa-plus'));
            for(const p of c.presets??[]){const row=el('div','ap2-preset-row');row.append(el('span','',p.name),button('적용',()=>{api.saveSettings({...api.settings(),...p.config,automatic:'off'});return open('generation',true);}),button('삭제',async()=>{if(!await confirmAction('프리셋 삭제',`“${p.name}”을 삭제할까요?`))return;const latest=api.settings();api.saveSettings({...latest,presets:latest.presets.filter(item=>item.name!==p.name)});return open('generation',true);}));presets.append(row);}
            const transfer=el('div','ap2-actions');presets.append(transfer);
            transfer.append(button('이전 설정',()=>{const entries=api.settingsHistory(),{dialog,body}=modal('이전 설정');if(!entries.length){body.append(el('p','','저장된 이전 설정이 없습니다. 다음 변경부터 자동 보관합니다.'));return;}for(const entry of entries){const row=el('div','ap2-card');row.append(el('strong','',`${new Date(entry.time).toLocaleString()} · ${entry.reason}`),el('p','ap2-muted',`${MODELS[entry.settings.model]?.label??entry.settings.model??'기존 설정'} · ${entry.settings.width??'?'} × ${entry.settings.height??'?'}`),button('복구',()=>{api.restoreSettings(entry.settings);dialog.close();return open('generation',true);}));body.append(row);}}));
            transfer.append(button('내보내기',()=>downloadJson({schema:1,settings:api.settings()},'scenebook-settings.json'),false,'fa-file-export'));
            const upload=el('input');upload.type='file';upload.accept='.json';upload.hidden=true;
            transfer.append(upload,button('가져오기',()=>upload.click(),false,'fa-file-import'));
            upload.addEventListener('change',async()=>{try{const file=upload.files[0];if(!file)return;if(file.size>1000000)throw new Error('1MB 이하 설정 파일을 선택하세요.');api.importSettings(JSON.parse(await file.text()));await open('generation',true);notice('설정을 가져왔습니다. 자동 생성은 꺼져 있습니다.');}catch(e){notice(e.message,true);}});
        }
        if(id==='characters') {
            const choices=[['account','계정 전체'],...(api.visualCharacterKey()?[['character','현재 캐릭터']]:[]),...(api.hasChat()?[['chat','현재 채팅']]:[])];
            if(!choices.some(([where])=>where===characterScope))characterScope=api.visualScope();
            const editingScope=characterScope,c=api.visualSettings(editingScope),fields={},contextKey=api.contextKey();page.dataset.contextKey=contextKey;
            const toolbar=el('div','ap2-actions');toolbar.append(button('인물 추가',()=>{remember();drafts.push({id:crypto.randomUUID(),name:'',appearance:'',outfit:'',negative:''});render(true);},false,'fa-plus'),button('캐릭터 가져오기',()=>{const ch=api.character();if(!ch)throw new Error('현재 캐릭터가 없습니다.');remember();drafts.push({id:crypto.randomUUID(),name:ch.name??'',appearance:ch.description??ch.data?.description??'',outfit:'',negative:''});render(true);notice('캐릭터 설명을 가져왔습니다. 외형 묘사를 확인하세요.');},false,'fa-user-plus'));
            const scopeChoice=field('저장 범위',editingScope,{choices}),scopeHelp=el('p','ap2-muted');page.append(scopeChoice.wrap,scopeHelp,toolbar);
            // Selecting a layer reads it; it must never copy the previous layer
            // into the new destination through the automatic input save handler.
            scopeChoice.input.addEventListener('input',event=>event.stopPropagation());
            scopeChoice.input.addEventListener('change',async event=>{
                event.stopPropagation();const next=scopeChoice.read();scopeChoice.input.value=editingScope;scopeChoice.input.disabled=true;
                try{
                    if(page.dataset.dirty==='true'&&!await confirmAction('범위 변경','저장되지 않은 입력을 버리고 다른 범위를 열까요?','전환'))return;
                    if(contextKey!==api.contextKey()||!page.isConnected)return;
                    characterScope=next;await open('characters',true);
                }catch(error){notice(error.message,true);}finally{scopeChoice.input.disabled=false;}
            });
            const world=settingGroup(page,'세계관 · 연출',true);
            addField(world,fields,'world','세계관',c.world,{multiline:true,help:'시대·건축·문화권의 기본값. 본문에 명시된 사실을 우선합니다.'});
            addField(world,fields,'direction','연출 지시',c.direction,{multiline:true});
            addField(world,fields,'playerMode','플레이어',c.playerMode,{choices:[['auto','본문에 따라 판단'],['pov','화면 밖 · POV'],['visible','등장 가능']]});
            const list=el('div','ap2-stack'); page.append(list);
            let drafts=structuredClone(c.library);const history=[];const remember=()=>{history.push(structuredClone(drafts));if(history.length>20)history.shift();};
            const undo=button('되돌리기',()=>{if(!history.length)return;drafts=history.pop();render(true);});toolbar.append(undo);
            const render=(save=false)=>{undo.disabled=!history.length;list.replaceChildren();if(!drafts.length)list.append(el('p','ap2-empty','등록한 인물이 없습니다.'));for(const [i,item]of drafts.entries()){
                const card=el('details','ap2-character'), f={};card.open=drafts.length===1||!item.name;const title=el('summary','',item.name||'새 인물');card.append(title);
                for(const [key,label,multi]of [['name','이름',false],['appearance','고정 외형',true],['outfit','기본 복장',true],['negative','인물 제외 요소',true]])addField(card,f,key,label,item[key]??'',{multiline:multi});
                addField(card,f,'player','플레이어 캐릭터',item.player,{type:'checkbox'});
                card.addEventListener('input',()=>{Object.assign(item,readFields(f));title.textContent=item.name||'새 인물';});
                const variants=el('details','ap2-character');variants.append(el('summary','',`다른 외형 프로필 · ${(item.profiles??[]).length}개`));
                item.profiles??=[];
                for(const [pi,profile]of item.profiles.entries()){
                    const row=el('div','ap2-card'),pf={};
                    for(const [key,label]of [['name','프로필 이름'],['condition','이 외형을 쓰는 조건'],['appearance','이 외형의 고정 특징'],['outfit','이 외형의 기본 복장']])addField(row,pf,key,label,profile[key]??'',{multiline:key!=='name'});
                    row.addEventListener('input',()=>Object.assign(profile,readFields(pf)));
                    row.append(button('삭제',async()=>{if(!await confirmAction('외형 삭제',`“${profile.name||'이 외형'}”을 삭제할까요?`))return;remember();item.profiles.splice(pi,1);render(true);}));variants.append(row);
                }
                variants.append(button('외형 추가',()=>{if(item.profiles.length>=10)throw new Error('외형 프로필은 최대 10개입니다.');remember();item.profiles.push({id:crypto.randomUUID(),name:'새 외형',condition:'',appearance:'',outfit:''});render(true);}));card.append(variants);
                const actions=el('div','ap2-actions');const up=button('위로',()=>{if(!i)return;remember();[drafts[i-1],drafts[i]]=[drafts[i],drafts[i-1]];render(true);}),down=button('아래로',()=>{if(i>=drafts.length-1)return;remember();[drafts[i+1],drafts[i]]=[drafts[i],drafts[i+1]];render(true);});up.disabled=i===0;down.disabled=i===drafts.length-1;actions.append(up,down,button('삭제',async()=>{if(!await confirmAction('인물 삭제',`“${item.name||'이 인물'}”을 라이브러리에서 삭제할까요? 인물 탭을 떠나기 전 되돌리기로 복구할 수 있습니다.`))return;remember();drafts.splice(i,1);render(true);}));card.append(actions);list.append(card);
            }if(save)page.dispatchEvent(new Event('input'));};render();
            const readVisual=()=>({...readFields(fields),library:structuredClone(drafts)});
            saveBar(page,()=>api.saveVisual(readVisual(),editingScope,contextKey));
            const copyActions=choices.filter(([where])=>where!==editingScope).map(([where,label])=>({label:`${label}로 복사`,icon:'fa-copy',run:async()=>{
                const value=readVisual();
                if(api.hasVisualOverride(where)&&!await confirmAction('인물 설정 복사',`${label}의 기존 인물·세계관 설정을 현재 편집 내용으로 바꿀까요?`,'복사'))return;
                await api.saveVisual(value,where,contextKey);
                if(contextKey!==api.contextKey())return;
                characterScope=where;await open('characters',true);notice(`${label}로 복사했습니다.`);
            }}));
            if(copyActions.length)toolbar.append(actionMenu(copyActions,'다른 범위로 복사'));
            const inherited=editingScope==='chat'&&api.visualCharacterKey()&&api.hasVisualOverride('character')?'캐릭터 설정 사용':'전체 설정 사용';
            const reset=button(inherited,async()=>{
                if(!await confirmAction('설정 범위 해제','이 범위에 저장한 인물·세계관 설정을 해제하고 상위 범위의 설정을 사용할까요?','해제'))return;
                await api.resetVisual(editingScope,contextKey);if(contextKey===api.contextKey())await open('characters',true);
            });
            if(editingScope!=='account')page.append(reset);
            const refreshScope=()=>{
                reset.disabled=!api.hasVisualOverride(editingScope);
                const label={account:'계정 전체',character:'현재 캐릭터',chat:'현재 채팅'},active=api.visualScope();
                const range=editingScope==='character'?`캐릭터: ${api.character()?.name??''} · 같은 캐릭터의 모든 채팅에 저장합니다.`:editingScope==='chat'?'이 채팅에만 저장합니다.':'모든 캐릭터·채팅의 기본값입니다.';
                scopeHelp.textContent=`${range} 적용 우선순위: 채팅 → 캐릭터 → 전체. 현재 적용: ${label[active]}.${!api.visualCharacterKey()?' 캐릭터 범위는 1:1 채팅에서 설정합니다.':''}`;
            };
            page.addEventListener('scenebook-visual-status',refreshScope);refreshScope();
            page.append(button('다시 불러오기',()=>open('characters',true)));
        }
        if(id==='references') {
            const c=api.settings(),selected=structuredClone(c.references??[]);
            page.append(el('p','ap2-muted','V4.5에서 사용할 이미지 참조입니다. V5는 지원하지 않습니다.'));
            const input=el('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;page.append(input);
            const upload=button('이미지 추가',()=>input.click(),false,'fa-plus');page.append(upload);
            input.addEventListener('change',async()=>{try{input.disabled=true;const f=input.files?.[0];if(!f)return;await api.uploadReference({label:f.name,image:await prepareReference(f)});notice('레퍼런스를 등록했습니다.');await open('references',true);}catch(e){notice(e.message,true);}finally{input.disabled=false;}});
            let refs;try{refs=await api.references();}catch{page.dataset.failed='true';upload.disabled=true;page.append(el('p','ap2-empty','서버 연결 후 참조 이미지를 관리할 수 있습니다.'));return;}if(cached.get(id)!==page)return;const rows=[];
            if(!refs.length)page.append(el('p','ap2-empty','등록한 참조 이미지가 없습니다.'));
            for(const ref of refs){const card=el('div','ap2-card'),f={},saved=selected.find(x=>x.id===ref.id);
                const heading=el('div','ap2-reference-heading');heading.append(el('strong','',ref.label),iconButton('참조 삭제','fa-trash-can',async()=>{
                    if(!await confirmAction('참조 삭제',`“${ref.label}”을 삭제할까요? 업로드한 원본을 서버에서 삭제하고 적용 목록과 프리셋에서도 해제합니다. 이미 생성한 삽화는 유지됩니다.`))return;
                    await api.deleteReference(ref.id);
                    const index=rows.findIndex(row=>row.id===ref.id);if(index>=0)rows.splice(index,1);card.remove();
                    if(!rows.length&&!page.querySelector('.ap2-empty'))page.append(el('p','ap2-empty','등록한 참조 이미지가 없습니다.'));
                    notice('참조 이미지를 삭제했습니다.');
                }));card.append(heading);
                if(api.isImage(ref.url)){const img=el('img');img.src=ref.url;img.alt=ref.label;img.style.maxHeight='160px';img.style.maxWidth='100%';img.loading='lazy';card.append(img);}
                addField(card,f,'enabled','이 레퍼런스 적용',!!saved,{type:'checkbox'});
                addField(card,f,'kind','용도',saved?.kind??'vibe',{choices:[['vibe','Vibe · 그림체/분위기'],['precise','Precise · 인물/스타일']]});
                addField(card,f,'mode','Precise 모드',saved?.mode??'character',{choices:[['character','인물'],['style','스타일'],['character&style','인물과 스타일']]});
                for(const [key,label,value]of [['strength','강도',0.6],['fidelity','Precise 충실도',1],['information','Vibe 정보량',1]])addField(card,f,key,label,saved?.[key]??value,{type:'number',min:0,max:1,step:0.05});
                rows.push({id:ref.id,read:()=>({id:ref.id,...readFields(f)})});page.append(card);
            }
            if(refs.length)saveBar(page,()=>{const references=rows.map(row=>row.read()).filter(r=>r.enabled).map(({enabled,...r})=>r);api.saveSettings({...api.settings(),references});});
            page.append(button('모두 해제',()=>{api.saveSettings({...api.settings(),references:[]});return open('references',true);}));
        }
        if(id==='gallery') {
            await mountGallery(page,api,()=>open('gallery',true),()=>cached.get(id)===page&&page.isConnected);
        }
        if(id==='queue'){
            const actions=el('div','ap2-actions');actions.append(button(api.queuePaused()?'재개':'일시정지',()=>{api.toggleQueue();return open('queue');}),button('대기 취소',()=>{api.cancelQueue();return open('queue');}),actionMenu([{label:'새로고침',icon:'fa-rotate-right',run:()=>open('queue')},{label:'지시 기록',icon:'fa-file-lines',run:()=>api.showPlans()}]));page.append(actions);
            page.append(el('p','ap2-muted',`이번 접속 이미지 요청 ${api.usage()}회`));
            page.append(button('계정 사용량',async()=>{const account=await api.account(),{body}=modal('계정 사용량');body.append(el('p','',`구독 ${account.active?'활성':'비활성'} · 등급 ${account.tier??'확인 불가'}`));body.append(el('p','',`잔여 Anlas ${account.trainingStepsLeft?Number(account.trainingStepsLeft.fixedTrainingStepsLeft??0)+Number(account.trainingStepsLeft.purchasedTrainingSteps??0):'확인 불가'}`));}));
            if(!api.queue().length)page.append(el('p','ap2-empty','진행 중인 작업이 없습니다.'));
            for(const item of [...api.queue()].reverse()){const row=el('div','ap2-card');row.append(el('strong','',item.label||'삽화'),el('p','',`${item.state}${item.error?' · '+item.error:''}`));page.append(row);}
        }
    };
    tabs.forEach(([id,label,icon])=>{const b=button(label,()=>open(id),false,icon);b.classList.remove('menu_button','menu_button_icon');b.classList.add('ap2-tab');b.dataset.page=id;b.id=`${instanceId}-tab-${id}`;b.setAttribute('role','tab');b.setAttribute('aria-controls',`${instanceId}-page-${id}`);nav.append(b);});
    nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...nav.children],index=buttons.findIndex(b=>b.dataset.page===activeId),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();});
    const refreshCharacters=()=>{const page=cached.get('characters');if(!body.isConnected||!page)return;page.dispatchEvent(new Event('scenebook-visual-status'));if(page.dataset.dirty==='true')return;if(activeId==='characters')void open('characters',true);else{page.remove();cached.delete('characters');}};
    const refreshSettings=()=>{if(body.isConnected&&cached.has('generation')&&cached.get('generation').dataset.dirty!=='true'){if(activeId==='generation')void open('generation',true);else{cached.get('generation').remove();cached.delete('generation');}}refreshCharacters();};
    const refreshContext=()=>{characterScope=null;const page=cached.get('characters');if(page?.dataset.dirty==='true')notice('저장되지 않은 인물 입력이 있었습니다. 이전 채팅에는 마지막으로 저장된 설정이 유지됩니다.');page?.remove();cached.delete('characters');if(body.isConnected&&activeId==='characters')void open('characters',true);};
    document.addEventListener('scenebook-settings-changed',refreshSettings);document.addEventListener('scenebook-visual-changed',refreshCharacters);document.addEventListener('scenebook-context-changed',refreshContext);
    if(!host)dialog.addEventListener('close',()=>{document.removeEventListener('scenebook-settings-changed',refreshSettings);document.removeEventListener('scenebook-visual-changed',refreshCharacters);document.removeEventListener('scenebook-context-changed',refreshContext);},{once:true});
    void check();void open('generation');

}
async function mountGallery(page,api,refresh,isCurrent) {
    const bar=el('div','ap2-gallery-toolbar'),search=el('input'),filter=el('select');
    search.type='search';search.placeholder='제목·프롬프트 검색';search.setAttribute('aria-label','갤러리 검색');
    filter.setAttribute('aria-label','갤러리 범위');
    for(const [value,label]of [['done','전체 삽화'],['chat','이 채팅'],['failed','미완료']]){const option=el('option','',label);option.value=value;filter.append(option);}
    bar.append(search,filter,actionMenu([{label:'새로고침',icon:'fa-rotate-right',run:refresh},{label:'채팅 내보내기',icon:'fa-file-export',run:()=>api.exportChat()}]));
    const count=el('p','ap2-muted'),list=el('div','ap2-gallery'),pager=el('div','ap2-gallery-pager');count.setAttribute('role','status');
    page.append(bar,count,list,pager);count.textContent='그림을 불러오는 중…';
    const scope=api.contextKey(),chatJobs=api.chatImages(),chatIds=new Set(chatJobs.map(j=>j.id));let recent=[],failure='';
    try{recent=await api.jobs();}catch(e){failure=e.message;}
    if(!isCurrent())return;
    if(scope!==api.contextKey()){count.textContent='채팅이 바뀌었습니다. 새로고침을 눌러 주세요.';return;}
    // Retain older images saved with this chat, even beyond the server's recent
    // 100-record window. Deduplicate regenerated images by their stable job ID.
    const jobs=[...new Map([...chatJobs,...recent].map(job=>[job.id,job])).values()].sort((a,b)=>new Date(b.created)-new Date(a.created));
    let pageIndex=0;const size=24;
    const previous=iconButton('이전 페이지','fa-chevron-left',()=>{pageIndex--;render();}),next=iconButton('다음 페이지','fa-chevron-right',()=>{pageIndex++;render();}),pageNumber=el('span','ap2-muted');pager.append(previous,pageNumber,next);
    function render(){
        const query=search.value.trim().toLocaleLowerCase();
        const matches=jobs.filter(job=>{
            const ready=job.status==='done'&&api.isImage(job.url);
            if(filter.value==='failed'?ready:!ready)return false;
            if(filter.value==='chat'&&!chatIds.has(job.id))return false;
            return !query||[job.scene?.title,job.scene?.prompt,...(job.scene?.characters??[]).map(c=>c.name)].join(' ').toLocaleLowerCase().includes(query);
        });
        const pages=Math.max(1,Math.ceil(matches.length/size));pageIndex=Math.max(0,Math.min(pageIndex,pages-1));list.replaceChildren();
        count.textContent=`${matches.length}개 · ${filter.value==='chat'?'현재 채팅':`최근 서버 기록${recent.length>=100?' 100개':''} + 현재 채팅`}${failure?' · 서버 기록을 불러오지 못했습니다':''}`;count.title=failure;
        if(!matches.length)list.append(el('p','ap2-empty',query?'검색 결과가 없습니다.':'표시할 그림이 없습니다.'));
        for(const job of matches.slice(pageIndex*size,(pageIndex+1)*size)){
            const title=job.scene?.title||'삽화',ready=job.status==='done'&&api.isImage(job.url);
            const card=button('',()=>{
                if(!ready){const {body}=modal(title);body.append(el('p','',job.error||'결과가 아직 확정되지 않았습니다.'),button('생성 기록',()=>inspect(job)));return;}
                const ensureScope=()=>{if(scope!==api.contextKey())throw new Error('채팅이 바뀌었습니다. 갤러리를 새로고침해 주세요.');};
                viewer(job,{actions:[
                    {label:'삽입',icon:'fa-plus',close:true,run:()=>{ensureScope();return api.recover(job);}},
                    {label:'편집',icon:'fa-sliders',close:true,run:()=>{ensureScope();return api.importScene(job.scene,job.config);}},
                ],more:[{label:'AI 검수',run:()=>api.review(job)},{label:'생성 기록',run:()=>inspect(job)}]});
            });
            card.className='ap2-gallery-item';card.replaceChildren();card.title=title;card.setAttribute('aria-label',`${title} · ${ready?'이미지 보기':'작업 확인'}`);
            if(ready){const img=el('img');img.src=job.url;img.loading='lazy';img.decoding='async';img.alt='';card.append(img);}
            else card.append(el('span','ap2-gallery-failed',job.status==='failed'?'실패':job.status==='running'?'생성 중':'확인 필요'));
            card.append(el('span','ap2-gallery-title',title));list.append(card);
        }
        previous.disabled=pageIndex===0;next.disabled=pageIndex>=pages-1;pageNumber.textContent=`${pageIndex+1} / ${pages}`;pager.hidden=pages<2;
    }
    for(const control of [search,filter])control.addEventListener('input',()=>{pageIndex=0;render();});render();
}
export function inspect(job) {
    const {body}=modal('생성 기록',`Seed ${job.seed} · ${MODELS[job.config?.model]?.label??job.config?.model??''}`);
    const pre=el('pre','ap2-code',JSON.stringify({scene:job.scene,config:job.config,seed:job.seed,review:job.review},null,2));body.append(pre,button('다운로드',()=>downloadJson(job,'scenebook-image-record.json')));
}
export function viewer(job,{actions=[],more=[]}={}) {
    if(!safeImagePath(job.url))throw new Error('이미지 경로를 확인할 수 없습니다.');
    const {dialog,body}=modal(job.scene?.title??'삽화');dialog.classList.add('ap2-viewer');
    const img=el('img','ap2-full');img.src=job.url;img.alt=job.scene?.title??'삽화';body.append(img);
    const footer=el('footer','ap2-footer ap2-viewer-footer');
    const run=item=>{if(item.close)dialog.close();return item.run();};
    for(const item of actions)footer.append(button(item.label,()=>run(item),false,item.icon??''));
    const download=el('a','ap2-button ap2-icon-button');download.href=job.url;download.download=`${job.id}.png`;download.title='원본 PNG 저장';download.setAttribute('aria-label','원본 PNG 저장');
    const glyph=el('i','fa-solid fa-download');glyph.setAttribute('aria-hidden','true');download.append(glyph);footer.append(download);
    if(more.length)footer.append(actionMenu(more.map(item=>({...item,run:()=>run(item)}))));
    dialog.append(footer);return dialog;
}
export function compareVersions(versions,currentIndex){
    const {body}=modal('결과 비교');
    if(versions.length<2){body.append(el('p','','비교할 이전 결과가 없습니다.'));return;}
    const choices=versions.map((j,i)=>[String(i),`${i+1} · Seed ${j.seed}`]);
    const grid=el('div','ap2-compare');body.append(grid);
    for(const [label,start]of [['이전 결과',currentIndex===0?1:currentIndex-1],['현재 결과',currentIndex]]){
        const pane=el('section'),select=field(label,String(start),{choices}),image=el('img','ap2-compare-image'),info=el('p','ap2-muted');
        const show=()=>{const job=versions[Number(select.read())];if(!safeImagePath(job.url)){image.removeAttribute('src');info.textContent='이미지 경로를 확인할 수 없습니다.';return;}image.src=job.url;image.alt=job.scene.title;info.textContent=`${MODELS[job.config.model]?.label??job.config.model} · ${job.config.width} × ${job.config.height} · ${job.config.steps} Steps`;};
        select.input.addEventListener('change',show);show();pane.append(select.wrap,image,info);grid.append(pane);
    }
}
export function mountSettings(api,container){
    const drawer=el('div','inline-drawer');drawer.id='ap2-settings';
    const header=el('div','inline-drawer-toggle inline-drawer-header');header.tabIndex=0;header.setAttribute('role','button');header.setAttribute('aria-expanded','false');header.setAttribute('aria-controls','ap2-settings-content');
    const label=el('b','ap2-drawer-title','씬북'),version=el('small','ap2-version','0.4.10'),status=el('small','ap2-muted','');status.id='ap2-status';label.append(version);
    const icon=el('div','inline-drawer-icon fa-solid fa-circle-chevron-down down');icon.setAttribute('aria-hidden','true');header.append(label,status,icon);
    const content=el('div','inline-drawer-content ap2-settings');content.id='ap2-settings-content';content.style.display='none';
    drawer.append(header,content);container.append(drawer);
    header.addEventListener('click',()=>{header.setAttribute('aria-expanded',String(header.getAttribute('aria-expanded')!=='true'));});
    header.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();header.click();}});
    studio(api,content);
    return drawer;
}
