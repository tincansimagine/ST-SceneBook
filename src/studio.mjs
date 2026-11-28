import { activePreset, inPresetStyle } from './presets.mjs';
import { PAGE_FORMATS, PANEL_COUNTS, SCENE_COUNTS, CUT_LAYOUTS } from './comic.mjs';
import { MODELS, SAMPLERS, usableReferences } from '../plugin/core.mjs';
import { CLIENT_VERSION, serverAtLeast } from './server-health.mjs';
import { showGuide } from './guide.mjs';
import { imageImport } from './import-ui.mjs';
import { promptEditor } from './prompt-ui.mjs';
import { workflowEnabled } from './automatic.mjs';
import { applyFrame, frameChoices } from './frames-ui.mjs';
import { LOOKS } from './framing.mjs';
import { UC_PRESETS, mergeTags } from './tag-rules.mjs';
import { INKS } from './ornaments.mjs';
import { charactersPage } from './characters-ui.mjs';
import { referencesPage } from './reference-ui.mjs';
import { galleryPage } from './gallery-ui.mjs';
import { el, button, iconButton, actionMenu, modal, field, addField, readFields, segmented, choiceChips, section, foldout, saveBar, confirmAction, downloadJson, notice, syncTone, fitText, setText, setFlag } from './ui.mjs';

const PAGES=[
    ['home','시작','fa-house'],['prompt','프롬프트','fa-pen-nib'],['image','그림 설정','fa-sliders'],['characters','인물','fa-user'],
    ['references','참조','fa-images'],['display','표시','fa-eye'],['gallery','갤러리','fa-film'],['queue','작업','fa-list-check'],
];
// Pages whose content comes from the saved settings.
const SETTINGS=['prompt','image','display','references'];
const SIZES=[['portrait','세로',832,1216],['landscape','가로',1216,832],['square','정사각',1024,1024]];

