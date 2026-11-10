import { sourceKey } from '../plugin/core.mjs';
import { illustrationBlocks, scenePosition } from './context.mjs';
// Illustrations are stored against the exact reply text. When the user edits
// the reply, carry that swipe's illustrations over to the edited text.
const filled=view=>!!(view?.slots?.length||view?.draft?.length||view?.injected||view?.automatic);
export function adoptEditedView(data,message,placement='end'){
    const views=data?.views;if(!views||typeof views!=='object')return false;
    const source=String(message.mes??''),swipe=message.swipe_id??0,key=sourceKey(source,swipe);
    if(filled(views[key])&&views[key].source===source)return false;
    const stale=Object.keys(views).filter(k=>k!==key&&k.startsWith(`${swipe}-`)&&filled(views[k]));
    const from=stale.findLast(k=>views[k].slots?.length)??stale.at(-1);
    if(!from)return false;
    const view=views[from],previous=view.source,blocks=illustrationBlocks(source);
    delete views[from];delete views[key];views[key]=view;view.source=source;
    for(const slot of view.slots??[]){
        const anchor=slot.anchor;if(!anchor)continue;
        // Keep an inline picture beside its paragraph, including when that paragraph was the edited one.
        const block=anchor.quote?blocks.find(b=>b.content===anchor.quote)??blocks.find(b=>b.index===anchor.index):null;
        slot.anchor=block?{index:block.index,quote:block.content,source}:{index:0,quote:'',source};
    }
    if(Array.isArray(view.draft))view.draft=view.draft.map(scene=>scenePosition(scene,{blocks},placement));
    // The stored plan was already handled for this reply; an edit must not replay it.
    if(view.automatic?.source===previous)view.automatic.source=source;
    return true;
}
