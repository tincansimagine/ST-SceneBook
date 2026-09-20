import { MODELS, SAMPLERS, validateConfig } from '../plugin/core.mjs';
import { el, button, modal, addField, readFields } from './ui.mjs';

export function generationEditor(config,onApply){
    const {dialog,body}=modal('생성 설정','이번 작업에 적용합니다. 계정 기본값은 바꾸지 않습니다.');const fields={};
    const model=addField(body,fields,'model','모델',config.model,{choices:Object.entries(MODELS).map(([id,m])=>[id,m.label])}),size=el('div','ap2-grid');body.append(size);
    for(const [key,label]of [['width','가로'],['height','세로']])addField(size,fields,key,label,config[key],{type:'number',min:64,max:2048,step:64});
    const sampling=el('div','ap2-grid');body.append(sampling);addField(sampling,fields,'steps','Steps',config.steps,{type:'number',min:1,max:50,step:1});addField(sampling,fields,'scale','Guidance',config.scale,{type:'number',min:0,max:10,step:.1});
    const seed=addField(body,fields,'seed','Seed',config.seed,{type:'number',min:-1,max:4294967295,step:1,help:'-1: 무작위'});body.append(button('무작위',()=>{seed.value=-1;}));
    const advanced=el('details','ap2-guide-topic');advanced.append(el('summary','','고급 설정'));body.append(advanced);
    addField(advanced,fields,'sampler','샘플러',config.sampler,{choices:SAMPLERS.map(v=>[v,v])});const scheduler=addField(advanced,fields,'scheduler','스케줄러',config.scheduler,{choices:['karras','exponential','polyexponential','native'].map(v=>[v,v])});
    addField(advanced,fields,'cfgRescale','CFG rescale',config.cfgRescale,{type:'number',min:0,max:1,step:.05});const transparent=addField(advanced,fields,'transparent','투명 배경',config.transparent,{type:'checkbox'});
    addField(body,fields,'budgetGuard','비용 보호',config.budgetGuard,{type:'checkbox',help:'1,048,576픽셀·28 Steps 상한'});
    const update=()=>{const v5=model.value.startsWith('nai-diffusion-5-');if(v5)scheduler.value='karras';scheduler.disabled=v5;transparent.disabled=!v5;if(!v5)transparent.checked=false;};model.addEventListener('change',update);update();
    const footer=el('footer','ap2-footer');footer.append(button('적용',async()=>{const next=validateConfig({...config,...readFields(fields)});await onApply(next);dialog.close();},true));dialog.append(footer);
}