function installationHelp(){
    const {body}=modal('연결 안내');
    body.append(el('p','','이미지 생성에는 씬북 서버 플러그인과 NovelAI 키가 필요합니다.'));
    const steps=el('ol','ap2-help-steps');
    for(const message of ['씬북 확장 폴더의 server-plugin/autopic2 폴더를 SillyTavern/plugins/autopic2에 복사합니다. (확장 폴더에서 node install-server.mjs를 실행해도 됩니다.)','SillyTavern의 config.yaml에서 enableServerPlugins를 true로 바꾸고 서버를 완전히 껐다가 다시 켭니다.','SillyTavern의 API 연결에서 NovelAI를 고르고 키를 저장한 뒤, 시작 탭의 다시 확인을 누릅니다.'])steps.append(el('li','',message));body.append(steps);
}
// The same on/off and mode controls appear in the drawer and in the window.
const RECOMMENDED_RESPONSE=40000;
function workflowControls(api){
    const toggle=field('자동 삽화',workflowEnabled(api.settings()),{type:'checkbox'}),help=el('p','ap2-muted'),status=el('p','ap2-workflow-status');status.setAttribute('role','status');
    const mode=segmented('처리 방식',[['generate','바로 그리기'],['review','초안만 저장']],api.settings().automatic==='review'?'review':'generate',value=>api.saveSettings({...api.settings(),automatic:value}));
    toggle.wrap.classList.add('ap2-workflow-toggle');
    toggle.input.addEventListener('change',()=>{const c=api.settings(),on=toggle.read();api.saveSettings({...c,promptInjection:on,automatic:on&&c.automatic==='off'?'generate':c.automatic});});
    // Where the scenes are written: at the end of the reply, or by a helper model once the reply is in.
    const source=segmented('장면 쓰는 곳',[['reply','답변에 함께'],['separate','답변 후 보조 모델']],api.settings().planSource==='separate'?'separate':'reply',value=>api.saveSettings({...api.settings(),planSource:value}));
    const sourceRow=el('div','ap2-quick-shape');sourceRow.append(el('span','','장면 쓰는 곳'),source.wrap);
    sourceRow.title='답변에 함께: 대화 AI가 답변 끝에 장면을 같이 씁니다. 답변 후 보조 모델: 답변에는 아무것도 넣지 않고, 답변이 오면 고른 연결 프로필로 따로 장면을 씁니다.';
    const helper=el('div','ap2-grid'),saved=api.settings();
    const profile=field('보조 모델 연결 프로필',saved.separateProfileId??'',{choices:[['','현재 채팅 연결'],...api.profiles().map(p=>[p.id,p.name])]});
    const length=field('최대 응답 길이 (토큰)',saved.separateLength??16000,{type:'number',min:1000,max:128000,step:1000});
    helper.append(profile.wrap,length.wrap);
    const saveHelper=(key,value)=>{try{api.saveSettings({...api.settings(),[key]:value});}catch(e){notice(e.message,true);}};
    profile.input.addEventListener('change',()=>saveHelper('separateProfileId',profile.read()));
    length.input.addEventListener('change',()=>saveHelper('separateLength',length.read()));
    // Scenes written at the end of the reply need room after the story: suggest a response length that leaves it.
    const advice=el('div','ap2-note ap2-response-advice'),adviceText=el('p','');
    const adviceButton=button(`${RECOMMENDED_RESPONSE.toLocaleString()}으로 설정`,()=>{api.setResponseLength(RECOMMENDED_RESPONSE);notice(`최대 응답 길이를 ${RECOMMENDED_RESPONSE.toLocaleString()} 토큰으로 바꿨습니다. 프리셋을 저장해 두면 다음에도 유지됩니다.`);refresh();},false,'fa-arrows-up-to-line');
    advice.append(adviceText,adviceButton);
    const refresh=()=>{
        const c=api.settings(),on=workflowEnabled(c),every=c.every===1?'답변마다':`답변 ${c.every}개마다`,separate=c.planSource==='separate';
        toggle.input.checked=on;mode.set(c.automatic==='review'?'review':'generate');if(mode.wrap.hidden!==!on)mode.wrap.hidden=!on;
        source.set(separate?'separate':'reply');sourceRow.hidden=!on;helper.hidden=!on||!separate;
        if(document.activeElement!==profile.input)profile.input.value=c.separateProfileId??'';
        if(document.activeElement!==length.input)length.input.value=String(c.separateLength??16000);
        setText(help,!on?'꺼져 있습니다. 답변에 삽화 지시를 넣지 않고 자동으로 그리지도 않습니다. 필요할 때 수동 생성으로 그릴 수 있습니다.'
            :separate?(c.automatic==='review'?'답변이 오면 보조 모델이 따로 장면을 써서 초안으로만 저장합니다. 답변에는 삽화 지시가 들어가지 않습니다.'
                :`답변이 오면 보조 모델이 따로 장면을 쓰고, ${every} 그림을 자동으로 만들어 넣습니다. 답변에는 삽화 지시가 들어가지 않습니다.`)
            :c.automatic==='review'?'AI가 답변과 함께 쓴 삽화 지시를 초안으로만 저장합니다. 확인한 뒤 직접 생성하세요.'
            :`AI가 답변과 함께 삽화 지시를 쓰고, ${every} 그림을 자동으로 만들어 답변 아래에 넣습니다.`);
        const reply=api.responseLength(),short=reply.chat?reply.value<RECOMMENDED_RESPONSE:true;
        advice.hidden=!on||separate||!short;adviceButton.hidden=!reply.chat;
        setText(adviceText,reply.chat
            ?`답변 끝에 장면을 같이 쓰기 때문에, 답변이 잘리지 않게 최대 응답 길이를 ${RECOMMENDED_RESPONSE.toLocaleString()} 토큰으로 두는 걸 권장합니다. 지금 ${reply.value.toLocaleString()} 토큰.`
            :`답변 끝에 장면을 같이 쓰기 때문에 최대 응답 길이를 넉넉히(권장 ${RECOMMENDED_RESPONSE.toLocaleString()} 토큰) 두세요. 지금 연결된 API는 AI 응답 설정에서 직접 바꿔 주세요.`);
        const text=api.status?.()||'';setText(status,text);if(status.hidden!==!text)status.hidden=!text;
    };
    return{toggle,help,mode,sourceRow,helper,advice,status,refresh};
}
function homePage(page,{api,open,close,listen}){
    const banner=el('p','ap2-ready');banner.setAttribute('role','status');
    const setup=section(page,'먼저 준비할 것','세 가지가 모두 준비되면 그림을 그릴 수 있습니다.');page.prepend(banner);
    const rows={};
    for(const [key,title]of [['server','서버 플러그인'],['key','NovelAI 키'],['chat','채팅']]){
        const row=el('div','ap2-setup-row'),mark=el('i','ap2-setup-mark fa-solid'),text=el('div','ap2-setup-text'),detail=el('p','ap2-muted');mark.setAttribute('aria-hidden','true');
        text.append(el('strong','',title),detail);row.append(mark,text);setup.append(row);
        rows[key]={row,set(state,message){
            const icon=`ap2-setup-mark fa-solid ${state==='ok'?'fa-circle-check':state==='wait'?'fa-circle-notch':'fa-circle-exclamation'}`;
            setFlag(row,'data-state',state);if(mark.className!==icon)mark.className=icon;setText(detail,message);
        }};rows[key].set('wait','확인 중…');
    }
    const help=button('설치 안내',installationHelp,false,'fa-circle-info');rows.server.row.append(help);
    setup.append(button('다시 확인',()=>check(true),false,'fa-rotate-right'));
    const show=(node,visible)=>{if(node.hidden===visible)node.hidden=!visible;};
    async function check(force=false){
        const chat=api.hasChat();rows.chat.set(chat?'ok':'todo',chat?'캐릭터 채팅이 열려 있습니다.':'그림을 넣을 캐릭터 채팅을 열어 주세요.');
        let ready=false,version='';
        try{
            const health=await api.health(force);version=health.version;ready=health.hasKey&&chat;show(help,false);
            rows.server.set('ok',`연결됨 · 서버 ${health.version}`);
            rows.key.set(health.hasKey?'ok':'todo',health.hasKey?'저장되어 있습니다.':'SillyTavern의 API 연결에서 NovelAI를 고르고 키를 저장하세요.');
        }catch(e){show(help,true);rows.server.set('todo',e.message);rows.key.set('wait','서버가 연결되면 확인합니다.');}
        show(setup,!ready);show(banner,ready);
        const old=version&&!serverAtLeast(version,0,5);setFlag(banner,'data-state',old?'warning':'ready');
        setText(banner,old?`준비됐습니다 · 서버 ${version} · V5 참조를 쓰려면 서버 플러그인을 0.5.0으로 교체하세요.`:`준비됐습니다 · 서버 ${version}`);
    }
    banner.hidden=true;
    const auto=section(page,'자동 삽화'),flow=workflowControls(api),limits=el('div','ap2-grid'),fields={},c=api.settings();
    auto.querySelector('.ap2-section-head').replaceWith(flow.toggle.wrap);
    addField(limits,fields,'every','답변 간격',c.every,{type:'number',min:1,max:20,step:1});
    const limitState=el('p','ap2-muted');limitState.setAttribute('role','status');
    limits.addEventListener('change',()=>{try{api.saveSettings({...api.settings(),...readFields(fields)});setText(limitState,'');}catch(e){setText(limitState,`저장 안 됨 · ${e.message}`);}});
    auto.append(flow.help,flow.mode.wrap,flow.sourceRow,flow.helper,flow.advice,limits,limitState,flow.status);
    const actions=section(page,'바로 하기'),quick=el('div','ap2-quick');
    quick.append(
        button('수동 생성',()=>{api.manual();close();},true,'fa-wand-magic-sparkles'),
        button('장면 편집',async()=>{close();await api.compose();},false,'fa-pen'),
        button('이미지에서 설정 읽기',()=>imageImport(api,()=>open('prompt',true)),false,'fa-file-image'),
        button('사용법',showGuide,false,'fa-circle-question'));
    actions.append(quick,el('p','ap2-muted','마지막 답변에 적용됩니다. 다른 답변은 그 답변 메뉴(…)의 마법봉·풍경 아이콘으로, 이미 나온 그림은 그림 위의 연필·회전 화살표로.'));
    // Where each setting lives. The four rows stay; only their text changes.
    const summary=section(page,'지금 설정'),list=el('div','ap2-summary'),values={};summary.append(list);
    for(const [id,title]of [['prompt','프롬프트'],['image','그림 설정'],['characters','인물'],['references','참조']]){
        const row=el('button','ap2-summary-row');row.type='button';values[id]=el('span','ap2-summary-value');
        row.append(el('span','ap2-summary-title',title),values[id],el('i','fa-solid fa-chevron-right'));row.addEventListener('click',()=>void open(id));list.append(row);
    }
    function describe(){
        const s=api.settings(),look=LOOKS.find(([id])=>id===s.look)?.[1],visual=api.visualSettings(),applied=usableReferences(s.model,s.references??[]).length;
        setText(values.prompt,[look&&s.look?`그림체 ${look}`:'',s.style?s.style.slice(0,120):'메인 프롬프트 없음'].filter(Boolean).join(' · '));
        setText(values.image,`${MODELS[s.model]?.label??s.model} · ${s.width} × ${s.height} · ${s.steps} Steps`);
        setText(values.characters,visual.library?.length?visual.library.map(x=>x.name).join(', ').slice(0,120):'등록한 인물 없음');
        setText(values.references,applied?`${applied}장 적용 중`:'사용 안 함');
    }
    // Brought up to date when it is on screen; changes made elsewhere wait until it is shown again.
    let stale=false;
    const refresh=()=>{
        if(page.hidden||!page.isConnected){stale=true;return;}
        stale=false;flow.refresh();describe();const s=api.settings();
        for(const [key,f]of Object.entries(fields))if(document.activeElement!==f.input&&f.input.value!==String(s[key]))f.input.value=s[key];
        show(limits,workflowEnabled(s));
    };
    page.refresh=()=>{if(stale)refresh();else flow.refresh();void check();};
    listen(['scenebook-workflow-status','scenebook-settings-changed','scenebook-visual-changed'],refresh);listen(['scenebook-context-changed'],()=>{if(page.hidden)stale=true;else void check();});
    flow.refresh();describe();show(limits,workflowEnabled(c));void check();
}
function promptPage(page,{api,open}){
    const c=api.settings(),fields={};
    page.append(el('p','ap2-lead','모든 그림에 공통으로 붙는 프롬프트입니다. 장면과 인물은 답변마다 AI가 따로 쓰므로 여기에는 항상 유지할 화풍·품질만 적으면 됩니다.'));
    const looks=section(page,'그림체','고르면 그 화풍의 태그를 메인 프롬프트 앞에 한 번 붙입니다. 쓰지 않아도 됩니다.'),tags=el('p','ap2-muted ap2-look-tags');
    let look=c.look;const showTags=()=>{const item=LOOKS.find(([id])=>id===look);tags.textContent=item?.[0]?`붙는 태그: ${item[2]}`:'';tags.hidden=!item?.[0];};
    looks.append(choiceChips('그림체',LOOKS.map(([id,label,text])=>[id,label,text]),look,value=>{look=value;showTags();page.dispatchEvent(new Event('input'));}).wrap,tags);showTags();
    fields.look={read:()=>look};
    const main=section(page,'메인 프롬프트','화풍·작가·색감처럼 모든 그림에 넣을 태그를 영어로 적습니다.');
    addField(main,fields,'style','메인 프롬프트',c.style,{multiline:true,rows:6,placeholder:'예: anime coloring, soft lighting, detailed background'});
    addField(main,fields,'quality','품질 태그 자동 추가',c.quality,{type:'checkbox',help:`프롬프트 끝에 NovelAI 기본 품질 태그를 붙입니다. 지금 모델(${MODELS[c.model]?.label}): ${MODELS[c.model]?.quality}. 메인 프롬프트에 직접 적었다면 끄세요.`});
    const exclude=section(page,'제외할 요소 (UC)','그림에 나오지 않았으면 하는 것을 적습니다.');
    addField(exclude,fields,'negative','제외할 요소',c.negative,{multiline:true,rows:4});
    // NovelAI's own presets, merged into what is already written.
    const presets=el('div','ap2-actions');
    for(const [label,tags]of UC_PRESETS)presets.append(button(`${label} 넣기`,()=>{fields.negative.input.value=mergeTags(tags,fields.negative.read());fitText(fields.negative.input);page.dispatchEvent(new Event('input'));},false,'fa-plus'));
    exclude.append(presets,el('p','ap2-muted','NovelAI 사이트가 기본으로 넣는 UC입니다. 이미 적은 태그는 그대로 두고 빠진 것만 더합니다. 흑백 만화 그림체를 쓴다면 halftone, screentone은 지우세요.'));
    for(const key of ['style','negative'])fields[key].wrap.classList.add('ap2-field-bare');
    const order=section(page,'전송 순서'),strip=el('ol','ap2-order');
    for(const [i,part]of ['그림체','메인 프롬프트','구도','장면','품질 태그'].entries()){if(i){const arrow=el('li','ap2-order-arrow','→');arrow.setAttribute('aria-hidden','true');strip.append(arrow);}strip.append(el('li','',part));}
    order.append(strip,el('p','ap2-muted','구도와 장면은 AI가 답변마다 쓰며, 그림 위의 연필 버튼으로 그림마다 고칠 수 있습니다. 인물 프롬프트는 인물별로 따로 전송됩니다.'));
    const advanced=foldout(page,'AI 지시문 · 프롬프트 공유');
    addField(advanced,fields,'leanPrompt','간결한 삽화 지시문',c.leanPrompt,{type:'checkbox',help:'대화 AI에 매번 보내는 삽화 지시문을 짧은 버전으로 바꿔 입력 토큰을 줄입니다. 삽화 지시가 자주 빠지면 끄세요.'});
    advanced.append(el('p','ap2-muted','대화 AI에게 삽화 지시를 쓰게 하는 지시문과 수동 분석 지시문을 고치거나, 프롬프트를 파일로 주고받습니다.'),
        button('지시문 편집 · 공유',()=>promptEditor({...api.settings(),...readFields(fields)},value=>{api.saveSettings({...api.settings(),...value});return open('prompt',true);},{initial:'injection'}),false,'fa-pen'));
    saveBar(page,()=>api.saveSettings({...api.settings(),...readFields(fields)}));
}
function imagePage(page,{api,open}){
    const c=api.settings(),fields={};
    // Saved presets switch the art style in one tap; size, seed and automatic illustration stay as they are.
    const quick=section(page,'그림체 프리셋'),applied=activePreset(c);
    if(c.presets?.length){
        const chips=choiceChips('그림체 프리셋',c.presets.map(p=>[p.name,p.name]),applied?.name??'',name=>{const p=api.settings().presets.find(x=>x.name===name);if(!p)return;api.saveSettings(inPresetStyle({...api.settings()},p));notice(`그림체 프리셋 “${name}” 적용 · 다시 그리기도 이 그림체로 그립니다.`);void open('image',true);});
        quick.append(chips.wrap,el('p','ap2-muted',applied?`적용 중 · ${applied.name}`:'적용 중인 프리셋 없음 · 지금 설정이 어느 프리셋과도 같지 않습니다.'));
    }else quick.append(el('p','ap2-muted','아래 프리셋 · 백업에서 지금 설정을 프리셋으로 저장하면 여기서 한 번에 바꿀 수 있습니다.'));
    const modelBox=section(page,'모델'),modelHelp=el('p','ap2-muted');
    const model=addField(modelBox,fields,'model','NovelAI 모델',c.model,{choices:Object.entries(MODELS).map(([id,m])=>[id,m.label])});modelBox.append(modelHelp);
    const sizeBox=section(page,'크기');
    const preset=segmented('크기',[...SIZES.map(([id,label])=>[id,label]),['custom','직접']],'custom',value=>{const size=SIZES.find(([id])=>id===value);if(!size)return;fields.width.input.value=size[2];fields.height.input.value=size[3];page.dispatchEvent(new Event('input'));});
    // Name above, pixels below: four choices fit one row on any phone and font size.
    for(const choice of preset.wrap.children){const size=SIZES.find(([id])=>id===choice.dataset.value);choice.replaceChildren(el('span','',choice.textContent),el('small','',size?`${size[2]}×${size[3]}`:'입력'));}
    preset.wrap.classList.add('ap2-size-presets');sizeBox.append(preset.wrap);
    const dimensions=el('div','ap2-grid');sizeBox.append(dimensions);
    addField(dimensions,fields,'width','가로',c.width,{type:'number',min:64,max:2048,step:64});
    addField(dimensions,fields,'height','세로',c.height,{type:'number',min:64,max:2048,step:64});
    const matchSize=()=>preset.set(SIZES.find(([,,w,h])=>w===fields.width.read()&&h===fields.height.read())?.[0]??'custom');
    dimensions.addEventListener('input',matchSize);matchSize();
    addField(sizeBox,fields,'autoSize','장면에 맞춰 세로·가로 바꾸기',c.autoSize,{type:'checkbox',help:'누운 장면은 가로, 서 있는 장면은 세로처럼 AI가 장면마다 화면 비율을 고릅니다. 픽셀 수는 위 크기와 비슷하게 유지합니다.'});
    // One picture, several cuts, or a page of panels. Pages need V5; cuts work on any model.
    const pageBox=section(page,'그림 형식'),pageHelp=el('p','ap2-muted');
    let format=c.pageFormat??'single',panels=c.panelCount??0,scenes=c.maxScenes??2;
    const formatChoice=segmented('그림 형식',PAGE_FORMATS.map(([id,label])=>[id,label]),format,value=>{format=value;syncPage();page.dispatchEvent(new Event('input'));});
    formatChoice.wrap.classList.add('ap2-format-choice');
    // How many pictures one reply may get. The AI draws only what is worth showing, up to this.
    const scenesChoice=segmented('최대 장 수',SCENE_COUNTS.map(n=>[String(n),`${n}장`]),String(scenes),value=>{scenes=Number(value);page.dispatchEvent(new Event('input'));});
    const scenesRow=el('div','ap2-quick-shape'),scenesLabel=el('span','','최대 장 수');scenesRow.append(scenesLabel,scenesChoice.wrap);
    const countRow=el('div','ap2-quick-shape'),countLabel=el('span','','칸 수');countRow.append(countLabel);
    let cutLayout=c.cutLayout??'story';
    const layoutChoice=segmented('컷 놓는 자리',CUT_LAYOUTS,cutLayout,value=>{cutLayout=value;page.dispatchEvent(new Event('input'));}),layoutRow=el('div','ap2-quick-shape');
    layoutRow.append(el('span','','컷 놓는 자리'),layoutChoice.wrap);layoutRow.title='문단마다: 컷마다 그 장면을 그린 문단 바로 뒤에 놓아 글과 그림이 번갈아 나옵니다. 답변 아래 이어서: 모든 컷을 답변 끝에 한 줄로 이어 붙입니다.';
    pageBox.append(formatChoice.wrap,pageHelp,scenesRow,countRow,layoutRow);
    fields.maxScenes={read:()=>scenes};
    fields.cutLayout={read:()=>cutLayout};
    const bubbles=addField(pageBox,fields,'speechBubbles','말풍선에 대사 넣기',c.speechBubbles,{type:'checkbox',help:'칸마다 대사 한 줄을 말풍선에 넣습니다. NovelAI는 한글 글자를 잘 그리지 못해 뭉개질 수 있습니다.'});
    fields.pageFormat={read:()=>format};fields.panelCount={read:()=>panels};
    // Panels on one page (pages only).
    const panelChoice=segmented('칸 수',PANEL_COUNTS.map(([n,label])=>[String(n),label]),String(PANEL_COUNTS.some(([n])=>n===panels)?panels:0),value=>{panels=Number(value);page.dispatchEvent(new Event('input'));});
    if(!PANEL_COUNTS.some(([n])=>n===panels))panels=0;countRow.append(panelChoice.wrap);
    let lastFormat=format;
    function syncPage(){
        const v5=String(fields.model?.input.value??c.model).startsWith('nai-diffusion-5-');
        // Without V5 only ordinary pictures can be drawn: cuts and pages hold panels.
        if(!v5&&format!=='single'){format='single';formatChoice.set('single');}
        for(const option of formatChoice.wrap.children)option.disabled=!v5&&option.dataset.value!=='single';
        const cuts=format==='cuts',pageMode=!['single','cuts'].includes(format);
        // Cuts of one picture make no episode: choosing cuts starts from four.
        if(cuts&&lastFormat!=='cuts'&&scenes<2){scenes=4;scenesChoice.set('4');}
        lastFormat=format;

        scenesLabel.textContent=pageMode?'최대 페이지':'최대 장 수';
        scenesRow.title='AI가 그릴 만한 순간만 골라 이 수 안에서 그립니다. 짧거나 조용한 답변은 한 장만 그릴 수 있습니다.';
        countRow.hidden=!(pageMode||cuts);layoutRow.hidden=!cuts;bubbles.closest('.ap2-field').hidden=!(pageMode||cuts);
        const about=PAGE_FORMATS.find(([id])=>id===format)?.[2]??'';
        pageHelp.textContent=!v5?`${about} 웹툰 컷과 만화 페이지는 V5 모델에서만 그립니다.`:about;
    }
    const sampling=section(page,'품질','기본값 그대로 써도 됩니다.'),grid=el('div','ap2-grid');sampling.append(grid);
    addField(grid,fields,'steps','Steps',c.steps,{type:'number',min:1,max:50,step:1});
    addField(grid,fields,'scale','Guidance',c.scale,{type:'number',min:0,max:10,step:0.1});
    addField(sampling,fields,'budgetGuard','비용 보호',c.budgetGuard,{type:'checkbox',help:'1메가픽셀·28 Steps를 넘는 요청을 막습니다. 무료 생성을 보장하지는 않습니다.'});
    const advanced=foldout(page,'고급 설정');
    addField(advanced,fields,'sampler','샘플러',c.sampler,{choices:SAMPLERS.map(v=>[v,v])});
    const scheduler=addField(advanced,fields,'scheduler','스케줄러',c.scheduler,{choices:['karras','exponential','polyexponential','native'].map(v=>[v,v])});
    const extra=el('div','ap2-grid');advanced.append(extra);
    addField(extra,fields,'seed','Seed',c.seed,{type:'number',min:-1,max:4294967295,step:1,help:'-1: 무작위'});
    addField(extra,fields,'cfgRescale','CFG rescale',c.cfgRescale,{type:'number',min:0,max:1,step:0.05});
    addField(advanced,fields,'useCoords','인물 좌표 적용',c.useCoords,{type:'checkbox'});
    addField(advanced,fields,'useOrder','인물 순서 적용',c.useOrder,{type:'checkbox'});
    const transparent=addField(advanced,fields,'transparent','투명 배경',c.transparent,{type:'checkbox',help:'V5 전용'});
    const updateModel=()=>{
        const v5=model.value.startsWith('nai-diffusion-5-');if(v5)scheduler.value='karras';scheduler.disabled=v5;transparent.disabled=!v5;if(!v5)transparent.checked=false;
        modelHelp.textContent=v5?'V5: 자연어 프롬프트, 인물 자유 배치, 투명 배경, 참조(인물 · 그림체 · 의상 여러 장)를 지원합니다.':'V4.5: 태그 프롬프트, 5 × 5 인물 배치, 분위기(Vibe)와 Precise Reference 1장을 지원합니다.';
    };
    model.addEventListener('change',()=>{updateModel();syncPage();});updateModel();syncPage();
    const analysis=foldout(page,'수동 분석');
    analysis.append(el('p','ap2-muted','삽화 지시가 없는 답변을 따로 분석해 장면을 만듭니다. AI 요청이 한 번 더 발생합니다.'));
    addField(analysis,fields,'profileId','연결 프로필',c.profileId,{choices:[['','현재 채팅 연결'],...api.profiles().map(p=>[p.id,p.name])],help:'따로 고르지 않아도 현재 대화에 사용하는 AI로 분석합니다.'});
    addField(analysis,fields,'analysisMode','분석 방식',c.analysisMode,{choices:[['quick','빠르게'],['precise','정밀하게']],help:'정밀 분석은 복장·외형 시점 확인에 LLM을 한 번 더 호출합니다.'});
    addField(analysis,fields,'contextMessages','함께 읽을 이전 메시지',c.contextMessages,{type:'number',min:0,max:30,step:1});
    // How long the scene-writing reply may be. Thinking models spend part of it on thoughts.
    const lengthNumber=field('최대 길이 (토큰)',c.analysisLength||16000,{type:'number',min:1000,max:128000,step:1000});
    const lengthMode=segmented('분석 답 길이',[['auto','자동'],['manual','직접 정하기']],c.analysisLength?'manual':'auto',value=>{lengthNumber.wrap.hidden=value!=='manual';page.dispatchEvent(new Event('input'));});
    const lengthRow=el('div','ap2-quick-shape');lengthRow.append(el('span','','분석 답 길이'),lengthMode.wrap);lengthNumber.wrap.hidden=!c.analysisLength;
    fields.analysisLength={read:()=>lengthMode.read()==='manual'?Math.min(128000,Math.max(1000,Math.round(Number(lengthNumber.read())||16000))):0};
    analysis.append(lengthRow,lengthNumber.wrap,el('p','ap2-muted','자동은 16,000 토큰입니다. 생각하는 모델은 이 길이를 생각에 먼저 써서, 모자라면 결과가 잘립니다. 잘리면 직접 정하기로 24,000 이상을 주세요.'));
    analysis.append(button('마지막 답변 분석',()=>api.analyze(),false,'fa-wand-magic-sparkles'));
    saveBar(page,()=>api.saveSettings({...api.settings(),...readFields(fields)}));
    const presets=foldout(page,'프리셋 · 백업');
    presets.append(el('p','ap2-muted','프리셋은 모델·크기·프롬프트·참조를 묶어 저장합니다.'));
    const presetName=field('새 프리셋 이름','');presetName.input.addEventListener('input',event=>event.stopPropagation());presets.append(presetName.wrap);
    presets.append(button('프리셋 저장',()=>{const name=presetName.read().trim();if(!name)throw new Error('프리셋 이름을 입력하세요.');const latest={...api.settings(),...readFields(fields)},list=[...(latest.presets??[])];if(list.some(p=>p.name===name))throw new Error('같은 이름의 프리셋이 있습니다.');list.push({name,config:latest});api.saveSettings({...latest,presets:list});return open('image',true);},false,'fa-plus'));
    for(const p of c.presets??[]){const row=el('div','ap2-preset-row');row.append(el('span','',p.name),button('적용',()=>{api.saveSettings({...api.settings(),...p.config,automatic:'off'});notice('프리셋을 적용했습니다. 자동 삽화는 꺼 두었습니다.');return open('image',true);}),button('삭제',async()=>{if(!await confirmAction('프리셋 삭제',`“${p.name}”을 삭제할까요?`))return;const latest=api.settings();api.saveSettings({...latest,presets:latest.presets.filter(item=>item.name!==p.name)});return open('image',true);}));presets.append(row);}
    const transfer=el('div','ap2-actions');presets.append(transfer);
    transfer.append(button('이전 설정',()=>{const entries=api.settingsHistory(),{dialog,body}=modal('이전 설정');if(!entries.length){body.append(el('p','','저장된 이전 설정이 없습니다. 다음 변경부터 자동 보관합니다.'));return;}for(const entry of entries){const row=el('div','ap2-card');row.append(el('strong','',`${new Date(entry.time).toLocaleString()} · ${entry.reason}`),el('p','ap2-muted',`${MODELS[entry.settings.model]?.label??entry.settings.model??'기존 설정'} · ${entry.settings.width??'?'} × ${entry.settings.height??'?'}`),button('복구',()=>{api.restoreSettings(entry.settings);dialog.close();return open('image',true);}));body.append(row);}},false,'fa-clock-rotate-left'));
    transfer.append(button('내보내기',()=>downloadJson({schema:1,settings:api.settings()},'scenebook-settings.json'),false,'fa-file-export'));
    const upload=el('input');upload.type='file';upload.accept='.json';upload.hidden=true;
    transfer.append(upload,button('가져오기',()=>upload.click(),false,'fa-file-import'));
    upload.addEventListener('change',async event=>{event.stopPropagation();try{const file=upload.files[0];if(!file)return;if(file.size>1000000)throw new Error('1MB 이하 설정 파일을 선택하세요.');api.importSettings(JSON.parse(await file.text()));await open('image',true);notice('설정을 가져왔습니다. 자동 삽화는 꺼져 있습니다.');}catch(e){notice(e.message,true);}});
}
function displayPage(page,{api}){
    const c=api.settings(),fields={};
    const place=section(page,'채팅에 보이는 모습','그림이 채팅에서 어떻게 보일지 정합니다. 원본 파일은 바뀌지 않습니다.');
    addField(place,fields,'placement','그림 위치',c.placement,{choices:[['end','답변 아래'],['inline','문단 뒤'],['auto','AI가 고른 문단 뒤']]});
    addField(place,fields,'displayWidth','최대 너비 (픽셀)',c.displayWidth,{type:'number',min:240,max:1200,step:1});
    addField(place,fields,'compact','작게 표시',c.compact,{type:'checkbox'});
    addField(place,fields,'imageTools','터치 화면의 그림 위 버튼',c.imageTools,{choices:[['tap','한 번 누르면 보이기'],['always','항상 보이기']],help:'한 번 누르면 보이기: 처음엔 그림만 보이고, 한 번 누르면 수정·재생성 버튼이 나타나며 한 번 더 누르면 크게 봅니다. 마우스로는 그림 위에 올리면 보입니다.'});
    const frameBox=section(page,'삽화 액자');
    // Each tile draws its frame with the same code the chat uses.
    let frame=c.frame,frameWide=c.frameWide??'';const frames=el('div','ap2-frame-picker');frames.setAttribute('role','radiogroup');frames.setAttribute('aria-label','삽화 액자');
    for(const item of frameChoices(c)){
        const choice=el('button','ap2-frame-choice');choice.type='button';choice.setAttribute('role','radio');choice.setAttribute('aria-checked',String(item.id===frame));choice.title=item.label;
        const sample=el('span','ap2-figure'),wrap=el('span','ap2-image-wrap'),inner=el('span','ap2-image-open');inner.append(el('span','ap2-frame-sample'));wrap.append(inner);sample.append(wrap);
        applyFrame(sample,wrap,inner,4,5,{frame:item.id,customFrames:c.customFrames,frameInk:c.frameInk});choice.append(sample,el('span','ap2-frame-name',item.label));
        choice.addEventListener('click',()=>{frame=item.id;for(const b of frames.children)b.setAttribute('aria-checked',String(b===choice));page.dispatchEvent(new Event('input'));});frames.append(choice);
    }
    fields.frame={read:()=>frame};fields.frameWide={read:()=>frameWide};
    const frameFile=el('input');frameFile.type='file';frameFile.accept='image/png,image/webp';frameFile.hidden=true;
    frameFile.addEventListener('change',async event=>{event.stopPropagation();try{const file=frameFile.files?.[0];if(!file)return;await api.addFrame(file);notice('액자 그림을 추가했습니다.');}catch(e){notice(e.message,true);}finally{frameFile.value='';}});
    frameBox.append(frames);
    addField(frameBox,fields,'frameInk','장식 액자 색',c.frameInk,{choices:INKS});
    const frameTools=el('div','ap2-actions');frameTools.append(frameFile,button('액자 그림 추가',()=>frameFile.click(),false,'fa-plus'));frameBox.append(frameTools);
    if(c.customFrames?.length){
        frameTools.append(actionMenu(c.customFrames.map(f=>({label:`“${f.name}” 삭제`,icon:'fa-trash-can',run:async()=>{if(await confirmAction('액자 삭제',`“${f.name}” 액자 그림을 삭제할까요?`))await api.removeFrame(f.id);}})),'액자 그림 관리'));
        const wide=field('가로 그림에는',frameWide,{choices:[['','같은 액자'],...frameChoices(c).map(x=>[x.id,x.label])]});wide.input.addEventListener('change',()=>{frameWide=wide.read();});frameBox.append(wide.wrap);
    }
    frameBox.append(el('p','ap2-muted','가운데가 투명한 PNG·WebP 액자 그림을 추가하면 삽화에 씌웁니다. 세로용·가로용을 따로 넣을 수 있습니다.'));
    saveBar(page,()=>api.saveSettings({...api.settings(),...readFields(fields)}));
}
function queuePage(page,{api,open}){
    const usage=async()=>{const account=await api.account(),{dialog:d,body}=modal('계정 사용량');d.classList.add('ap2-compact');body.append(el('p','',`구독 ${account.active?'활성':'비활성'} · 등급 ${account.tier??'확인 불가'}`));body.append(el('p','',`잔여 Anlas ${account.trainingStepsLeft?Number(account.trainingStepsLeft.fixedTrainingStepsLeft??0)+Number(account.trainingStepsLeft.purchasedTrainingSteps??0):'확인 불가'}`));};
    const waiting=api.queue().filter(item=>item.state==='waiting').length,cancel=button('대기 취소',()=>{api.cancelQueue();return open('queue');},false,'fa-ban');cancel.disabled=!waiting;
    const actions=el('div','ap2-actions');actions.append(button(api.queuePaused()?'재개':'일시정지',()=>{api.toggleQueue();return open('queue');},false,api.queuePaused()?'fa-play':'fa-pause'),cancel,actionMenu([{label:'지시 기록',icon:'fa-file-lines',run:()=>api.showPlans()},{label:'계정 사용량',icon:'fa-coins',run:usage},{label:'새로고침',icon:'fa-rotate-right',run:()=>open('queue')}]));page.append(actions);
    const drafts=api.pendingDrafts().length;if(drafts)actions.prepend(button(`초안 ${drafts}개 생성`,async()=>{if(!await confirmAction('초안 일괄 생성',`그림이 없는 답변 ${drafts}개의 초안을 모두 생성 대기열에 넣을까요?`,'생성'))return;notice(`${await api.generateDrafts()}개 장면을 대기열에 넣었습니다.`);return open('queue');},true,'fa-images'));
    page.append(el('p','ap2-muted',`이번 접속 이미지 요청 ${api.usage()}회${api.queuePaused()?' · 일시정지됨':''}`));
    if(!api.queue().length)page.append(el('p','ap2-empty','진행 중인 작업이 없습니다. 그림을 만들면 여기에 진행 상황이 표시됩니다.'));
    const states={waiting:'대기 중',running:'생성 중',done:'완료',failed:'실패',cancelled:'취소됨'};
    for(const item of [...api.queue()].reverse()){const row=el('div','ap2-job'),chip=el('span','ap2-chip',states[item.state]??item.state);chip.dataset.state=item.state;row.append(el('strong','',item.label||'삽화'),chip);if(item.error)row.append(el('p','ap2-muted',item.error));page.append(row);}
}
const BUILDERS={home:homePage,prompt:promptPage,image:imagePage,characters:charactersPage,references:referencesPage,display:displayPage,gallery:galleryPage,queue:queuePage};

