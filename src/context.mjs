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
        history, blocks: narrativeBlocks(target.mes),
        historical: index < chat.length - 1,
        // Explicit, static story data; no globally mutable "latest state" leaks into old turns.
        world: String(options.world ?? '').slice(0, 12000),
        direction: String(options.direction ?? '').slice(0, 4000),
        library: structuredClone(options.library ?? []),
    };
}
export function validateAnchor(scene, context) {
    const block = context.blocks.find(b => b.index === scene.after);
    if (!block) throw new Error('본문에 존재하지 않는 삽입 위치입니다.');
    if (scene.evidence && !normalized(block.content).includes(normalized(scene.evidence))) throw new Error('장면의 원문 근거가 선택한 문단에 없습니다.');
    return { index: block.index, quote: block.content, source: context.source };
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
