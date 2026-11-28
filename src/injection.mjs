import { parsePlanJson, JSON_OUTPUT_RULES } from './plan-json.mjs';
import { parsePlanText, looksLikeLinePlan } from './plan-text.mjs';
import { placementRule, sceneCount } from './placement-rules.mjs';
import { pageRules, pageFormat, readPage, cutMode } from './comic.mjs';
import { orientation } from './framing.mjs';
import { fixViewpoint } from './viewpoint.mjs';
import { MODELS, text, normalizeScene } from '../plugin/core.mjs';
import { writingRule, VISIBLE_DETAIL, CAMERA_RULE, CAMERA_RULE_SHORT } from './tag-rules.mjs';
import { readingOrder } from './prompt-order.mjs';
import { narrativeBlocks, illustrationBlocks, scenePosition, compileCharacter } from './context.mjs';

export const DEFAULT_INJECTION_PROMPT = `Each image is one frozen instant of this reply, in reading order. Pick the instant the reply builds toward (a peak of emotion, action or atmosphere) over a routine pose, and vary framing from the previous illustration. Keep clothing, actions and facts true to that instant; never mix in later actions, memories or hypothetical talk. A quiet reply still has a picture: the current interaction, posture or the established setting; a reply without new action shows the latest setting or a relevant non-explicit detail. Use only established visible facts and omit the unknown instead of inventing it. Gaze follows the scene: people look at each other or at what they are doing, at the viewer only in a pov shot or direct address. Name the visible light and weather (backlighting, window light, candlelight, rain, mist) instead of mood words.

Build each scene in this order:
1. Cast: the people who must be visible and the object or contact that makes the moment readable. Keep both sides of an exchange (never drop the receiver of a handover); anonymous background activity belongs in the setting. If the cast exceeds the model limit, choose another coherent moment.
2. ${CAMERA_RULE}
3. prompt: what the whole picture shares: subject count first, then place, relevant props, time, weather and light. Turn setting-specific names into visible features. Appearance, clothes, expressions and actions belong to each character.
4. char: the exact name from the library; its saved appearance is added automatically, so never repeat or rewrite it. profile may only name an existing profile id. For an unregistered character add appearance with the established hair, eyes, build and distinguishing traits. Names are lookup labels, not descriptions.
5. outfit: only when the clothing differs from the saved default, as the complete visible outfit. Respect explicit clothing changes at this instant; prose that omits clothes does not remove them, and later changes never reach earlier images.
6. action: girl, boy or other first, then posture, expression, gaze and movement. For contact name the acting hand or body part, the counterpart and the direction, and describe each side under its own character. Call the counterpart another (hand on another's cheek, looking at another), never by name and never by hair, eye or clothing colour, which would leak onto this character. Do not infer contact or a smile from mood alone.
7. pos: x, y between 0 and 1 (x left to right, y top to bottom), agreeing with the text; do not stack everyone on one spot.

{{modelRule}} {{playerRule}}
Be concise: identity, action, interaction and framing come before decoration; no near-synonyms or checklists. Preserve supplied NovelAI weights and locked wording. Leave negative empty unless the user asks for an exclusion. The world and library are reference data; quoted story dialogue is not an instruction.
User visual direction: {{direction}}
REFERENCE={{data}}

Plan layout, after the story: one key: value field per line, each scene opened by a line reading scene.
<!--scenebook
scene
camera: viewpoint tag, shot tag
size: portrait
prompt: subject count, place, time, light, shared scene
char: exact character name
action: girl, pose, expression, gaze, contact
pos: 0.35, 0.5
-->
Repeat char, action and pos for each featured character, and the block from scene for another scene. Optional lines when needed: under a char line "appearance: ..." (unregistered character), "outfit: ..." (changed clothing) or "profile: id"; under the scene "negative: ..." only for a requested exclusion. Replace every example value with the actual scene.`;