let current=null;
// All of SceneBook's pages. Without `host` they open as a window (asking again
// while it is open only switches the page); with `host` they are laid straight
// into that element, as in the extension drawer, with nothing to open first.
export function studio(api,{page:first='home',host=null}={}){
    if(!host&&current?.dialog.open){void current.open(first);return current.dialog;}
    const nav=el('nav','ap2-nav'),pages=el('div','ap2-pages');nav.setAttribute('aria-label','씬북 메뉴');nav.setAttribute('role','tablist');
    let dialog=null;
    if(host){
        // Small buttons beside the tabs: the same pages in a wide window, and the guide.
        const bar=el('div','ap2-hostbar'),tools=el('div','ap2-hostbar-tools');
        tools.append(iconButton('넓은 창으로 열기','fa-expand',()=>{studio(api,{page:activeId});}),iconButton('사용법','fa-circle-question',showGuide));
        bar.append(nav,tools);host.append(bar,pages);
    }else{
        const frame=modal('씬북');dialog=frame.dialog;dialog.classList.add('ap2-studio');
        dialog.querySelector('.ap2-header-title h2').append(el('small','ap2-version',CLIENT_VERSION));
        const headerClose=dialog.querySelector('.ap2-header .ap2-close'),headerActions=el('div','ap2-actions ap2-header-actions');
        headerClose.replaceWith(headerActions);headerActions.append(button('사용법',showGuide,false,'fa-circle-question'),headerClose);
        frame.body.append(nav,pages);
    }
    // Each page is built once and kept. Moving between tabs only changes which
    // one is shown: building a page inserts elements, and in SillyTavern every
    // insertion restyles a large part of the chat.
    const cached=new Map(),building=new Map(),pageEvents=new Map(),state={scope:null},instance=`ap2-${crypto.randomUUID()}`,watchers=new Map();let activeId=first;
    const loading=el('p','ap2-empty ap2-loading','불러오는 중…');loading.hidden=true;pages.append(loading);
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    const display=id=>{const page=cached.get(id);for(const node of pages.children){const on=node===(page??loading);if(node.hidden===on)node.hidden=!on;}};
    // What a page was built from. A page is rebuilt only when this no longer matches.
    const DEPENDS={prompt:['look','style','negative','quality','leanPrompt','analysisPrompt','injectionPrompt','model'],
        image:['model','width','height','autoSize','steps','scale','budgetGuard','sampler','scheduler','seed','cfgRescale','useCoords','useOrder','transparent','profileId','analysisMode','contextMessages','analysisLength','maxScenes','pageFormat','panelCount','cutLayout','speechBubbles','style','negative','look','quality','references'],
        display:['placement','displayWidth','compact','imageTools','frame','frameWide','frameInk'],references:['model','references']};
    const signature=id=>{
        if(DEPENDS[id]){const s=api.settings();return JSON.stringify([DEPENDS[id].map(key=>s[key]),id==='image'?(s.presets??[]).map(p=>p.name):id==='display'?(s.customFrames??[]).map(f=>f.id):0]);}
        if(id==='characters')return `${api.contextKey()}`;
        if(id==='gallery')return `${api.contextKey()}|${api.chatImages().length}`;
        if(id==='queue')return JSON.stringify([api.queue().map(item=>[item.state,item.label,item.error]),api.queuePaused(),api.usage(),api.pendingDrafts().length]);
        return '';
    };
    const outdated=(id,page)=>!!page.dataset.failed||page.dataset.stale==='true'||(page.dataset.dirty!=='true'&&page.dataset.signature!==signature(id));
    // Builds a page off screen and puts it in place in one step.
    const build=async(id,forced=false)=>{
        const page=el('section','ap2-page'),events=new AbortController();building.set(id,page);
        page.id=`${instance}-page-${id}`;page.dataset.page=id;page.dataset.signature=signature(id);page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',`${instance}-tab-${id}`);
        const listen=(names,handler)=>{for(const name of names)document.addEventListener(name,handler,{signal:events.signal});};
        try{await BUILDERS[id](page,{api,open,state,listen,forced,close:()=>dialog?.close(),isCurrent:candidate=>building.get(id)===candidate||cached.get(id)===candidate});}
        catch(e){page.dataset.failed='true';page.append(el('p','ap2-empty',e.message));}
        if(building.get(id)!==page){events.abort();return;}
        building.delete(id);pageEvents.get(id)?.abort();pageEvents.set(id,events);
        const previous=cached.get(id);cached.set(id,page);page.hidden=activeId!==id;
        if(previous)previous.replaceWith(page);else pages.append(page);
        if(activeId===id)display(id);
    };
    const open=async(id,refresh=false)=>{
        if(!BUILDERS[id])id='home';
        cached.get(activeId)?.flush?.();
        activeId=id;
        for(const b of nav.children){const active=b.dataset.page===id;setFlag(b,'aria-selected',active);if(b.tabIndex!==(active?0:-1))b.tabIndex=active?0:-1;}
        const kept=cached.get(id);
        // Shown at once, also while a newer copy is being prepared behind it.
        display(id);
        if(kept&&!refresh&&!outdated(id,kept)){kept.refresh?.();return;}
        if(building.has(id)&&!refresh)return;
        // The tab highlight is painted before the heavier work of building a page.
        await frame();
        await build(id,refresh);
    };
    // Tabs never wait on the page: the button is not disabled while it builds.
    for(const [id,label,icon]of PAGES){const b=button(label,()=>{void open(id);},false,icon);b.classList.add('ap2-nav-item');b.dataset.page=id;b.id=`${instance}-tab-${id}`;b.setAttribute('role','tab');b.setAttribute('aria-controls',`${instance}-page-${id}`);nav.append(b);}
    nav.addEventListener('keydown',event=>{
        const keys={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1};if(!(event.key in keys)&&!['Home','End'].includes(event.key))return;
        event.preventDefault();const buttons=[...nav.children],index=buttons.findIndex(b=>b.dataset.page===activeId),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+keys[event.key]+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();
    });
    // A change made elsewhere rebuilds the page on screen if it shows that value.
    // Pages out of sight are left alone and checked when they are opened.
    const revisit=id=>{const page=cached.get(id);if(page&&activeId===id&&outdated(id,page))void open(id,true);};
    watchers.set('scenebook-settings-changed',()=>{
        for(const id of SETTINGS){
            const page=cached.get(id);if(!page)continue;
            // The page being edited already shows what it has just saved.
            if(page.dataset.dirty==='true')page.dataset.signature=signature(id);else revisit(id);
        }
    });
    const charactersChanged=()=>{
        const page=cached.get('characters');if(!page)return;
        page.dispatchEvent(new Event('scenebook-visual-status'));
        if(page.dataset.dirty==='true')return;
        page.dataset.stale='true';revisit('characters');
    };
    watchers.set('scenebook-visual-changed',charactersChanged);
    watchers.set('scenebook-context-changed',()=>{
        state.scope=null;const page=cached.get('characters');
        if(page?.dataset.dirty==='true'){notice('저장되지 않은 인물 입력이 있었습니다. 이전 채팅에는 마지막으로 저장된 설정이 유지됩니다.');page.dataset.dirty='false';}
        if(page)page.dataset.stale='true';
        revisit('characters');revisit('gallery');
    });
    watchers.set('scenebook-workflow-status',()=>{if(!document.querySelector('.ap2-action-panel:popover-open')){revisit('queue');revisit('gallery');}});
    for(const [name,handler]of watchers)document.addEventListener(name,handler);
    // The drawer stays for the whole session; only a window has listeners to give back.
    if(dialog){
        dialog.addEventListener('close',()=>{
            for(const page of cached.values())page.flush?.();
            for(const [name,handler]of watchers)document.removeEventListener(name,handler);
            for(const events of pageEvents.values())events.abort();
            current=null;
        },{once:true});
        current={dialog,open};
    }
    // In the drawer the plain settings pages are made ready at start-up, while no chat
    // is on screen yet and building costs next to nothing, so their first visit is instant too.
    void open(first).then(async()=>{if(host)for(const id of ['prompt','image','display'])if(!cached.has(id)&&!building.has(id))await build(id);});
    return dialog??host;
}
// The drawer in SillyTavern's extension list. Every page is right there once it is opened.
export function mountSettings(api,container){
    const drawer=el('div','inline-drawer');drawer.id='ap2-settings';
    const header=el('div','inline-drawer-toggle inline-drawer-header');header.tabIndex=0;header.setAttribute('role','button');header.setAttribute('aria-expanded','false');header.setAttribute('aria-controls','ap2-settings-content');
    const label=el('b','ap2-drawer-title','씬북'),version=el('small','ap2-version',CLIENT_VERSION),status=el('small','ap2-muted','');status.id='ap2-status';label.append(version);
    const icon=el('div','inline-drawer-icon fa-solid fa-circle-chevron-down down');icon.setAttribute('aria-hidden','true');header.append(label,status,icon);
    const content=el('div','inline-drawer-content ap2-settings');content.id='ap2-settings-content';content.style.display='none';
    drawer.append(header,content);container.append(drawer);
    header.addEventListener('click',()=>{header.setAttribute('aria-expanded',String(header.getAttribute('aria-expanded')!=='true'));});
    header.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();header.click();}});
    // Arrow keys on the tabs and buttons here would otherwise swipe the reply behind.
    content.addEventListener('keydown',e=>{if(/^Arrow/.test(e.key))e.stopPropagation();});
    syncTone();studio(api,{host:content});
    return drawer;
}
