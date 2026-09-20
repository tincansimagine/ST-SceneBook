import { renderAnalysis } from './prompts.mjs';
// Story data is kept separate from render settings and from generated observations.
export function normalized(value) { return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim(); }
export function narrativeBlocks(source) {
    const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
    const result = []; let pending = [], fence = '', protectedTag = '', quote = '', offset = 0, start = 0;
    const flush = () => {
        const content = pending.join('\n').trim();
        if (content) result.push({ index: result.length + 1, content, start, end: offset });
        pending = [];
    };
    for (const line of lines) {
        const marker = line.match(/^\s*(`{3,}|~{3,})/);
        if (fence) { if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ''; offset += line.length + 1; continue; }
        if (protectedTag) { if (new RegExp(`</${protectedTag}\\s*>`, 'i').test(line)) protectedTag = ''; offset += line.length + 1; continue; }
        if (marker) { flush(); fence = marker[1]; offset += line.length + 1; continue; }
        const html = line.match(/^\s*<(details|script|style|table|pre|div|section|autopic|lb-xnai)\b/i);
        if (html) { flush(); if (!new RegExp(`</${html[1]}\\s*>`, 'i').test(line)) protectedTag = html[1]; offset += line.length + 1; continue; }
        if (!line.trim() && !quote) { flush(); offset += line.length + 1; continue; }
        if (/^\s*(?:#{1,6}\s|\|.*\||!\[|<!--)/.test(line) && !quote) { flush(); offset += line.length + 1; continue; }
        if (!pending.length) start = offset;
        pending.push(line);
        for (let i = 0; i < line.length; i++) {
            const c = line[i]; if (line[i - 1] === '\\') continue;
            if (quote) { if (c === quote) quote = ''; }
            else if (c === '“') quote = '”';
            else if (c === '「') quote = '」';
            else if (c === '『') quote = '』';
            else if (c === '"') quote = '"';
        }
        offset += line.length + 1;
    }
    flush(); return result;
}
export function createContext(chat, index, options = {}) {
    if (!Number.isInteger(index) || !chat[index] || chat[index].is_user || chat[index].is_system) throw new Error('삽화를 넣을 캐릭터 메시지를 선택하세요.');
    const target = chat[index];
    const history = chat.slice(Math.max(0, index - (options.contextMessages ?? 8)), index)
        .filter(m => !m.is_system).map(m => ({ role: m.is_user ? 'user' : 'character', name: String(m.name ?? ''), text: String(m.mes ?? '').slice(-8000) }));
    return {
        source: String(target.mes ?? ''), swipe: target.swipe_id ?? 0,
        history, blocks: illustrationBlocks(target.mes),
        historical: index < chat.length - 1,
        // Explicit, static story data; no globally mutable "latest state" leaks into old turns.
        world: String(options.world ?? '').slice(0, 12000),
        direction: String(options.direction ?? '').slice(0, 4000),
        library: structuredClone(options.library ?? []),
    };
}
export function illustrationBlocks(source) {
    const blocks=narrativeBlocks(source),content=String(source??'');
    // HTML-formatted replies can have no plain paragraphs. The reply itself is
    // still a valid illustration target; paragraph parsing is only a UI aid.
    return blocks.length||!content.trim()?blocks:[{index:1,content:content.trim(),start:0,end:content.length}];
}
export function scenePosition(scene, context, placement='end') {
    if(!scene||typeof scene!=='object'||Array.isArray(scene))return scene;
    const blocks=context.blocks??[],tail=blocks.at(-1)?.index??1;
    if(placement!=='inline')return{...scene,after:tail,evidence:''};
    const quote=typeof scene.evidence==='string'&&scene.evidence.length<=2000?normalized(scene.evidence):'';
    const matches=quote?blocks.filter(b=>normalized(b.content).includes(quote)):[];
    const block=matches.length===1?matches[0]:null;
    return{...scene,after:block?.index??tail,evidence:block?(quote||block.content.slice(0,2000)):''};
}
export function validateAnchor(scene, context, placement='end') {
    const block = placement==='inline'&&context.blocks.find(b => b.index === scene.after);
    if(block&&scene.evidence&&normalized(block.content).includes(normalized(scene.evidence)))return{index:block.index,quote:block.content,source:context.source};
    // Empty quote marks a reply-level attachment, independent of paragraphs.
    return { index: 0, quote: '', source: context.source };
}
export function compileCharacter(character, library, playerMode = 'auto') {
    const entry = library.find(x => x.id === character.id) ?? library.find(x => x.name === character.name);
    if (entry?.player && playerMode === 'pov') return null;
    const profile = entry?.profiles?.find(x => x.id === (character.profileId || entry.defaultProfileId));
    if (character.profileId && !profile) throw new Error('존재하지 않는 외형 프로필입니다.');
    const identity = profile?.appearance ?? entry?.appearance ?? character.appearance ?? '';
    const outfit = character.outfit ?? profile?.outfit ?? entry?.outfit ?? '';
    return { ...character, name: entry?.name ?? character.name, negative:[entry?.negative,character.negative].filter(Boolean).join(', '), prompt: [identity, outfit, character.action ?? character.prompt].filter(Boolean).join(', ') };
}
export const planInstruction = renderAnalysis;