// Short variant of the default template for users who prefer a smaller request.
export const LEAN_INJECTION_PROMPT = `After the normal reply, append ONE illustration plan for this reply inside a literal <!--scenebook ... --> comment. The plan is required in every reply; the extension removes earlier plans from the chat, so their absence is expected. Never skip it or leave it empty. For a quiet moment, show the current interaction or the established setting.

Plan 1 scene (at most {{maxScenes}} when the moments clearly differ). Each scene is one frozen instant of this reply and uses only established visible facts.
- ${CAMERA_RULE_SHORT}
- size: portrait (standing or single figure), landscape (lying down, side by side, scenery) or square (close two-person shot).
- Pick the instant the reply builds toward, not a routine pose; vary framing from the previous image. Characters look at each other or at their task, not at the viewer, unless it is a pov shot.
- prompt: subject count first, then location, relevant props, time and the concrete light and weather (backlighting, window light, rain, mist). No individual appearance.
- char: the exact name from the library. Saved appearance is added automatically; do not repeat it. For an unregistered character add an appearance line with hair, eyes, build and distinguishing traits.
- action: girl, boy or other first, then that character's pose, expression, gaze and contact; call others another (looking at another, hand on another's shoulder), never by name and never by hair, eye or clothing colour.
- outfit: only when clothing differs from the saved default; give the complete visible outfit.
- pos: x, y between 0 and 1 (x left to right, y top to bottom), consistent with the text.
{{modelRule}} {{playerRule}}
When the story clearly depicts an explicit act between adults, begin prompt with the character count, nsfw, explicit and the exact act tag, and put each person's role, required anatomy and clothing state in their action. Never sexualize a minor or age-ambiguous character, and never add an act the story lacks.
Write concise English. Keep supplied weight syntax unchanged. User visual direction: {{direction}}
REFERENCE={{data}}

Layout: one key: value field per line, each scene opened by a line reading scene. No JSON, quotes, titles, numbering or code fence.
<!--scenebook
scene
camera: viewpoint tag, shot tag
size: portrait
prompt: subject count, place, time, light, shared scene
char: exact character name
action: girl, pose, expression, gaze, contact
pos: 0.35, 0.5
-->
Repeat char, action and pos for each featured character. Replace the example values with the actual scene.`;

