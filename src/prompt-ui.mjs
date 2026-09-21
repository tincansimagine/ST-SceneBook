import { DEFAULT_ANALYSIS_PROMPT, promptBundle, readPromptBundle } from './prompts.mjs';
import { DEFAULT_INJECTION_PROMPT, illustrationOutputRules } from './injection.mjs';
import { JSON_OUTPUT_RULES } from './plan-json.mjs';
import { el, button, field, modal, notice, downloadJson } from './ui.mjs';

export function promptEditor(config,onApply,{initial='image'}={}){
    const {dialog,body}=modal('프롬프트');
    const tabs=el('div','ap2-editor-tabs'),image=el('div'),analysis=el('div'),injection=el('div');analysis.hidden=injection.hidden=true;
    const style=field('메인 프롬프트',config.style,{multiline:true,rows:5}),negative=field('UC 프롬프트',config.negative,{multiline:true}),quality=field('품질 태그',config.quality,{type:'checkbox'});
    image.append(style.wrap,negative.wrap,quality.wrap,el('p','ap2-muted','모든 장면의 공통값입니다. 장면·인물별 프롬프트는 장면 편집에서 수정합니다.'));
    const template=field('장면 분석 지시문',config.analysisPrompt||DEFAULT_ANALYSIS_PROMPT,{multiline:true,rows:17});
    analysis.append(template.wrap,el('p','ap2-muted','{{data}} 채팅·인물 · {{maxScenes}} 장면 수 · {{modelRule}} 모델별 작성법 · {{playerRule}} POV · {{direction}} 수정 지시. JSON 응답 형식을 유지하세요.'));
    const injected=field('삽화 주입 프롬프트',config.injectionPrompt||DEFAULT_INJECTION_PROMPT,{multiline:true,rows:17});injection.append(el('p','ap2-muted','주입 위치: 깊이 0 · System. 실제 전송 시 사용자 지시문과 출력 규칙 전체를 <image_generation> 태그로 감쌉니다. 일반 답변에서는 최신 대화 뒤에 배치하며 ST 프리셋·이어쓰기 지시와 API 후처리에 따라 최종 순서는 달라질 수 있습니다.'),injected.wrap,el('p','ap2-muted','이 기본 프롬프트가 대화 AI에 전달됩니다. 직접 수정할 수 있으며 적용하면 바로 저장됩니다. 바깥 태그는 확장이 자동으로 붙이므로 <!--scenebook JSON 형식과 {{data}} 변수만 유지하세요.'));
    for(const section of [analysis,injection]){
        const rules=el('details','ap2-guide-topic');rules.append(el('summary','','출력 규칙'),el('p','ap2-muted',section===injection?'주입이 켜진 답변에는 최소 한 장을 요구하고 빈 목록을 금지합니다. 저장한 지시문은 유지하며 이전 지시문의 생략 허용 문구보다 이 출력 규칙을 우선하도록 전달합니다. 삽화를 끄려면 프롬프트 주입을 끄세요.':'분석 결과의 JSON 형식 오류를 줄이기 위해 전송 시 덧붙이는 규칙입니다. 저장한 지시문은 변경하지 않습니다.'),el('pre','ap2-code',section===injection?illustrationOutputRules(config):JSON_OUTPUT_RULES));section.append(rules);
    }
    let active=initial==='injection'?2:0;const sections=[image,analysis,injection];sections.forEach((s,n)=>s.hidden=n!==active);
    for(const [i,label]of ['그림체','수동 분석','주입'].entries()){const b=button(label,()=>{active=i;sections.forEach((s,n)=>s.hidden=n!==i);[...tabs.children].forEach((t,n)=>t.setAttribute('aria-pressed',String(n===i)));});b.classList.remove('menu_button','menu_button_icon');b.setAttribute('aria-pressed',String(i===active));tabs.append(b);}body.append(tabs,...sections);
    const read=()=>promptBundle({style:style.read(),negative:negative.read(),quality:quality.read(),analysisPrompt:template.read()===DEFAULT_ANALYSIS_PROMPT?'':template.read(),injectionPrompt:injected.read()===DEFAULT_INJECTION_PROMPT?'':injected.read()});
    const tools=el('div','ap2-actions'),file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    tools.append(button('내보내기',()=>downloadJson(read(),'scenebook-prompts.json')),button('가져오기',()=>file.click()),button('기본 지시문',()=>{if(active===2)injected.input.value=DEFAULT_INJECTION_PROMPT;else template.input.value=DEFAULT_ANALYSIS_PROMPT;notice('기본 지시문을 불러왔습니다. 적용 전까지 저장되지 않습니다.');}),file);body.append(tools);
    file.addEventListener('change',async()=>{try{const f=file.files?.[0];if(!f)return;if(f.size>100000)throw new Error('100KB 이하 프롬프트 파일을 선택하세요.');const v=readPromptBundle(JSON.parse(await f.text()));style.input.value=v.style;negative.input.value=v.negative;quality.input.checked=v.quality;template.input.value=v.analysisPrompt||DEFAULT_ANALYSIS_PROMPT;injected.input.value=v.injectionPrompt||DEFAULT_INJECTION_PROMPT;notice('프롬프트를 불러왔습니다. 내용을 확인한 뒤 적용하세요.');}catch(e){notice(e.message,true);}finally{file.value='';}});
    const footer=el('footer','ap2-footer');footer.append(button('적용',async()=>{const {kind,schema,...value}=read();await onApply(value);dialog.close();},true));dialog.append(footer);
}
