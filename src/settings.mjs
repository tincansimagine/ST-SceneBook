import { DEFAULTS } from '../plugin/core.mjs';
import { migrateWorkflow } from './automatic.mjs';
const KEY='autopic2',HISTORY='scenebookSettingsHistory';
export function settingsSnapshot(value){return Object.fromEntries(Object.keys(DEFAULTS).filter(k=>value?.[k]!==undefined).map(k=>[k,structuredClone(value[k])]));}
export function preserveSettings(store,value,{now=Date.now(),reason='변경 전',force=false}={}){
    const previous=store[KEY];
    if(previous&&JSON.stringify(settingsSnapshot(previous))!==JSON.stringify(settingsSnapshot(value))){
        const history=Array.isArray(store[HISTORY])?store[HISTORY]:[];
        if(force||!history.length||now-history[0].time>60000){history.unshift({time:now,reason,settings:settingsSnapshot(previous)});store[HISTORY]=history.slice(0,10);}
    }
    // Retain future/legacy fields owned by this extension; no whole-store reset.
    store[KEY]={...previous,...structuredClone(value)};
    return store[KEY];
}
export function initializeSettings(store){
    const saved=store[KEY],next=migrateWorkflow(saved,DEFAULTS);
    const changed=JSON.stringify(saved)!==JSON.stringify(next);
    if(changed)preserveSettings(store,next,{reason:'업데이트 전',force:true});
    return changed;
}
export function settingsHistory(store){return structuredClone(Array.isArray(store[HISTORY])?store[HISTORY]:[]);}