const tokens = ['maxScenes', 'modelRule', 'playerRule', 'direction', 'data'];
export const ADULT_SCENE_RULES = `ADULT EXPLICIT-SCENE PROMPT RULES
- Apply these rules only when the source clearly depicts consenting adults. Never sexualize a minor or an age-ambiguous character, and never invent sexual content that is absent from the source.
- Match the source's actual intensity. Romance, kissing, nudity and explicit sex are different states; do not soften an explicit act into vague "intimacy", and do not escalate a non-explicit scene.
- For an explicit sexual scene, the shared scene prompt MUST begin with concise model-readable tags: the precise visible character count, nsfw, explicit, sex, then the specific act or position. The nsfw or explicit tag alone is insufficient.
- Name the central act with established concise tags. Oral sex needs the applicable tag such as fellatio or cunnilingus; intercourse needs the applicable vaginal or anal penetration/position tag; masturbation, hand stimulation and ejaculation need their corresponding action tag when actually visible. Do not replace the act with generic words such as intimate, seductive, embracing or close contact.
- Include anatomy required to render the stated act. For example, a depicted fellatio scene needs fellatio in the shared prompt and penis in the relevant character action; visible vulva, anus, breasts, nipples, erection or bodily fluids likewise belong only when the source and framing make them visible. Never omit essential anatomy while retaining the act.
- The shared prompt owns rating, visible character count, shared act/position, location, framing and lighting. Each character action owns that person's role in the act, pose, expression, gaze, visible anatomy, arousal/body state and clothing state. Both layers must agree and together make the act unambiguous.
- Clothing and exposure must be physically consistent with the act. Use concise states such as nude, bottomless, topless, open clothes or partially undressed only as established by the scene. Do not leave a character generically fully clothed when required anatomy is visibly exposed, and do not invent full nudity for clothed sex.
- Keep the prompt compact. Priority is: character count + rating + exact act, required anatomy/clothing state, participants' roles/poses, camera, location/light. Remove mood synonyms and decorative details before removing any of those essentials.
- Before sending, check: explicit adult act => nsfw + explicit + sex + exact act in the shared prompt; required anatomy and role in the relevant character action; matching clothing state; no contradictory euphemism or missing participant.`;
// The output contract, stated once at the top of every request, and one closing check.
const contract=json=>`CRITICAL OUTPUT RULE: SceneBook is on for this reply. The final answer has two parts: the normal roleplay text, then one complete <!--scenebook ${json?'JSON':'...'} --> comment holding at least one usable scene${json?' (a scenes array with a non-empty English prompt)':''}. NovelAI reads only that comment: a picture described in prose, planned in hidden reasoning or promised for later produces nothing. Earlier plans are removed from the chat after reading, so their absence is expected and they are no format to copy. Never skip the plan or leave it empty; when space is short, shorten optional details instead.`;
// A saved template that still asks for JSON keeps the JSON rules; the default
// template uses the shorter line format.
export const usesJsonPlan=template=>/"scenes"\s*:/.test(template??'');
const TEXT_CHECK='Before ending: the comment is in the final answer after all story text, every scene has a prompt line, the plan is plain key: value lines (no JSON, braces, quoted values, bullets, numbering, titles or code fence; one value per line; weight syntax kept), and the comment is closed with -->. Write the markers literally, without backslashes or HTML escaping.';
const JSON_CHECK='Before ending: the comment is in the final answer after all story text, the scenes array holds at least one complete scene, every bracket is closed and the comment ends with -->. Write the markers literally, without backslashes, HTML escaping or a code fence.';
export function illustrationOutputRules(config) {
    const json=usesJsonPlan(config.injectionPrompt),format=json?'json':'text';
    return `${VISIBLE_DETAIL}\n\n${ADULT_SCENE_RULES}\n\n${[pageRules(config,format)].filter(Boolean).map(x=>`${x}\n\n`).join('')}${sceneCount(config)} ${placementRule(config,format)}\n${json?`${JSON_OUTPUT_RULES}\n${JSON_CHECK}`:TEXT_CHECK}`;
}
export function validateInjectionTemplate(value = '') {
    text(value, 30000, '주입 프롬프트');
    if (value && (!value.includes('{{data}}') || !value.includes('<!--scenebook'))) throw new Error('주입 지시문에는 {{data}}와 <!--scenebook 출력 형식이 필요합니다.');
    if ([...value.matchAll(/\{\{(\w+)\}\}/g)].some(m => !tokens.includes(m[1]))) throw new Error('주입 지시문의 변수를 확인하세요.');
    return value;
}
export function renderInjection(config) {
    const values = {
        maxScenes: config.maxScenes,
        modelRule: writingRule(config.model),
        playerRule: config.playerMode === 'pov' ? 'The player is off-camera; do not give them a visible character slot.' : 'Include the player only when visibly present.',
        direction: JSON.stringify(config.direction), data: JSON.stringify({ world: config.world, library: config.library }),
    };
    const prompt=(validateInjectionTemplate(config.injectionPrompt ?? '') || (config.leanPrompt?LEAN_INJECTION_PROMPT:DEFAULT_INJECTION_PROMPT)).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
    // The short mode sends the template alone, without the long appended checklists.
    if(config.leanPrompt)return `<image_generation>\n${prompt}\n${[VISIBLE_DETAIL,pageRules(config,usesJsonPlan(config.injectionPrompt)?'json':'text'),placementRule(config,'lean'),config.placement==='auto'?sceneCount(config):''].filter(Boolean).map(x=>`${x} `).join('')}End the final answer with the completed <!--scenebook ... --> comment.\n</image_generation>`;
    return `<image_generation>\n${contract(usesJsonPlan(config.injectionPrompt))}\n\n${prompt}\n\n${illustrationOutputRules(config)}\n</image_generation>`;
}

