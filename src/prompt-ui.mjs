import { DEFAULT_ANALYSIS_PROMPT, promptBundle, readPromptBundle } from './prompts.mjs';
import { el, button, field, modal, notice, downloadJson } from './ui.mjs';

export function promptEditor(config,onApply){
    const {dialog,body}=modal('프롬프트');
    const tabs=el('div','ap2-actions'),image=el('div'),analysis=el('div');analysis.hidden=true;
    const style=field('그림체',config.style,{multiline:true,rows:5}),negative=field('제외 요소',config.negative,{multiline:true}),quality=field('품질 태그',config.quality,{type:'checkbox'});
    image.append(style.wrap,negative.wrap,quality.wrap,el('p','ap2-muted','모든 장면의 공통값입니다. 장면·인물별 프롬프트는 장면 편집에서 수정합니다.'));
    const template=field('장면 분석 지시문',config.analysisPrompt||DEFAULT_ANALYSIS_PROMPT,{multiline:true,rows:17});
    analysis.append(template.wrap,el('p','ap2-muted','{{data}} 채팅·인물 · {{maxScenes}} 장면 수 · {{modelRule}} 모델별 작성법 · {{playerRule}} POV · {{direction}} 수정 지시. JSON 응답 형식을 유지하세요.'));
    const ta=button('이미지',()=>{image.hidden=false;analysis.hidden=true;ta.setAttribute('aria-pressed','true');tb.setAttribute('aria-pressed','false');}),tb=button('장면 분석',()=>{image.hidden=true;analysis.hidden=false;ta.setAttribute('aria-pressed','false');tb.setAttribute('aria-pressed','true');});ta.setAttribute('aria-pressed','true');tb.setAttribute('aria-pressed','false');tabs.append(ta,tb);body.append(tabs,image,analysis);
    const read=()=>promptBundle({style:style.read(),negative:negative.read(),quality:quality.read(),analysisPrompt:template.read()===DEFAULT_ANALYSIS_PROMPT?'':template.read()});
    const tools=el('div','ap2-actions'),file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    tools.append(button('내보내기',()=>downloadJson(read(),'scenebook-prompts.json')),button('가져오기',()=>file.click()),button('기본 지시문',()=>{template.input.value=DEFAULT_ANALYSIS_PROMPT;notice('기본 지시문을 불러왔습니다. 적용 전까지 저장되지 않습니다.');}),file);body.append(tools);
    file.addEventListener('change',async()=>{try{const f=file.files?.[0];if(!f)return;if(f.size>100000)throw new Error('100KB 이하 프롬프트 파일을 선택하세요.');const v=readPromptBundle(JSON.parse(await f.text()));style.input.value=v.style;negative.input.value=v.negative;quality.input.checked=v.quality;template.input.value=v.analysisPrompt||DEFAULT_ANALYSIS_PROMPT;notice('프롬프트를 불러왔습니다. 내용을 확인한 뒤 적용하세요.');}catch(e){notice(e.message,true);}finally{file.value='';}});
    const footer=el('footer','ap2-footer');footer.append(button('적용',async()=>{const {kind,schema,...value}=read();await onApply(value);dialog.close();},true));dialog.append(footer);
}
