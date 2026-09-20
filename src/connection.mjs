// Connection profiles include authentication in their completion preset. Never
// activate a profile or switch the user's active key just to run an analysis.
export async function requestAnalysis(ctx, service, vertexRequest, profileId, prompt, maxTokens, options={}) {
    const signal=options.signal??AbortSignal.timeout(120000);
    let profile=null,preset=null;
    if(profileId){
        profile=ctx.extensionSettings.connectionManager?.profiles?.find(p=>p.id===profileId);
        if(!profile)throw new Error('분석 연결 프로필을 찾을 수 없습니다. 씬북 설정에서 다시 선택하세요.');
    }
    const source=profile?ctx.CONNECT_API_MAP?.[profile.api]?.source:(ctx.mainApi==='openai'?ctx.chatCompletionSettings?.chat_completion_source:null);
    if(source==='vertexai'){
        if(!profile&&ctx.chatCompletionSettings?.reverse_proxy){
            return {content:await ctx.generateRaw({prompt,responseLength:maxTokens,trimNames:false})};
        }
        if(profile?.preset){
            preset=ctx.getPresetManager?.('openai')?.getCompletionPresetByName(profile.preset);
            if(!preset)throw new Error('Vertex 프로필에 저장된 프리셋을 찾을 수 없습니다. 연결 프로필을 다시 저장하세요.');
        }
        const c={...ctx.chatCompletionSettings,...preset};
        const auth={vertexai_auth_mode:c.vertexai_auth_mode??'express',vertexai_region:profile?.['api-url']||c.vertexai_region||'us-central1',vertexai_express_project_id:c.vertexai_express_project_id??''};
        if(profile?.proxy&& !['<None>','<Empty>'].includes(profile.proxy)){
            // Explicit user proxies stay on ST's existing proxy transport.
            return service.sendRequest(profileId,prompt,maxTokens,{extractData:true,includePreset:true,includeInstruct:options.includeInstruct!==false,stream:false,signal},auth);
        }
        const messages=Array.isArray(prompt)?structuredClone(prompt):[{role:'user',content:prompt}];
        const payload={...auth,model:profile?.model||c.vertexai_model,messages,max_tokens:maxTokens,secret_id:profile?.['secret-id']||null,
            temperature:c.temp_openai,top_p:c.top_p_openai,top_k:c.top_k_openai,reasoning_effort:c.reasoning_effort,use_sysprompt:c.use_sysprompt!==false,custom_prompt_post_processing:profile?.['prompt-post-processing']??c.custom_prompt_post_processing};
        return vertexRequest(payload,signal);
    }
    if(profileId)return service.sendRequest(profileId,prompt,maxTokens,{extractData:true,includePreset:true,includeInstruct:options.includeInstruct!==false,stream:false,signal});
    if(!ctx.generateRaw)throw new Error('현재 채팅 연결로 분석할 수 없습니다. 생성 설정에서 연결 프로필을 선택하세요.');
    return {content:await ctx.generateRaw({prompt,responseLength:maxTokens,trimNames:false})};
}

export function analysisError(error){
    const messages=[];let current=error;
    for(let i=0;current&&i<5;i++,current=current.cause)if(current.message&&!messages.includes(current.message))messages.push(current.message);
    const detail=messages.filter(m=>!['API request failed','Response not OK'].includes(m)).join(' · ');
    return detail||'분석 연결이 요청을 거부했습니다. 연결 프로필의 인증 방식·키·프리셋을 확인하세요.';
}