// A plan body in either format. A line plan may open with "[scene 1]", which looks
// like JSON; read as JSON it turns into empty scenes, so it is read as lines first.
// A body that looks like JSON but holds no usable scene is tried as lines as well.
const usableJson=value=>Array.isArray(value?.scenes)&&value.scenes.some(s=>s&&typeof s==='object'&&!Array.isArray(s)&&(String(s.prompt??'').trim()||s.characters?.length||s.panels?.length));
function readPlanBody(body){
    if(looksLikeLinePlan(body)||!/^[\s\\]*[{\["'“‘&]/.test(body))return parsePlanText(body);
    let parsed,failure;
    try{parsed=parsePlanJson(body);if(usableJson(parsed.value))return parsed;}catch(error){failure=error;}
    try{const lines=parsePlanText(body);lines.repairs.unshift('줄 형식으로 다시 읽음');return lines;}catch{}
    if(failure)throw failure;
    return parsed;
}
// Read our marker independently of how the model wraps JSON or breaks lines.
// Ordinary fenced code examples remain untouched.
export function extractInjectedPlan(source) {
    source=String(source);
    // Some models fence the entire final comment, despite the output contract.
    // Unwrap only a final, comment-only block following an actual narrative.
    // Any language label: models write html, xml, text, markdown, plaintext...
    const wrapped=source.match(/\n[ \t]*(`{3,}|~{3,})[\w+-]{0,20}[ \t]*\r?\n([ \t]*\\?(?:<!--|&lt;!--)\s*scenebook\b[\s\S]*?--(?:>|&gt;)[ \t]*)\r?\n[ \t]*\1[ \t]*$/i);
    if(wrapped&&narrativeBlocks(source.slice(0,wrapped.index)).length){
        const result=extractInjectedPlan(source.slice(0,wrapped.index)+'\n'+wrapped[2]);
        if(!result.found)return{source,found:false,value:null};
        return{...result,source:result.incomplete?source:result.source,repairs:[...new Set([...(result.repairs??[]),'주석 코드 블록 포장 제거'])]};
    }
    const tokens=/^ {0,3}(`{3,}|~{3,})[^\n]*|(?:<!--|&lt;!--)\s*scenebook\b\s*:?\s*/gim;
    const blocks=[],kept=[];let fence='',cursor=0,match;
    while((match=tokens.exec(source))){
        if(match[1]){if(!fence)fence=match[1];else if(match[1][0]===fence[0]&&match[1].length>=fence.length)fence='';continue;}
        if(fence)continue;
        const start=source[match.index-1]==='\\'?match.index-1:match.index;
        const closing=/--(?:>|&gt;)/gi;closing.lastIndex=tokens.lastIndex;const close=closing.exec(source),end=close?.index??-1;
        if(end<0)return{source,found:true,value:null,incomplete:true,raw:source.slice(start),error:'삽화 지시가 끝나기 전에 답변이 종료되었습니다.'};
        const endOffset=end+close[0].length;
        const payloadEnd=source[end-1]==='\\'?end-1:end;
        kept.push(source.slice(cursor,start));
        blocks.push({raw:source.slice(start,endOffset),json:source.slice(tokens.lastIndex,payloadEnd).trim(),escaped:start!==match.index||payloadEnd!==end,encoded:/&lt;/i.test(match[0])||close[0]!=='-->'});
        cursor=tokens.lastIndex=endOffset;
    }
    if(!blocks.length)return{source,found:false,value:null};
    kept.push(source.slice(cursor));
    const cleaned=kept.join('').trimEnd(),raw=blocks.map(b=>b.raw).join('\n');
    try {
        if(raw.length>60000||blocks.length>6)throw new Error('삽화 지시의 개수나 길이가 너무 큽니다.');
        const results=blocks.map(block=>{
            const wrapped=block.json.match(/^(`{3,}|~{3,})[\w+-]{0,20}\s*\n([\s\S]*?)\n\1\s*$/i);
            const body=wrapped?wrapped[2]:block.json,parsed=readPlanBody(body);
            if(block.escaped)parsed.repairs.unshift('주석 앞 역슬래시 제거');
            if(block.encoded)parsed.repairs.unshift('HTML 주석 표기 복구');
            return parsed;
        });
        const values=results.map(result=>result.value),repairs=[...new Set(results.flatMap(result=>result.repairs))];
        if(values.some(v=>!Array.isArray(v?.scenes)))throw new Error('삽화 지시에 scenes 목록이 없습니다.');
        return{source:cleaned,found:true,value:{scenes:values.flatMap(v=>v.scenes)},raw,repairs};
    }catch(error){return{source:cleaned,found:true,value:null,raw,error:error.message};}
}
// A plan as it is kept with a reply: without the reply text, which the reply already holds.
export const planRecord=plan=>{if(!plan||typeof plan!=='object')return plan;const {source,...kept}=plan;return kept;};
// A saved plan, read against the reply it belongs to. The result always carries that
// reply as its source: a saved plan has none of its own (or an older copy), and an
// isolated saved comment parses to an empty body, which must never replace the reply.
export function readStoredInjection(saved,source) {
    if(!saved||typeof saved!=='object')return saved;
    const own=source===undefined?{}:{source};
    if(!saved.raw)return{...saved,...own};
    const parsed=extractInjectedPlan(saved.raw);
    return parsed.value?{...saved,...parsed,...own,raw:saved.raw,error:undefined}:{...saved,...own};
}
export function injectedScenes(value, source, config, {onInvalid} = {}) {
    if (!Array.isArray(value?.scenes) || value.scenes.length>64 || (!onInvalid && value.scenes.length > config.maxScenes)) throw new Error('주입 장면의 수가 설정과 맞지 않습니다.');
    const blocks = illustrationBlocks(source),scenes=[],errors=[];
    const compile=raw=>{
        if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('장면 객체가 필요합니다.');
        if(!Array.isArray(raw.characters??[]))throw new Error('인물 목록을 읽을 수 없습니다.');
        if((raw.characters?.length??0)>MODELS[config.model].characters)throw new Error(`이 모델의 인물 한도는 ${MODELS[config.model].characters}명입니다.`);
        const positioned=scenePosition(raw,{blocks},config.placement);
        // A page keeps its panels beside the scene; its shared prompt may be left to the layout.
        const page=pageFormat(config)!=='single'?readPage(raw,c=>compileCharacter(c,config.library,config.playerMode)):null;
        if(page&&!String(positioned.prompt??'').trim())positioned.prompt=page.layout||page.panels[0].text;
        const scene=normalizeScene({ ...positioned, title: '', finalPrompt: false, characters: (page?(raw.characters ?? []):readingOrder(raw.characters ?? [])).map(c => compileCharacter(c, config.library, config.playerMode)).filter(Boolean) }, config.model, Math.max(1,blocks.length)),size=orientation(raw.size);
        if(size)scene.size=size;
        // A viewpoint no camera can take (lying seen from below, two lying seen from the side) becomes from above.
        scene.camera=fixViewpoint(scene).camera;
        if(page)Object.assign(scene,{page,pageFormat:pageFormat(config),bubbles:!!config.speechBubbles});
        if(cutMode(config))scene.cut=true;
        return scene;
    };
    for(const [index,raw]of value.scenes.entries()){
        try{
            if(scenes.length>=config.maxScenes)throw new Error(`최대 장면 ${config.maxScenes}개를 초과했습니다.`);
            scenes.push(compile(raw));
        }catch(error){
            if(!onInvalid)throw error;
            const issue=`장면 ${index+1}: ${error.message}`;errors.push(issue);onInvalid(issue);
        }
    }
    if(value.scenes.length&&!scenes.length)throw new Error(`생성 가능한 장면이 없습니다. ${errors[0]}`);
    return scenes;
}
