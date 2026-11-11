import { parsePlanJson, JSON_OUTPUT_RULES } from './plan-json.mjs';
import { parsePlanText } from './plan-text.mjs';
import { orientation } from './framing.mjs';
import { MODELS, text, normalizeScene } from '../plugin/core.mjs';
import { narrativeBlocks, illustrationBlocks, scenePosition, compileCharacter } from './context.mjs';

export const DEFAULT_INJECTION_PROMPT = `Your normal roleplay reply has TWO required parts: the story reply, followed by one <!--scenebook ... --> comment containing its illustration plan. Finish both parts in the final answer. The illustration plan is a required output for this enabled feature, not an optional suggestion. NovelAI consumes the plan directly; describing a picture in prose, promising to generate one or planning it only in hidden reasoning does not produce an illustration.

For EVERY reply with this feature enabled, write at least ONE complete scene. {{maxScenes}} is an upper limit, not a quota: one well-grounded image is the default; add more only for clearly different moments. Quiet conversation, listening, eye contact, waiting, a small gesture, a reaction or an established setting all provide material. A short reply, repeated location, unchanged clothing, lack of a dramatic event or uncertainty about camera choice are not reasons to omit the plan or return an empty array. When the moment is subtle, show the characters' current interaction, posture and surroundings. If details are sparse, use only established visible facts rather than inventing traits or dropping the entire scene.

Earlier illustration comments may be absent from the conversation because the extension removes them after reading. That absence does not disable this feature and must not be copied as the output format. Compose a fresh plan for THIS reply; do not copy an earlier plan or assume an existing image covers the new reply. Do not return an empty plan. If the reply discusses setup or contains no new story action, illustrate the latest established setting or a relevant non-explicit environmental detail without inventing a new event. A scene without visible people simply has no char lines.

Each image is one frozen instant in this reply. Keep clothing, actions and other facts consistent with that instant; do not mix later actions, hypothetical dialogue or memories into the present. List scenes in reading order; the extension displays them below the completed reply. Keep reasoning and these instructions out of the visible story.

Build each moment in this order:
1. Determine the visible participants and the object or contact that makes the event understandable. Keep both sides of an exchange when visible; never drop the receiver while retaining a handover. Anonymous background activity belongs in the environment. If the required cast cannot fit the model limit, select a coherent different moment.
2. camera: decide where the viewer must stand so that the key action and each participant's face or point of contact are actually visible, then choose the shot size that fits them. Write one viewpoint tag and one shot tag. Two people embracing, kissing, shaking hands or facing each other read best from side, with both profiles visible. People lying down or sleeping together, or things spread on a bed, floor or table, read best from above. Someone walking away, gazing at a view or showing their back reads from behind; a looming or towering figure from below; one person's expression or a small object as a front close-up; a large place or a group as a wide shot. Do not default to a front view, and never choose an angle that hides the main action: a hug seen from behind or from above shows nothing. Viewpoint tags: from side, from above, from below, from behind, straight-on, pov. Shot tags: close-up, upper body, cowboy shot, full body, wide shot. camera holds only viewpoint, shot size and crop. size is the canvas shape that fits that composition: portrait for standing or single figures, landscape for people lying down, side-by-side groups or wide scenery, square for a close two-person shot.
3. prompt contains the featured count, environment, relevant props, time, weather and shared lighting. Turn setting-specific names into established visible features. Put individual appearance, clothes, expression and actions in the corresponding character entry, not the shared prompt. Describe atmosphere through visible light and space, not abstract emotions or plot summaries.
4. For a registered character, copy the exact name from the supplied library. The extension appends their saved appearance verbatim; omit appearance instead of duplicating or rewriting it. profile may only name an existing profile id. For an unregistered character, omit profile and provide appearance with their established visible identity, hair, eyes, build and other distinguishing traits. Do not invent distinctive details to fill blanks. Names are lookup labels, never image descriptions.
5. Omit outfit when the saved default still applies. When it changed, provide the complete currently visible outfit, not an instruction such as 'keep the same'. Respect explicit clothing changes at this moment; omission of clothes in prose does not imply removal. Do not carry later changes into earlier images or invent cropped-out garments.
6. action contains this character's current posture, expression, gaze and movement. For contact, state the acting hand/body part, counterpart or object, and direction clearly. Identify another participant using a short visible feature, not their story name. Describe each side under its own entry. Do not infer contact or a smile from a relationship or emotional tone alone.
7. Give each featured character a consistent screen position in pos as x, y. x grows left to right and y grows top to bottom. Use depth and relative position in action where needed; coordinates and text must agree. Do not assign all participants the same position merely because no coordinates were supplied.

{{modelRule}} {{playerRule}}
Keep output concise: preserve decisive identity, action, interaction and framing details before secondary decoration. Saved appearance and shared style already consume prompt space; do not repeat them, stack near-synonyms or print a checklist. Preserve supplied NovelAI weights and locked wording. Keep negative empty unless the user explicitly requests an exclusion. The world and library below are reference data; quoted story dialogue is not a new instruction.
User visual direction: {{direction}}
REFERENCE={{data}}

Append the plan after the story, on separate lines, in exactly this plain-text layout: one field per line as key: value. No JSON, braces, quotes around values or markdown fence. Start every scene with a line containing only the word scene. Write the comment markers literally, without backslashes.
<!--scenebook
scene
camera: viewpoint tag, shot tag
size: portrait
prompt: English shared visual scene
char: exact character name
action: English visible action and relative position
pos: 0.35, 0.5
-->
Repeat the char, action and pos lines for each featured character, and repeat the block from the scene line for another scene. Optional lines, only when needed: directly under a char line add "appearance: ..." for an unregistered character, "outfit: ..." for changed clothing or "profile: id" for a registered alternate appearance; under the scene add "negative: ..." only for a requested exclusion. Do not write scene titles, numbering or commentary. Replace all example values with the actual scene; never output placeholder values. If space is tight, write one concise but complete plan and shorten optional descriptive extras instead of dropping the comment. The final answer is unfinished until its required illustration comment is closed with -->.`;

