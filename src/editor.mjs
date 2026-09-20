import { MODELS, buildPayload, normalizeScene } from '../plugin/core.mjs';
import { positionEditor } from './position.mjs';
import { sceneBundle, readSceneBundle } from './editor-data.mjs';
import { showGuide } from './guide.mjs';
import { generationEditor } from './generation-ui.mjs';
import { el, button, field, addField, readFields, modal, notice, confirmAction, downloadJson } from './ui.mjs';

export function composer({context,scenes,config,onAnalyze,onGenerate,onDraft,previewUrl}){
    const {dialog,body}=modal('장면 편집');dialog.classList.add('ap2-editor');
    let drafts=structuredClone(scenes),selected=0,person=0,tab='scene',dirty=false,editing=false;
    const undo=[];const snapshot=()=>{undo.push({drafts:structuredClone(drafts),config:structuredClone(config),selected,person});if(undo.length>20)undo.shift();dirty=true;};
    const toolbar=el('div','ap2-editor-toolbar'),sceneSelect=field('장면','',{choices:[]}),title=field('제목',''),tools=el('div','ap2-actions');
    const iconButton=(label,icon,fn)=>{const b=button('',fn,false,icon);b.setAttribute('aria-label',label);b.title=label;b.classList.add('ap2-icon-button');return b;};
    toolbar.append(sceneSelect.wrap,title.wrap,tools);body.append(toolbar);
    const scene=()=>drafts[selected];
    const moveScene=delta=>{const to=selected+delta;if(to<0||to>=drafts.length)return;snapshot();[drafts[selected],drafts[to]]=[drafts[to],drafts[selected]];selected=to;render();};
    const sceneBack=iconButton('장면 앞으로','fa-arrow-left',()=>moveScene(-1)),sceneNext=iconButton('장면 뒤로','fa-arrow-right',()=>moveScene(1));
    const addScene=button('추가',()=>{if(drafts.length>=config.maxScenes)throw new Error(`최대 ${config.maxScenes}개 장면입니다.`);snapshot();drafts.push({title:'새 장면',prompt:'',camera:'',negative:'',after:context.blocks.at(-1).index,evidence:'',characters:[]});selected=drafts.length-1;person=0;render();},false,'fa-plus');
    const deleteScene=iconButton('장면 삭제','fa-trash-can',async()=>{const target=scene();if(!target||!await confirmAction('장면 삭제',`“${target.title||'이 장면'}”을 삭제할까요? 되돌리기로 복구할 수 있습니다.`))return;snapshot();drafts.splice(selected,1);selected=Math.max(0,selected-1);person=0;render();});
    tools.append(sceneBack,sceneNext,addScene,deleteScene);
    sceneSelect.input.addEventListener('change',()=>{selected=Number(sceneSelect.read());person=0;render();});
    title.input.addEventListener('input',()=>{if(scene()){scene().title=title.read();sceneSelect.input.options[selected].textContent=`${selected+1}. ${title.read()||'새 장면'}`;dirty=true;}});
    const nav=el('div','ap2-actions ap2-editor-tabs'),content=el('div','ap2-editor-content'),status=el('p','ap2-muted');status.setAttribute('role','status');
    for(const [key,label]of [['scene','장면'],['cast','인물 · 배치'],['final','최종 프롬프트']]){const b=button(label,()=>{tab=key;renderContent();});b.dataset.tab=key;nav.append(b);}
    body.append(nav,status,content);
    const footer=el('footer','ap2-footer ap2-editor-footer'),secondary=el('div','ap2-actions'),primary=el('div','ap2-actions');footer.append(secondary,primary);dialog.append(footer);
    const undoButton=button('되돌리기',()=>{const last=undo.pop();if(!last)return;drafts=last.drafts;Object.assign(config,last.config);selected=last.selected;person=last.person;dirty=true;render();},false,'fa-rotate-left');
    const input=el('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
    secondary.append(undoButton,button('내보내기',()=>downloadJson(sceneBundle(drafts,config),'scenebook-scenes.json')),button('가져오기',()=>input.click()),button('사용법',showGuide),input);
    input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>300000)throw new Error('300KB 이하 장면 파일을 선택하세요.');const value=readSceneBundle(JSON.parse(await file.text()),config,context.blocks.at(-1).index);snapshot();drafts=value.scenes;Object.assign(config,value.config);selected=person=0;render();notice('장면을 불러왔습니다. 삽입 위치를 확인하세요.');}catch(e){notice(e.message,true);}finally{input.value='';}});
    const save=button('초안 저장',async()=>{await onDraft(drafts);dirty=false;status.textContent='초안 저장됨';});
    const generate=button('생성',async()=>{await onGenerate(drafts);dirty=false;dialog.close();},true,'fa-wand-magic-sparkles');primary.append(save,generate);
    const headerClose=dialog.querySelector('.ap2-header button'),headerActions=el('div','ap2-actions');headerActions.append(button('설정',()=>generationEditor(config,next=>{for(const s of drafts)if(s.characters.length>MODELS[next.model].characters)throw new Error(`이 모델은 인물 ${MODELS[next.model].characters}명까지 지원합니다.`);snapshot();Object.assign(config,next);render();}),false,'fa-sliders'),button('닫기',()=>closeEditor()));headerClose.replaceWith(headerActions);
    async function closeEditor(){if(editing)return;editing=true;try{if(dirty){const {dialog:ask,body:askBody}=modal('편집 내용');askBody.append(el('p','','저장하지 않은 변경 사항이 있습니다.'));const f=el('footer','ap2-footer');f.append(button('계속 편집',()=>ask.close()),button('저장 없이 닫기',()=>{ask.close();dirty=false;dialog.close();}),button('저장 후 닫기',async()=>{await onDraft(drafts);ask.close();dirty=false;dialog.close();},true));ask.append(f);await new Promise(resolve=>ask.addEventListener('close',resolve,{once:true}));}else dialog.close();}finally{editing=false;}}
    dialog.addEventListener('cancel',e=>{e.preventDefault();void closeEditor();});
    // This editor deliberately ignores backdrop clicks: an accidental click must not discard a draft.
    dialog.addEventListener('click',e=>{if(e.target===dialog)e.stopImmediatePropagation();},true);
    body.addEventListener('input',()=>{dirty=true;});
    function render(){
        selected=Math.max(0,Math.min(selected,drafts.length-1));sceneSelect.input.replaceChildren();
        drafts.forEach((s,i)=>{const o=el('option','',`${i+1}. ${s.title||'새 장면'}`);o.value=i;sceneSelect.input.append(o);});sceneSelect.input.value=selected;sceneSelect.wrap.hidden=drafts.length<2;sceneBack.hidden=sceneNext.hidden=drafts.length<2;title.input.value=scene()?.title??'';title.input.disabled=!scene();
        sceneBack.disabled=selected===0||!drafts.length;sceneNext.disabled=selected>=drafts.length-1;deleteScene.disabled=!scene();undoButton.disabled=!undo.length;generate.disabled=!drafts.length;renderContent();
    }
    function renderContent(){
        for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.tab===tab));content.replaceChildren();status.textContent=`${MODELS[config.model].label} · ${config.width} × ${config.height} · ${config.steps} Steps · Seed ${config.seed===-1?'무작위':config.seed}`;
        if(!scene()){content.append(el('p','ap2-empty','장면을 추가하거나 파일을 가져오세요.'));return;}
        if(tab==='scene')renderScene();if(tab==='cast')renderCast();if(tab==='final')renderFinal();
    }
    function bind(parent,key,label,options={}){const f=field(label,scene()[key],options);parent.append(f.wrap);f.input.addEventListener('input',()=>{scene()[key]=f.read();});return f;}
    function renderScene(){
        const after=bind(content,'after','삽입 문단',{choices:context.blocks.map(b=>[String(b.index),`${b.index}번 문단 뒤`])});
        const excerpt=el('details','ap2-guide-topic');excerpt.append(el('summary','','원문 보기'),el('blockquote','ap2-excerpt',context.blocks.find(b=>b.index===Number(scene().after))?.content??''));content.append(excerpt);
        after.input.addEventListener('change',()=>{scene().after=Number(after.read());scene().evidence='';excerpt.lastChild.textContent=context.blocks.find(b=>b.index===scene().after)?.content??'';});
        bind(content,'prompt','장면 프롬프트',{multiline:true,rows:5,placeholder:'배경, 조명, 장면의 시각적 상황을 입력하세요.'});
        if(scene().finalPrompt){const exact=field('최종 프롬프트 직접 사용',true,{type:'checkbox',help:'이 장면에는 공통 그림체·구도·품질 태그를 덧붙이지 않습니다.'});exact.input.addEventListener('input',()=>{scene().finalPrompt=exact.read();});content.append(exact.wrap);}
        const row=el('div','ap2-grid');content.append(row);bind(row,'camera','구도',{multiline:true,rows:3});bind(row,'negative','장면 제외 요소',{multiline:true,rows:3});
        const common=el('details','ap2-guide-topic');common.append(el('summary','','공통 프롬프트 · 이번 작업'));content.append(common);
        for(const [key,label,type]of [['style','그림체','text'],['negative','공통 제외 요소','text'],['quality','품질 태그','checkbox']]){const f=field(label,config[key],type==='checkbox'?{type}:{multiline:true});f.input.addEventListener('input',()=>{config[key]=f.read();});common.append(f.wrap);}
        const instructions=el('details','ap2-guide-topic');instructions.append(el('summary','','AI 수정'));const direction=field('수정 지시',context.direction,{multiline:true,placeholder:'예: 인물은 유지하고 카메라만 멀리'}),scope=field('수정 범위','all',{choices:[['all','전체'],['camera','구도'],['background','배경'],['characters','인물']]});instructions.append(direction.wrap,scope.wrap);
        instructions.append(button('재분석',async()=>{const before=JSON.stringify(drafts);status.textContent='장면 분석 중…';try{const result=await onAnalyze(structuredClone(drafts),direction.read(),scope.read());if(JSON.stringify(drafts)!==before)throw new Error('분석 중 편집한 내용이 있어 결과로 덮어쓰지 않았습니다.');snapshot();drafts=result;render();status.textContent='분석 완료 · 변경 내용을 확인하세요.';}catch(e){status.textContent='분석 실패 · 기존 편집 내용을 유지했습니다.';throw e;}}));content.append(instructions);
    }
    function renderCast(){
        const cast=scene().characters??=[];person=Math.max(0,Math.min(person,cast.length-1));
        const layout=el('div','ap2-cast-layout'),visual=el('div','ap2-cast-visual'),editor=el('div','ap2-cast-editor'),list=el('div','ap2-cast-list'),fieldsArea=el('div','ap2-cast-fields');layout.append(visual,editor);editor.append(list,fieldsArea);content.append(layout);
        const coords=field('좌표 적용',config.useCoords,{type:'checkbox'}),order=field('인물 순서 적용',config.useOrder,{type:'checkbox'});let currentFields={};
        const moved=()=>{config.useCoords=true;coords.input.checked=true;dirty=true;};
        const placement=positionEditor({model:config.model,width:config.width,height:config.height,backgroundUrl:previewUrl,showChoices:false,onMove:moved,onSelect:i=>{person=i;showPerson();},entries:()=>cast.map((c,i)=>({name:c.name,x:c.x??.5,y:c.y??.5,set:(x,y)=>{c.x=x;c.y=y;if(i===person&&currentFields.x){currentFields.x.input.value=x;currentFields.y.input.value=y;}}}))});
        visual.append(placement.element,coords.wrap,order.wrap);coords.input.addEventListener('input',()=>{config.useCoords=coords.read();});order.input.addEventListener('input',()=>{config.useOrder=order.read();});
        function names(){list.replaceChildren();cast.forEach((c,i)=>{const b=button(`${i+1}. ${c.name||`인물 ${i+1}`}`,()=>{person=i;placement.select(i);showPerson();});b.title=c.name||`인물 ${i+1}`;b.setAttribute('aria-pressed',String(i===person));list.append(b);});}
        function showPerson(){
            names();fieldsArea.replaceChildren();currentFields={};const c=cast[person];
            const actions=el('div','ap2-actions ap2-cast-actions');
            actions.append(button('추가',()=>{if(cast.length>=MODELS[config.model].characters)throw new Error(`최대 ${MODELS[config.model].characters}명입니다.`);snapshot();cast.push({name:`인물 ${cast.length+1}`,prompt:'',negative:'',x:.5,y:.5});person=cast.length-1;render();},false,'fa-plus'));
            const move=delta=>{const to=person+delta;if(to<0||to>=cast.length)return;snapshot();[cast[person],cast[to]]=[cast[to],cast[person]];person=to;render();};
            const up=iconButton('인물 앞으로','fa-arrow-up',()=>move(-1)),down=iconButton('인물 뒤로','fa-arrow-down',()=>move(1));up.disabled=person===0||!c;down.disabled=person>=cast.length-1;actions.append(up,down);
            const remove=iconButton('인물 삭제','fa-trash-can',async()=>{if(!c||!await confirmAction('인물 삭제',`“${c.name||'선택한 인물'}”을 이 장면에서 삭제할까요? 되돌리기로 복구할 수 있습니다.`))return;snapshot();cast.splice(person,1);person=Math.max(0,person-1);render();});remove.disabled=!c;actions.append(remove);fieldsArea.append(actions);
            if(!c){fieldsArea.append(el('p','ap2-empty','인물을 추가하면 프롬프트와 위치를 편집할 수 있습니다.'));return;}
            addField(fieldsArea,currentFields,'name','이름',c.name);addField(fieldsArea,currentFields,'prompt','인물 프롬프트',c.prompt,{multiline:true,rows:5});addField(fieldsArea,currentFields,'negative','인물 제외 요소',c.negative,{multiline:true,rows:2});
            const position=el('div','ap2-grid');fieldsArea.append(position);for(const [key,label]of [['x','가로 위치'],['y','세로 위치']])addField(position,currentFields,key,label,c[key]??.5,{type:'number',min:0,max:1,step:.01});
            for(const [key,f]of Object.entries(currentFields))f.input.addEventListener('input',()=>{c[key]=f.read();if(key==='name'){names();placement.refresh();placement.select(person);}if(key==='x'||key==='y'){moved();placement.update();}});
        }
        showPerson();placement.select(person);
    }
    function renderFinal(){
        content.append(el('p','ap2-muted','실제로 보낼 프롬프트입니다. 직접 수정하면 이 장면은 입력한 내용을 그대로 사용합니다. 인물별 프롬프트는 따로 전송됩니다.'));
        let payload;try{payload=buildPayload(scene(),config,config.seed===-1?0:config.seed);}catch(e){content.append(el('p','ap2-muted',e.message));return;}
        const prompt=field('최종 장면 프롬프트',payload.input,{multiline:true,rows:7}),negative=field('최종 제외 요소',payload.parameters.negative_prompt,{multiline:true,rows:4});content.append(prompt.wrap,negative.wrap);
        for(const f of [prompt,negative])f.input.addEventListener('input',()=>{Object.assign(scene(),{prompt:prompt.read(),negative:negative.read(),camera:'',finalPrompt:true});dirty=true;});
        if(scene().characters.length)content.append(el('p','ap2-muted',`인물 ${scene().characters.length}명의 프롬프트는 인물 · 배치에서 따로 전송됩니다.`));
    }
    render();return dialog;
}
