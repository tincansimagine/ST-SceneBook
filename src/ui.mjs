import { MODELS, SAMPLERS, safeImagePath } from '../plugin/core.mjs';
import { prepareReference } from './images.mjs';
import { positionEditor } from './position.mjs';
import { HELP, showGuide } from './guide.mjs';
import { imageImport } from './import-ui.mjs';
import { promptEditor } from './prompt-ui.mjs';
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
export function notice(message, error = false) {
    const box = el('div', `ap2-notice${error ? ' ap2-error' : ''}`, message);
    box.setAttribute('role', error ? 'alert' : 'status');
    (document.querySelector('dialog.ap2-dialog[open]') ?? document.body).append(box);
    setTimeout(() => box.remove(), error ? 12000 : 6000);
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
    dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); });
    for(const event of ['mousedown','pointerdown','click'])dialog.addEventListener(event,e=>e.stopPropagation());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.showModal(); return { dialog, body };
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
export function confirmAction(title,message){
    return new Promise(resolve=>{const {dialog,body}=modal(title);body.append(el('p','',message));const footer=el('footer','ap2-footer');footer.append(button('취소',()=>dialog.close()),button('삭제',()=>{dialog.returnValue='delete';dialog.close();},true));dialog.append(footer);dialog.addEventListener('close',()=>resolve(dialog.returnValue==='delete'),{once:true});footer.querySelector('button').focus();});
}
function settingGroup(parent,title,collapsed=false){
    const group=el(collapsed?'details':'fieldset','ap2-group');
    group.append(el(collapsed?'summary':'legend','',title));
    const content=el('div','ap2-group-content');group.append(content);parent.append(group);return content;
}
function saveBar(page,save){
    const row=el('div','ap2-savebar'),state=el('span','ap2-muted','');
    const update=()=>{state.textContent='변경 사항 있음';page.dataset.dirty='true';};
    page.addEventListener('input',update);page.addEventListener('change',update);
    row.append(state,button('저장',async()=>{await save();page.dataset.dirty='false';state.textContent='저장됨';},true,'fa-floppy-disk'));page.append(row);
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
    const check=async()=>{connectionText.textContent='연결 확인 중';try{const h=await api.health();connectionText.textContent=h.hasKey?'NovelAI 연결 준비됨':'NovelAI 키 미설정';connection.dataset.state=h.hasKey?'ready':'warning';help.hidden=h.hasKey;}catch{connectionText.textContent='서버 플러그인 미연결';connection.dataset.state='warning';help.hidden=false;}};
    connection.append(connectionText,help,button('확인',check,false,'fa-rotate-right'),button('사용법',showGuide,false,'fa-circle-question'));
    const quick=el('div','ap2-quick');quick.append(button('분석',async()=>{dialog.close();await api.compose();},true,'fa-wand-magic-sparkles'),button('직접 작성',async()=>{dialog.close();await api.compose(undefined,true);},false,'fa-pen'),button('이미지 읽기',()=>imageImport(api,()=>open('generation',true)),false,'fa-file-image'));
    const nav = el('nav', 'ap2-tabs'), pages = el('div','ap2-pages');nav.setAttribute('aria-label','씬북 설정');nav.setAttribute('role','tablist');
    body.append(connection,quick,nav,pages);
    const tabs = [ ['generation', '생성','fa-sliders'], ['characters', '인물','fa-user'], ['references','참조','fa-images'], ['gallery', '갤러리','fa-film'], ['queue', '작업','fa-list-check'] ];
    const cached=new Map(),instanceId=`ap2-${crypto.randomUUID()}`;let activeId='generation';
    const open = async (id,refresh=false) => {
        activeId=id;
        nav.querySelectorAll('button').forEach(b => {const active=b.dataset.page===id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
        for(const p of pages.children)p.hidden=true;
        if(cached.has(id)&&!refresh&&!cached.get(id).dataset.failed&&['generation','characters','references'].includes(id)){cached.get(id).hidden=false;return;}
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
            const analysis=settingGroup(page,'장면 분석');
            addField(analysis,fields,'profileId','연결 프로필',c.profileId,{choices:[['','선택 안 함'],...api.profiles().map(p=>[p.id,p.name])]});
            addField(analysis,fields,'analysisMode','분석 방식',c.analysisMode,{choices:[['quick','빠르게'],['precise','정밀하게']],help:'정밀 분석은 복장·외형 시점 확인에 LLM을 한 번 더 호출합니다.'});
            const counts=el('div','ap2-grid');analysis.append(counts);
            addField(counts,fields,'maxScenes','최대 장면',c.maxScenes,{type:'number',min:1,max:6,step:1});
            addField(counts,fields,'contextMessages','이전 메시지',c.contextMessages,{type:'number',min:0,max:30,step:1});
            const prompts=settingGroup(page,'프롬프트',true);
            addField(prompts,fields,'style','그림체',c.style,{multiline:true});
            addField(prompts,fields,'negative','제외 요소',c.negative,{multiline:true,rows:2});
            prompts.append(button('편집 · 공유',()=>promptEditor({...api.settings(),...readFields(fields)},value=>{for(const key of ['style','negative'])fields[key].input.value=value[key];fields.quality.input.checked=value.quality;fields.analysisPrompt={read:()=>value.analysisPrompt};page.dispatchEvent(new Event('input'));}),false,'fa-pen'));
            const automatic=settingGroup(page,'자동 처리',true);
            addField(automatic,fields,'automatic','새 답변',c.automatic,{choices:[['off','사용 안 함'],['review','분석 후 검토'],['generate','분석 후 생성']]});
            const limits=el('div','ap2-grid');automatic.append(limits);
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
            transfer.append(button('내보내기',()=>downloadJson({schema:1,settings:api.settings()},'scenebook-settings.json'),false,'fa-file-export'));
            const upload=el('input');upload.type='file';upload.accept='.json';upload.hidden=true;
            transfer.append(upload,button('가져오기',()=>upload.click(),false,'fa-file-import'));
            upload.addEventListener('change',async()=>{try{const file=upload.files[0];if(!file)return;if(file.size>1000000)throw new Error('1MB 이하 설정 파일을 선택하세요.');api.importSettings(JSON.parse(await file.text()));await open('generation',true);notice('설정을 가져왔습니다. 자동 생성은 꺼져 있습니다.');}catch(e){notice(e.message,true);}});
        }
        if(id==='characters') {
            const c=api.visualSettings(), fields={},contextKey=api.contextKey();
            const toolbar=el('div','ap2-actions');toolbar.append(button('인물 추가',()=>{remember();drafts.push({id:crypto.randomUUID(),name:'',appearance:'',outfit:'',negative:''});render();page.dispatchEvent(new Event('input'));},false,'fa-plus'),button('캐릭터 가져오기',()=>{const ch=api.character();if(!ch)throw new Error('현재 캐릭터가 없습니다.');remember();drafts.push({id:crypto.randomUUID(),name:ch.name??'',appearance:ch.description??ch.data?.description??'',outfit:'',negative:''});render();page.dispatchEvent(new Event('input'));notice('캐릭터 설명을 가져왔습니다. 외형 묘사를 확인하세요.');},false,'fa-user-plus'));page.append(toolbar);
            const scopeChoice=field('저장 범위',api.hasVisualOverride()?'chat':'account',{choices:[['chat','현재 채팅만'],['account','계정 기본값']]});page.append(scopeChoice.wrap);
            const world=settingGroup(page,'세계관 · 연출',true);
            addField(world,fields,'world','세계관',c.world,{multiline:true,help:'시대·건축·문화권의 기본값. 본문에 명시된 사실을 우선합니다.'});
            addField(world,fields,'direction','연출 지시',c.direction,{multiline:true});
            addField(world,fields,'playerMode','플레이어',c.playerMode,{choices:[['auto','본문에 따라 판단'],['pov','화면 밖 · POV'],['visible','등장 가능']]});
            const list=el('div','ap2-stack'); page.append(list);
            let drafts=structuredClone(c.library);const history=[];const remember=()=>{history.push(structuredClone(drafts));if(history.length>20)history.shift();page.dispatchEvent(new Event('input'));};
            const undo=button('되돌리기',()=>{if(!history.length)return;drafts=history.pop();render();page.dispatchEvent(new Event('input'));});toolbar.append(undo);
            const render=()=>{undo.disabled=!history.length;list.replaceChildren();if(!drafts.length)list.append(el('p','ap2-empty','등록한 인물이 없습니다.'));for(const [i,item]of drafts.entries()){
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
                    row.append(button('삭제',async()=>{if(!await confirmAction('외형 삭제',`“${profile.name||'이 외형'}”을 삭제할까요?`))return;remember();item.profiles.splice(pi,1);render();}));variants.append(row);
                }
                variants.append(button('외형 추가',()=>{if(item.profiles.length>=10)throw new Error('외형 프로필은 최대 10개입니다.');remember();item.profiles.push({id:crypto.randomUUID(),name:'새 외형',condition:'',appearance:'',outfit:''});render();}));card.append(variants);
                const actions=el('div','ap2-actions');const up=button('위로',()=>{if(!i)return;remember();[drafts[i-1],drafts[i]]=[drafts[i],drafts[i-1]];render();}),down=button('아래로',()=>{if(i>=drafts.length-1)return;remember();[drafts[i+1],drafts[i]]=[drafts[i],drafts[i+1]];render();});up.disabled=i===0;down.disabled=i===drafts.length-1;actions.append(up,down,button('삭제',async()=>{if(!await confirmAction('인물 삭제',`“${item.name||'이 인물'}”을 라이브러리에서 삭제할까요? 저장 전 되돌리기로 복구할 수 있습니다.`))return;remember();drafts.splice(i,1);render();}));card.append(actions);list.append(card);
            }};render();
            saveBar(page,()=>api.saveVisual({...api.visualSettings(),...readFields(fields),library:drafts},scopeChoice.read(),contextKey));
            page.append(button('기본값 사용',async()=>{await api.resetVisual();await open('characters',true);}));
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
            for(const ref of refs){const card=el('div','ap2-card'),f={},saved=selected.find(x=>x.id===ref.id);card.append(el('strong','',ref.label));
                if(api.isImage(ref.url)){const img=el('img');img.src=ref.url;img.alt=ref.label;img.style.maxHeight='160px';img.style.maxWidth='100%';img.loading='lazy';card.append(img);}
                addField(card,f,'enabled','이 레퍼런스 적용',!!saved,{type:'checkbox'});
                addField(card,f,'kind','용도',saved?.kind??'vibe',{choices:[['vibe','Vibe · 그림체/분위기'],['precise','Precise · 인물/스타일']]});
                addField(card,f,'mode','Precise 모드',saved?.mode??'character',{choices:[['character','인물'],['style','스타일'],['character&style','인물과 스타일']]});
                for(const [key,label,value]of [['strength','강도',0.6],['fidelity','Precise 충실도',1],['information','Vibe 정보량',1]])addField(card,f,key,label,saved?.[key]??value,{type:'number',min:0,max:1,step:0.05});
                rows.push(()=>({id:ref.id,...readFields(f)}));page.append(card);
            }
            if(refs.length)saveBar(page,()=>{const references=rows.map(r=>r()).filter(r=>r.enabled).map(({enabled,...r})=>r);api.saveSettings({...api.settings(),references});});
            page.append(button('모두 해제',()=>{api.saveSettings({...api.settings(),references:[]});return open('references',true);}));
        }
        if(id==='gallery') {
            const actions=el('div','ap2-actions');actions.append(button('새로고침',()=>open('gallery',true),false,'fa-rotate-right'),button('채팅 내보내기',()=>api.exportChat(),false,'fa-file-export'));page.append(actions);
            page.append(el('p','ap2-muted','최근 100개 작업. 완성된 원본을 확인하고 채팅에 다시 삽입합니다.'));
            const list=el('div','ap2-gallery');page.append(list);
            let jobs;try{jobs=await api.jobs();}catch{list.append(el('p','ap2-empty','서버 연결 후 생성 기록을 확인할 수 있습니다.'));return;}
            if(!jobs.length)list.append(el('p','ap2-empty','아직 생성한 그림이 없습니다.'));
            for(const job of jobs){const card=el('article','ap2-card');
                card.append(el('strong','',job.scene?.title??'작업'),el('small','ap2-muted',`${new Date(job.created).toLocaleString()} · ${job.status}`));
                if(job.status==='done'&&api.isImage(job.url)){
                    const img=el('img');img.src=job.url;img.loading='lazy';img.alt=job.scene?.title??'삽화';card.append(img);
                    card.append(button('크게 보기',()=>viewer(job)),button('삽입',()=>api.recover(job)),button('AI 검수',()=>api.review(job)),button('설정 보기',()=>inspect(job)));
                }else card.append(el('p','ap2-muted',job.error??'서버가 결과를 확정하지 못했습니다. 이 작업은 자동 재전송하지 않습니다.'));
                list.append(card);
            }
        }
        if(id==='queue'){
            const actions=el('div','ap2-actions');actions.append(button('정지 / 재개',()=>{api.toggleQueue();return open('queue');}),button('대기 취소',()=>{api.cancelQueue();return open('queue');}),button('새로고침',()=>open('queue')));page.append(actions);
            page.append(el('p','ap2-muted',`이번 접속 이미지 요청 ${api.usage()}회`));
            page.append(button('계정 사용량',async()=>{const account=await api.account(),{body}=modal('계정 사용량');body.append(el('p','',`구독 ${account.active?'활성':'비활성'} · 등급 ${account.tier??'확인 불가'}`));body.append(el('p','',`잔여 Anlas ${account.trainingStepsLeft?Number(account.trainingStepsLeft.fixedTrainingStepsLeft??0)+Number(account.trainingStepsLeft.purchasedTrainingSteps??0):'확인 불가'}`));}));
            if(!api.queue().length)page.append(el('p','ap2-empty','진행 중인 작업이 없습니다.'));
            for(const item of [...api.queue()].reverse()){const row=el('div','ap2-card');row.append(el('strong','',item.label||'삽화'),el('p','',`${item.state}${item.error?' · '+item.error:''}`));page.append(row);}
        }
    };
    tabs.forEach(([id,label,icon])=>{const b=button(label,()=>open(id),false,icon);b.classList.remove('menu_button','menu_button_icon');b.classList.add('ap2-tab');b.dataset.page=id;b.id=`${instanceId}-tab-${id}`;b.setAttribute('role','tab');b.setAttribute('aria-controls',`${instanceId}-page-${id}`);nav.append(b);});
    nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...nav.children],index=buttons.findIndex(b=>b.dataset.page===activeId),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();});
    const refreshSettings=()=>{if(body.isConnected&&cached.has('generation')&&cached.get('generation').dataset.dirty!=='true'){if(activeId==='generation')void open('generation',true);else{cached.get('generation').remove();cached.delete('generation');}}};
    document.addEventListener('scenebook-settings-changed',refreshSettings);if(!host)dialog.addEventListener('close',()=>document.removeEventListener('scenebook-settings-changed',refreshSettings),{once:true});
    void check();void open('generation');

}
export function inspect(job) {
    const {body}=modal('생성 기록',`Seed ${job.seed} · ${MODELS[job.config?.model]?.label??job.config?.model??''}`);
    const pre=el('pre','ap2-code',JSON.stringify({scene:job.scene,config:job.config,seed:job.seed,review:job.review},null,2));body.append(pre,button('다운로드',()=>downloadJson(job,'scenebook-image-record.json')));
}
export function viewer(job) {
    const {body}=modal(job.scene?.title??'삽화'); const img=el('img','ap2-full');img.src=job.url;img.alt=job.scene?.title??'삽화';
    const a=el('a','ap2-button','원본 PNG 다운로드');a.href=job.url;a.download=`${job.id}.png`;body.append(img,a);
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
    const label=el('b','ap2-drawer-title','씬북'),version=el('small','ap2-version','0.3.0'),status=el('small','ap2-muted','');status.id='ap2-status';label.append(version);
    const icon=el('div','inline-drawer-icon fa-solid fa-circle-chevron-down down');icon.setAttribute('aria-hidden','true');header.append(label,status,icon);
    const content=el('div','inline-drawer-content ap2-settings');content.id='ap2-settings-content';content.style.display='none';
    drawer.append(header,content);container.append(drawer);
    header.addEventListener('click',()=>{header.setAttribute('aria-expanded',String(header.getAttribute('aria-expanded')!=='true'));});
    header.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();header.click();}});
    studio(api,content);
    return drawer;
}