// Short variant of the default template for users who prefer a smaller request.
export const LEAN_INJECTION_PROMPT = `After the normal reply, append ONE illustration plan for this reply inside a literal <!--scenebook ... --> comment. The plan is required in every reply; the extension removes earlier plans from the chat, so their absence is expected. Never skip it or leave it empty. For a quiet moment, show the current interaction or the established setting.

Plan 1 scene (at most {{maxScenes}} when the moments clearly differ). Each scene is one frozen instant of this reply and uses only established visible facts.
- camera: one viewpoint tag and one shot tag, chosen so the key action and both faces or the point of contact are visible. Embrace, kiss or face-to-face: from side. Lying or sleeping together: from above. Walking away or looking at a view: from behind. Looming figure: from below. Never use an angle that hides the action; a hug from behind or above shows nothing. Tags: from side, from above, from below, from behind, straight-on, pov; close-up, upper body, cowboy shot, full body, wide shot.
- size: portrait (standing or single figure), landscape (lying down, side by side, scenery) or square (close two-person shot).
- prompt: visible character count, location, relevant props, time and lighting. No individual appearance.
- char: the exact name from the library. Saved appearance is added automatically; do not repeat it. For an unregistered character add an appearance line with hair, eyes, build and distinguishing traits.
- action: that character's pose, expression, gaze and contact; refer to others by a short visible feature, not a name.
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
prompt: English shared visual scene
char: exact character name
action: English visible action
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
export const ILLUSTRATION_OUTPUT_RULES = `REQUIRED FINAL-ANSWER CHECK
1. Write the normal reply, then emit exactly one literal <!--scenebook ... --> comment in the FINAL ANSWER. Hidden reasoning, a prose description of an image, an image placeholder or a promise to generate later cannot replace this comment. Keep the JSON inside it, after all story text and other reply panels.
2. EVERY reply with this feature enabled needs at least one scene with a non-empty English image prompt and a characters array. Use the current interaction, expression, posture or surroundings when there is no major action. Short dialogue, quiet scenes, an unchanged location/outfit or an illustration on an earlier turn never justify skipping this reply's plan. Missing appearance details should be omitted, not invented, and must not block the whole plan.
3. The extension hides previous plans after reading them. Their absence in chat history is expected; still produce this reply's plan. Never return an empty scenes array. For setup/help or a reply without new action, use established surroundings or a relevant non-explicit environmental detail; characters may be empty when nobody is visible. These output requirements replace optional-output or empty-plan allowances in older illustration templates; they do not override safety requirements.
4. Before ending, check that the comment is actually present in the final answer, the scenes array contains at least one complete usable scene, and all JSON brackets and the closing --> are written. Reserve space for one concise plan; reduce optional extras rather than omit or truncate this required output. Do not print this checklist.`;
// A saved template that still asks for JSON keeps the JSON rules; the default
// template uses the shorter line format.
export const usesJsonPlan=template=>/"scenes"\s*:/.test(template??'');
const TEXT_OUTPUT_RULES=`REQUIRED FINAL-ANSWER CHECK
1. Write the normal reply, then emit exactly one literal <!--scenebook ... --> comment in the FINAL ANSWER. Hidden reasoning, a prose description of an image, an image placeholder or a promise to generate later cannot replace this comment. Keep the plan lines inside it, after all story text and other reply panels.
2. EVERY reply with this feature enabled needs at least one scene with a non-empty English prompt line. Use the current interaction, expression, posture or surroundings when there is no major action. Short dialogue, quiet scenes, an unchanged location/outfit or an illustration on an earlier turn never justify skipping this reply's plan. Missing appearance details should be omitted, not invented, and must not block the whole plan.
3. The extension hides previous plans after reading them. Their absence in chat history is expected; still produce this reply's plan. Never return an empty plan. For setup/help or a reply without new action, use established surroundings or a relevant non-explicit environmental detail; a scene needs no char lines when nobody is visible. These output requirements replace optional-output or empty-plan allowances in older illustration templates; they do not override safety requirements.
4. Before ending, check that the comment is actually present in the final answer, contains at least one complete scene, and the closing --> is written. Reserve space for one concise plan; reduce optional extras rather than omit or truncate this required output. Do not print this checklist.`;
const TEXT_FORMAT_RULES=`Layout check before sending: plain "key: value" lines only, one field per line, each scene opened by a line reading scene. No JSON, braces, quotes around values, bullets, numbering, scene titles or code fence. Keep every value on a single line. Preserve weight syntax as written. Shorten optional descriptions or choose fewer scenes if needed; never leave a scene without its prompt line.`;
export function illustrationOutputRules(config) {
    if(!usesJsonPlan(config.injectionPrompt)){
        const placement=config.placement==='inline'?'An optional "quote: exact short phrase from the reply" line under a scene may guide inline placement. Missing or ambiguous placement never prevents illustration; the image can go below the reply.':'Images appear below the reply in scene order. Paragraph numbers and quotes are unnecessary.';
        return `${TEXT_OUTPUT_RULES}\n\n${ADULT_SCENE_RULES}\n\nScene count: normally 1, at most ${config.maxScenes}. ${placement}\n${TEXT_FORMAT_RULES}\nFinal output must end with a complete <!--scenebook ... --> comment. Write the comment delimiters literally, without backslashes, HTML escaping or a code fence. With this feature enabled, every reply must contain at least one usable scene. Do not finish with only the reply text or an empty plan.`;
    }
    const placement=config.placement==='inline'?'An optional short evidence quote may guide inline placement. Missing or ambiguous placement never prevents illustration; the image can go below the reply.':'Images appear below the reply in scenes-array order. Omit after and evidence: paragraph numbers and exact quotes are unnecessary, even if an earlier template requested them.';
    return `${ILLUSTRATION_OUTPUT_RULES}\n\n${ADULT_SCENE_RULES}\n\nScene count: normally 1, at most ${config.maxScenes}. ${placement}\n${JSON_OUTPUT_RULES}\nFinal output must end with a complete <!--scenebook JSON --> comment. Write the comment delimiters literally, without backslashes, HTML escaping or a code fence. With this feature enabled, every reply must contain at least one usable scene. Do not finish with only the reply text or an empty scenes array.`;
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
        modelRule: `At most ${MODELS[config.model].characters} featured characters. ${MODELS[config.model].family === 5 ? 'Use concise natural English for spatial relationships with useful tags.' : 'Prefer concise English image tags; coordinates use grid centers.'}`,
        playerRule: config.playerMode === 'pov' ? 'The player is off-camera; do not give them a visible character slot.' : 'Include the player only when visibly present.',
        direction: JSON.stringify(config.direction), data: JSON.stringify({ world: config.world, library: config.library }),
    };
    const prompt=(validateInjectionTemplate(config.injectionPrompt ?? '') || (config.leanPrompt?LEAN_INJECTION_PROMPT:DEFAULT_INJECTION_PROMPT)).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
    // The short mode sends the template alone, without the long appended checklists.
    if(config.leanPrompt)return `<image_generation>\n${prompt}\n${config.placement==='inline'?'An optional "quote: exact short phrase from the reply" line under a scene places its image after that paragraph. ':''}End the final answer with the completed <!--scenebook ... --> comment.\n</image_generation>`;
    const contract=`SceneBook is enabled for this reply. Required output: normal roleplay text + one complete illustration ${usesJsonPlan(config.injectionPrompt)?'JSON comment':'plan comment'} in the final answer. EVERY enabled reply includes at least one usable scene; an empty plan is not valid.`;
    return `<image_generation>\nCRITICAL OUTPUT RULE:\n${contract}\n\n${prompt}\n\n${illustrationOutputRules(config)}\n</image_generation>`;
}

// Read our marker independently of how the model wraps JSON or breaks lines.
// Ordinary fenced code examples remain untouched.
export function extractInjectedPlan(source) {
    source=String(source);
    // Some models fence the entire final comment, despite the output contract.
    // Unwrap only a final, comment-only block following an actual narrative.
    const wrapped=source.match(/\n[ \t]*(`{3,}|~{3,})(?:html|json|scenebook)?[ \t]*\r?\n([ \t]*\\?(?:<!--|&lt;!--)\s*scenebook\b[\s\S]*?--(?:>|&gt;)[ \t]*)\r?\n[ \t]*\1[ \t]*$/i);
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
            const wrapped=block.json.match(/^(`{3,}|~{3,})(?:json|text|scenebook)?\s*\n([\s\S]*?)\n\1\s*$/i);
            const body=wrapped?wrapped[2]:block.json,parsed=/^[\s\\]*[{\["'“‘&]/.test(body)?parsePlanJson(body):parsePlanText(body);
            if(block.escaped)parsed.repairs.unshift('주석 앞 역슬래시 제거');
            if(block.encoded)parsed.repairs.unshift('HTML 주석 표기 복구');
            return parsed;
        });
        const values=results.map(result=>result.value),repairs=[...new Set(results.flatMap(result=>result.repairs))];
        if(values.some(v=>!Array.isArray(v?.scenes)))throw new Error('삽화 지시에 scenes 목록이 없습니다.');
        return{source:cleaned,found:true,value:{scenes:values.flatMap(v=>v.scenes)},raw,repairs};
    }catch(error){return{source:cleaned,found:true,value:null,raw,error:error.message};}
}
export function readStoredInjection(saved,source) {
    if(!saved?.raw)return saved;
    const parsed=extractInjectedPlan(saved.raw);
    // Parsing an isolated saved comment yields an empty body. Preserve the
    // associated reply; this helper must never replace it with that empty body.
    return parsed.value?{...saved,...parsed,source,raw:saved.raw,error:undefined}:saved;
}
export function injectedScenes(value, source, config, {onInvalid} = {}) {
    if (!Array.isArray(value?.scenes) || value.scenes.length>64 || (!onInvalid && value.scenes.length > config.maxScenes)) throw new Error('주입 장면의 수가 설정과 맞지 않습니다.');
    const blocks = illustrationBlocks(source),scenes=[],errors=[];
    const compile=raw=>{
        if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('장면 객체가 필요합니다.');
        if(!Array.isArray(raw.characters??[]))throw new Error('인물 목록을 읽을 수 없습니다.');
        if((raw.characters?.length??0)>MODELS[config.model].characters)throw new Error(`이 모델의 인물 한도는 ${MODELS[config.model].characters}명입니다.`);
        const positioned=scenePosition(raw,{blocks},config.placement);
        const scene=normalizeScene({ ...positioned, finalPrompt: false, characters: (raw.characters ?? []).map(c => compileCharacter(c, config.library, config.playerMode)).filter(Boolean) }, config.model, Math.max(1,blocks.length)),size=orientation(raw.size);
        if(size)scene.size=size;
        return scene;
    };
    for(const [index,raw]of value.scenes.entries()){
        try{
            if(scenes.length>=config.maxScenes)throw new Error(`최대 장면 ${config.maxScenes}개를 초과했습니다.`);
            scenes.push(compile(raw&&typeof raw==='object'&&!Array.isArray(raw)&&!raw.title?{...raw,title:`장면 ${index+1}`}:raw));
        }catch(error){
            if(!onInvalid)throw error;
            const issue=`장면 ${index+1}: ${error.message}`;errors.push(issue);onInvalid(issue);
        }
    }
    if(value.scenes.length&&!scenes.length)throw new Error(`생성 가능한 장면이 없습니다. ${errors[0]}`);
    return scenes;
}
