const KEY='autopic2';
export const VISUAL_FIELDS=['world','direction','playerMode','library'];
export const visualFields=value=>Object.fromEntries(VISUAL_FIELDS.filter(key=>Object.hasOwn(value??{},key)).map(key=>[key,structuredClone(value[key])]));
export function characterKey(ctx){
    // Group generation changes the active speaker; it is not a stable owner.
    if(ctx.groupId!==undefined&&ctx.groupId!==null&&ctx.groupId!=='')return null;
    const avatar=ctx.characters?.[ctx.characterId]?.avatar;
    return typeof avatar==='string'&&avatar?avatar:null;
}
export function characterVisuals(ctx){
    const value=ctx.extensionSettings?.[KEY]?.characterVisuals;
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
export function hasVisualScope(ctx,where){
    if(where==='account')return true;
    if(where==='chat')return!!ctx.getCurrentChatId?.()&&!!ctx.chatMetadata?.[KEY]?.visual;
    const key=characterKey(ctx),saved=characterVisuals(ctx);
    return where==='character'&&!!key&&Object.hasOwn(saved,key)&&!!saved[key];
}
export function activeVisualScope(ctx){
    return hasVisualScope(ctx,'chat')?'chat':hasVisualScope(ctx,'character')?'character':'account';
}
export function resolveVisualSettings(ctx,account,where=null){
    const result={...account};
    if(where==='account')return result;
    if(hasVisualScope(ctx,'character'))Object.assign(result,visualFields(characterVisuals(ctx)[characterKey(ctx)]));
    if(where!=='character'&&hasVisualScope(ctx,'chat'))Object.assign(result,visualFields(ctx.chatMetadata[KEY].visual));
    return result;
}
