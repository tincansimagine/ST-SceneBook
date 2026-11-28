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
// Placements that put a picture after one paragraph: chosen by hand, or by the AI.
export const byParagraph = placement => placement === 'inline' || placement === 'auto';
// A quote copied by a model is rarely exact: spacing, punctuation, a changed
// particle or a dropped word. Paragraphs are compared by their pairs of letters.
const compact = value => normalized(value).toLowerCase().replace(/[\s"'“”‘’「」『』*_~`.,!?…:;()\[\]{}<>\-—–·]+/g, '');
function letterPairs(value) {
    const s = compact(value), pairs = new Set();
    for (let i = 0; i < s.length - 1; i++) pairs.add(s.slice(i, i + 2));
    if (s.length === 1) pairs.add(s);
    return pairs;
}
// How much of the quote appears in the text, from 0 to 1.
export function quoteScore(quote, text) {
    const wanted = letterPairs(quote); if (!wanted.size) return 0;
    const found = letterPairs(text); let hit = 0;
    for (const pair of wanted) if (found.has(pair)) hit++;
    return hit / wanted.size;
}
// The paragraph a quote comes from: an exact match first, otherwise the clearly
// closest one. Two paragraphs that fit about equally well are not guessed between.
export function matchParagraph(quote, blocks, minimum = .5) {
    const q = normalized(quote); if (!q || !blocks.length) return null;
    const exact = blocks.find(b => normalized(b.content).includes(q)); if (exact) return exact;
    let best = null, top = 0, runnerUp = 0;
    for (const block of blocks) {
        const score = quoteScore(q, block.content);
        if (score > top) { runnerUp = top; top = score; best = block; } else if (score > runnerUp) runnerUp = score;
    }
    return top >= minimum && top - runnerUp >= .08 ? best : null;
}
export function scenePosition(scene, context, placement='end') {
    if(!scene||typeof scene!=='object'||Array.isArray(scene))return scene;
    const blocks=context.blocks??[],tail=blocks.at(-1)?.index??1;
    if(!byParagraph(placement))return{...scene,after:tail,evidence:''};
    const quote=typeof scene.evidence==='string'&&scene.evidence.length<=2000?normalized(scene.evidence):'';
    // The quote decides; a paragraph number given with it is used only when the quote cannot be found.
    const number=Number(scene.after),numbered=Number.isInteger(number)?blocks.find(b=>b.index===number):null;
    const block=matchParagraph(quote,blocks)??numbered;
    return{...scene,after:block?.index??tail,evidence:block?(quote&&normalized(block.content).includes(quote)?quote:block.content.slice(0,2000)):''};
}
// The paragraph on screen that a picture belongs after. A reply shown translated
// or reformatted no longer contains the quoted words: then the paragraph in the
// same position is used, as long as the paragraph count is about the same.
export function displayParagraph(nodes, anchor, sourceCount) {
    if (!anchor?.quote || !nodes.length) return null;
    const wanted = normalized(String(anchor.quote).replace(/[*_]/g, ''));
    const same = nodes.find(n => normalized(n.textContent) === wanted); if (same) return same;
    let best = null, top = 0;
    for (const n of nodes) { const score = quoteScore(wanted, n.textContent); if (score > top) { top = score; best = n; } }
    if (top >= .8) return best;
    const total = sourceCount || nodes.length;
    if (!(anchor.index > 0) || Math.abs(nodes.length - total) > Math.max(1, Math.round(total * .2))) return null;
    const position = nodes.length === total ? anchor.index - 1 : Math.round(anchor.index / total * nodes.length) - 1;
    return nodes[Math.max(0, Math.min(nodes.length - 1, position))];
}
export function validateAnchor(scene, context, placement='end') {
    const block = byParagraph(placement)&&context.blocks.find(b => b.index === scene.after);
    // The reply text itself is not copied here: the view that holds the slot already keeps it.
    if(block&&scene.evidence&&normalized(block.content).includes(normalized(scene.evidence)))return{index:block.index,quote:block.content};
    // Empty quote marks a reply-level attachment, independent of paragraphs.
    return { index: 0, quote: '' };
}
const KIND = /^\s*1?(girl|boy|other)\s*(?:,\s*|$)/i;
function leadingKind(value) {
    const source = String(value ?? ''), match = source.match(KIND);
    return match ? [match[1].toLowerCase(), source.slice(match[0].length)] : ['', source];
}
export function compileCharacter(character, library, playerMode = 'auto') {
    const entry = library.find(x => x.id === character.id) ?? library.find(x => x.name === character.name);
    if (entry?.player && playerMode === 'pov') return null;
    const profile = entry?.profiles?.find(x => x.id === (character.profileId || entry.defaultProfileId));
    if (character.profileId && !profile) throw new Error('존재하지 않는 외형 프로필입니다.');
    const identity = profile?.appearance ?? entry?.appearance ?? character.appearance ?? '';
    const outfit = character.outfit ?? profile?.outfit ?? entry?.outfit ?? '';
    // NovelAI expects a character prompt to open with girl, boy or other, without
    // a number. Whichever part states it, it is written once, at the front.
    const [stated, look] = leadingKind(identity), [acted, action] = leadingKind(character.action ?? character.prompt);
    return { ...character, name: entry?.name ?? character.name, negative:[entry?.negative,character.negative].filter(Boolean).join(', '), prompt: [stated || acted, look, outfit, action].filter(Boolean).join(', ') };
}
export const planInstruction = renderAnalysis;
