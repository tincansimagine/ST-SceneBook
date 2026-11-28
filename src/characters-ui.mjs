import { el, button, iconButton, actionMenu, field, addField, readFields, foldout, saveBar, confirmAction, notice } from './ui.mjs';

// The people the AI may draw, with the look each one keeps between pictures.
// `state.scope` remembers which layer (account, character, chat) is being edited.
export function charactersPage(page,{api,open,state}){
    const choices=[['account','계정 전체'],...(api.visualCharacterKey()?[['character','현재 캐릭터']]:[]),...(api.hasChat()?[['chat','현재 채팅']]:[])];
    if(!choices.some(([where])=>where===state.scope))state.scope=api.visualScope();
    const editingScope=state.scope,c=api.visualSettings(editingScope),fields={},contextKey=api.contextKey();page.dataset.contextKey=contextKey;
    page.append(el('p','ap2-lead','등장인물의 외형을 적어 두면 그림마다 같은 모습으로 그립니다. 이름은 채팅에 나오는 이름과 같게 적으세요.'));
    const toolbar=el('div','ap2-actions');toolbar.append(button('인물 추가',()=>{remember();drafts.push({id:crypto.randomUUID(),name:'',appearance:'',outfit:'',negative:''});render(true);},true,'fa-plus'),button('캐릭터 카드에서 가져오기',()=>{const ch=api.character();if(!ch)throw new Error('현재 캐릭터가 없습니다.');remember();drafts.push({id:crypto.randomUUID(),name:ch.name??'',appearance:ch.description??ch.data?.description??'',outfit:'',negative:''});render(true);notice('캐릭터 설명을 가져왔습니다. 외형 묘사만 남기고 정리하세요.');},false,'fa-user-plus'));
    const scopeChoice=field('저장 범위',editingScope,{choices}),scopeHelp=el('p','ap2-muted');page.append(scopeChoice.wrap,scopeHelp,toolbar);
    // Selecting a layer reads it; it must never copy the previous layer
    // into the new destination through the automatic input save handler.
    scopeChoice.input.addEventListener('input',event=>event.stopPropagation());
    scopeChoice.input.addEventListener('change',async event=>{
        event.stopPropagation();const next=scopeChoice.read();scopeChoice.input.value=editingScope;scopeChoice.input.disabled=true;
        try{
            if(page.dataset.dirty==='true'&&!await confirmAction('범위 변경','저장되지 않은 입력을 버리고 다른 범위를 열까요?','전환'))return;
            if(contextKey!==api.contextKey()||!page.isConnected)return;
            state.scope=next;await open('characters',true);
        }catch(error){notice(error.message,true);}finally{scopeChoice.input.disabled=false;}
    });
    const list=el('div','ap2-stack'); page.append(list);
    let drafts=structuredClone(c.library);const history=[];const remember=()=>{history.push(structuredClone(drafts));if(history.length>20)history.shift();};
    const undo=button('되돌리기',()=>{if(!history.length)return;drafts=history.pop();render(true);},false,'fa-rotate-left');toolbar.append(undo);
    const render=(save=false)=>{undo.disabled=!history.length;list.replaceChildren();if(!drafts.length)list.append(el('p','ap2-empty','등록한 인물이 없습니다. 인물 추가를 눌러 이름과 외형을 적어 보세요.'));for(const [i,item]of drafts.entries()){
        const card=el('details','ap2-character'), f={};card.open=drafts.length===1||!item.name;const title=el('summary','',item.name||'새 인물');card.append(title);
        for(const [key,label,multi,placeholder]of [['name','이름',false,'채팅에 나오는 이름'],['appearance','고정 외형',true,'예: girl, long hair, pink hair, purple eyes, petite · 남자: boy, mature male, tall male, broad shoulders'],['outfit','기본 복장',true,'예: white dress, brown boots'],['negative','인물 제외 요소',true,'예: 남자가 여성스럽게 나오면 makeup, lipstick']])addField(card,f,key,label,item[key]??'',{multiline:multi,placeholder});
        addField(card,f,'player','플레이어 캐릭터',item.player,{type:'checkbox',help:'내가 연기하는 인물이면 켜세요. 1인칭 시점 설정에 쓰입니다.'});
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
        const actions=el('div','ap2-actions');const up=iconButton('위로','fa-arrow-up',()=>{if(!i)return;remember();[drafts[i-1],drafts[i]]=[drafts[i],drafts[i-1]];render(true);}),down=iconButton('아래로','fa-arrow-down',()=>{if(i>=drafts.length-1)return;remember();[drafts[i+1],drafts[i]]=[drafts[i],drafts[i+1]];render(true);});up.disabled=i===0;down.disabled=i===drafts.length-1;actions.classList.add('ap2-card-actions');actions.append(up,down,iconButton('인물 삭제','fa-trash-can',async()=>{if(!await confirmAction('인물 삭제',`“${item.name||'이 인물'}”을 라이브러리에서 삭제할까요? 인물 탭을 떠나기 전 되돌리기로 복구할 수 있습니다.`))return;remember();drafts.splice(i,1);render(true);}));card.append(actions);list.append(card);
    }if(save)page.dispatchEvent(new Event('input'));};render();
    const world=foldout(page,'세계관 · 연출 · 플레이어 시점');
    addField(world,fields,'world','세계관',c.world,{multiline:true,help:'시대·건축·문화권의 기본값. 본문에 명시된 사실을 우선합니다.'});
    addField(world,fields,'direction','연출 지시',c.direction,{multiline:true});
    addField(world,fields,'playerMode','플레이어',c.playerMode,{choices:[['auto','본문에 따라 판단'],['pov','화면 밖 · POV'],['visible','등장 가능']]});
    const readVisual=()=>({...readFields(fields),library:structuredClone(drafts)});
    saveBar(page,()=>api.saveVisual(readVisual(),editingScope,contextKey));
    const copyActions=choices.filter(([where])=>where!==editingScope).map(([where,label])=>({label:`${label}로 복사`,icon:'fa-copy',run:async()=>{
        const value=readVisual();
        if(api.hasVisualOverride(where)&&!await confirmAction('인물 설정 복사',`${label}의 기존 인물·세계관 설정을 현재 편집 내용으로 바꿀까요?`,'복사'))return;
        await api.saveVisual(value,where,contextKey);
        if(contextKey!==api.contextKey())return;
        state.scope=where;await open('characters',true);notice(`${label}로 복사했습니다.`);
    }}));
    if(copyActions.length)toolbar.append(actionMenu(copyActions,'다른 범위로 복사'));
    const inherited=editingScope==='chat'&&api.visualCharacterKey()&&api.hasVisualOverride('character')?'캐릭터 설정 사용':'전체 설정 사용';
    const reset=button(inherited,async()=>{
        if(!await confirmAction('설정 범위 해제','이 범위에 저장한 인물·세계관 설정을 해제하고 상위 범위의 설정을 사용할까요?','해제'))return;
        await api.resetVisual(editingScope,contextKey);if(contextKey===api.contextKey())await open('characters',true);
    });
    const tail=el('div','ap2-actions ap2-page-tail');if(editingScope!=='account')tail.append(reset);
    const refreshScope=()=>{
        reset.disabled=!api.hasVisualOverride(editingScope);
        const label={account:'계정 전체',character:'현재 캐릭터',chat:'현재 채팅'},active=api.visualScope();
        const range=editingScope==='character'?`캐릭터: ${api.character()?.name??''} · 같은 캐릭터의 모든 채팅에 저장합니다.`:editingScope==='chat'?'이 채팅에만 저장합니다.':'모든 캐릭터·채팅의 기본값입니다.';
        scopeHelp.textContent=`${range} 적용 우선순위: 채팅 → 캐릭터 → 전체. 현재 적용: ${label[active]}.${!api.visualCharacterKey()?' 캐릭터 범위는 1:1 채팅에서 설정합니다.':''}`;
    };
    page.addEventListener('scenebook-visual-status',refreshScope);refreshScope();
    tail.append(button('다시 불러오기',()=>open('characters',true),false,'fa-rotate-right'));page.append(tail);
}
