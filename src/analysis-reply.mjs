import { parsePlanJson } from './plan-json.mjs';
import { parsePlanText } from './plan-text.mjs';

export const EMPTY_REPLY='장면을 쓰는 AI의 답이 비어 있습니다. 생각(추론)하는 모델이 답 길이를 생각에 모두 쓴 경우가 많습니다. 그림 설정 → 수동 분석에서 분석 답 길이를 늘리거나 모델의 추론 수준을 낮춰 주세요.';
// Each {...} in the text whose braces balance, skipping braces inside strings.
function* objects(text){
    for(let start=text.indexOf('{');start>=0;start=text.indexOf('{',start+1)){
        let depth=0,quoted=false,escaped=false;
        for(let i=start;i<text.length;i++){
            const ch=text[i];
            if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
            if(ch==='"')quoted=true;else if(ch==='{')depth++;
            else if(ch==='}'&&--depth===0){yield text.slice(start,i+1);break;}
        }
    }
}
// The scenes in a scene-writing reply. Models put the JSON after a sentence of
// explanation, inside a code fence, after visible thinking, or write the line
// format instead; a reply cut off by the length limit still yields what is complete.
export function readAnalysisReply(content){
    const text=String(content??'').replace(/<(think|thinking|reasoning|thought)>[\s\S]*?<\/\1>/gi,'').replace(/^[\s\S]*?<\/(?:think|thinking|reasoning)>/i,'').trim();
    if(!text)throw new Error(EMPTY_REPLY);
    const attempts=[text];
    for(const match of text.matchAll(/(`{3,}|~{3,})[a-z]*[ \t]*\r?\n([\s\S]*?)\r?\n\1/gi))attempts.push(match[2]);
    for(const chunk of objects(text))if(/"?scenes"?\s*:/.test(chunk))attempts.push(chunk);
    const brace=text.search(/\{\s*"?scenes/);if(brace>0)attempts.push(text.slice(brace));
    for(const attempt of attempts){try{const value=parsePlanJson(attempt.trim()).value;if(Array.isArray(value?.scenes))return value;}catch{}}
    try{return parsePlanText(text).value;}catch{}
    throw new Error(`장면 분석 결과를 읽지 못했습니다. 기존 초안은 유지됩니다. ${CUT_REPLY_HELP}`);
}
// The reply length for scene writing: chosen by hand, or 16,000 tokens. Thinking models
// spend this length on their thoughts before the answer, so a short limit cuts the answer off.
export const AUTO_ANALYSIS_LENGTH=16000;
export function analysisLength(config){
    const chosen=Number(config.analysisLength);
    return chosen>=1000?Math.min(128000,Math.round(chosen)):AUTO_ANALYSIS_LENGTH;
}
// Said when a reply cannot be read: the usual cause and what to change.
export const CUT_REPLY_HELP='생각(추론)하는 모델은 답 길이를 생각에 먼저 쓰기 때문에, 길이가 모자라면 결과가 중간에 잘립니다(실리태번 검은 창에 finish_reason: length). 그림 설정 → 수동 분석에서 분석 답 길이를 직접 정하기로 늘리거나(24,000 이상), 연결 프로필의 추론 수준을 낮추거나, 분석 방식을 빠르게로 바꿔 주세요.';
