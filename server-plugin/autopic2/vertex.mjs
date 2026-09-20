// Uses the selected ST secret only on the server. No profile activation, key
// exposure, custom destination URL, or automatic retry is involved.
export class VertexError extends Error {
    constructor(message,code='VERTEX_REQUEST',status=400){super(message);Object.assign(this,{code,status});}
}
const identifier=(value,name)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value))throw new VertexError(`${name} 설정을 확인하세요.`);return value;};
export class VertexService {
    constructor({readSecret,keys,convertPrompt,postProcess,thinkingBudget,sign,safety=[],fetchImpl=fetch}){Object.assign(this,{readSecret,keys,convertPrompt,postProcess,thinkingBudget,sign,safety,fetch:fetchImpl});}
    async request(dirs,input,signal=AbortSignal.timeout(120000)){
        const model=identifier(input?.model,'Vertex 모델'),region=identifier(input.vertexai_region||'us-central1','Vertex 리전');
        if(!/^[a-z0-9-]+$/.test(region))throw new VertexError('Vertex 리전 설정을 확인하세요.');
        if(!Array.isArray(input.messages)||!input.messages.length||input.messages.length>60||JSON.stringify(input.messages).length>24000000)throw new VertexError('분석 메시지 형식을 확인하세요.');
        if(!Number.isInteger(input.max_tokens)||input.max_tokens<1||input.max_tokens>65536)throw new VertexError('분석 응답 길이를 확인하세요.');
        if(input.reverse_proxy||input.proxy_password)throw new VertexError('프록시 연결은 SillyTavern 연결 프로필을 사용하세요.');
        let mode=input.vertexai_auth_mode??'express',secret;
        if(!['express','full'].includes(mode))throw new VertexError('Vertex 인증 방식을 확인하세요.');
        const id=input.secret_id;
        if(id!==undefined&&id!==null&&id!==''&&typeof id!=='string')throw new VertexError('Vertex 키 ID를 확인하세요.');
        if(id){
            const express=this.readSecret(dirs,this.keys.VERTEXAI,id),full=this.readSecret(dirs,this.keys.VERTEXAI_SERVICE_ACCOUNT,id);
            if(!express&&!full)throw new VertexError('프로필에 지정된 Vertex 키를 찾을 수 없습니다. 연결 프로필의 키를 다시 선택하세요.','VERTEX_KEY');
            // The key's storage bucket identifies API key versus service-account JSON.
            mode=full&&!express?'full':express&&!full?'express':mode;
            secret=mode==='full'?full:express;
        }else secret=this.readSecret(dirs,mode==='full'?this.keys.VERTEXAI_SERVICE_ACCOUNT:this.keys.VERTEXAI);
        if(!secret)throw new VertexError(mode==='full'?'Vertex Full 서비스 계정 키가 없습니다.':'Vertex Express API 키가 없습니다.','VERTEX_KEY');
        let project=input.vertexai_express_project_id||'',headers={'Content-Type':'application/json'};
        if(mode==='full'){
            let account;try{account=JSON.parse(secret);project=identifier(account.project_id,'Vertex 프로젝트');}catch{throw new VertexError('Vertex 서비스 계정 JSON을 확인하세요.','VERTEX_KEY');}
            let assertion;try{assertion=await this.sign(account);}catch{throw new VertexError('Vertex 서비스 계정 서명에 실패했습니다. 키를 확인하세요.','VERTEX_KEY');}
            const token=await this.fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal});
            if(!token.ok)throw new VertexError(`Vertex 서비스 계정 인증 실패 (${token.status}).`,'VERTEX_AUTH',token.status===429?429:401);
            const data=await token.json();if(!data.access_token)throw new VertexError('Vertex 인증 토큰을 받지 못했습니다.','VERTEX_AUTH',401);
            headers.Authorization=`Bearer ${data.access_token}`;
        }else headers['x-goog-api-key']=secret;
        if(project)identifier(project,'Vertex 프로젝트');
        // Express without a project uses Google's global Express endpoint.
        const hostname=region==='global'||!project?'aiplatform.googleapis.com':`${region}-aiplatform.googleapis.com`;
        const resource=project?`projects/${encodeURIComponent(project)}/locations/${region}/publishers/google`:'publishers/google';
        const url=`https://${hostname}/v1/${resource}/models/${encodeURIComponent(model)}:generateContent`;
        const names={userName:'',charName:'',startsWithGroupName:()=>false};
        const messages=this.postProcess&&input.custom_prompt_post_processing?this.postProcess(structuredClone(input.messages),input.custom_prompt_post_processing,names):structuredClone(input.messages);
        const converted=this.convertPrompt(messages,model,input.use_sysprompt!==false,names);
        const generationConfig={maxOutputTokens:input.max_tokens};
        // Match the host's current model restrictions; newer Flash models reject sampling fields.
        if(!/gemini-3\.[67]-flash|gemini-3\.5-flash-lite/.test(model))for(const [from,to,min,max]of [['temperature','temperature',0,2],['top_p','topP',0,1],['top_k','topK',1,1000]]){
            if(input[from]!==undefined&&input[from]!==null){const n=Number(input[from]);if(from==='top_k'&&n===0)continue;if(!Number.isFinite(n)||n<min||n>max)throw new VertexError(`${from} 값을 확인하세요.`);generationConfig[to]=n;}
        }
        if(/^gemini-(2\.5|3[.\d]*)-(flash|pro)/.test(model)&&!/-image/.test(model)&&this.thinkingBudget){
            const budget=this.thinkingBudget(input.max_tokens,input.reasoning_effort,model);
            generationConfig.thinkingConfig={includeThoughts:false,...(Number.isInteger(budget)?{thinkingBudget:budget}:typeof budget==='string'&&budget?{thinkingLevel:budget}:{})};
        }
        const body={contents:converted.contents,generationConfig,safetySettings:this.safety};
        if(converted.system_instruction?.parts?.length)body.systemInstruction=converted.system_instruction;
        const response=await this.fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal});
        if(!response.ok)throw new VertexError(`Vertex ${mode==='full'?'Full':'Express'} 요청 실패 (${response.status}). ${response.status===429?'요청 한도를 확인하세요.':'선택한 키의 모델 권한·리전·프로젝트를 확인하세요.'}`,'VERTEX_API',response.status>=500?502:response.status);
        const data=await response.json(),candidate=data.candidates?.[0];
        if(candidate?.finishReason==='MAX_TOKENS')throw new VertexError('Vertex 응답이 길이 제한으로 잘렸습니다. 분석 장면 수를 줄이거나 프롬프트를 간결하게 조정하세요.','VERTEX_OUTPUT');
        const content=candidate?.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('')??'';
        if(!content)throw new VertexError('Vertex가 분석 텍스트를 반환하지 않았습니다. 연결 프로필과 모델 응답을 확인하세요.','VERTEX_OUTPUT');
        return {content};
    }
}
