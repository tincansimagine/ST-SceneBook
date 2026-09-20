import { DEFAULTS, validateConfig, normalizeScene } from '../plugin/core.mjs';
export const renderKeys=['model','width','height','steps','scale','seed','sampler','scheduler','cfgRescale','style','negative','quality','budgetGuard','transparent','useCoords','useOrder'];
export function sceneBundle(scenes,config){
    const clean=validateConfig(config);
    return{kind:'scenebook-scenes',schema:1,config:Object.fromEntries(renderKeys.map(k=>[k,clean[k]])),scenes:scenes.map(s=>normalizeScene(s,clean.model)).map(({after,evidence,...s})=>s)};
}
export function readSceneBundle(value,current,after){
    if(value?.kind!=='scenebook-scenes'||value.schema!==1||!value.config)throw new Error('씬북 장면 파일이 아닙니다.');
    if(!Array.isArray(value.scenes)||!value.scenes.length||value.scenes.length>current.maxScenes)throw new Error(`장면은 1~${current.maxScenes}개여야 합니다.`);
    const patch=Object.fromEntries(renderKeys.filter(k=>Object.hasOwn(value.config,k)).map(k=>[k,value.config[k]]));
    const config=validateConfig({...DEFAULTS,...current,...patch,references:[],budgetGuard:current.budgetGuard});
    const scenes=value.scenes.map(s=>normalizeScene({...s,after,evidence:''},config.model));
    return{config,scenes};
}
