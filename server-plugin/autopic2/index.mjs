import { GenerationService, ApiError } from './service.mjs';
import { MODELS } from './core.mjs';
import { listReferences,saveReference } from './references.mjs';
import { VertexService,VertexError } from './vertex.mjs';

export const info = { id: 'autopic2', name: '씬북', description: 'Isolated NovelAI illustration service with durable job recovery.' };
export async function init(router) {
    // Loaded only in SillyTavern, keeping the protocol and service testable in isolation.
    const { readSecret, SECRET_KEYS } = await import('../../src/endpoints/secrets.js');
    const { extractFileFromZipBuffer } = await import('../../src/util.js');
    const service = new GenerationService({ extractPng: buffer => extractFileFromZipBuffer(buffer, '.png') });
    // Lazy-load the Vertex adapter so hosts without Vertex support can still draw.
    let vertexPromise;
    const vertexRequest=async(directories,payload,signal)=>{
        vertexPromise??=Promise.all([import('../../src/prompt-converters.js'),import('../../src/endpoints/google.js'),import('../../src/constants.js')]).then(([convert,google,constants])=>new VertexService({readSecret,keys:SECRET_KEYS,convertPrompt:convert.convertGooglePrompt,postProcess:convert.postProcessPrompt,thinkingBudget:convert.calculateGoogleBudgetTokens,sign:google.generateJWTToken,safety:[...constants.GEMINI_SAFETY,...constants.VERTEX_SAFETY]}));
        return (await vertexPromise).request(directories,payload,signal);
    };
    registerRoutes(router, { service, readKey: directories => readSecret(directories, SECRET_KEYS.NOVEL), vertexRequest });
}
// The same routes can be exercised against ST's real directory contract without
// reading the user's keys or sending a paid request during integration tests.
export function registerRoutes(router, { service, readKey, vertexRequest }) {
    const wrap = handler => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            if (!req.user?.directories) throw new ApiError(401, '로그인이 필요합니다.');
            return await handler(req, res);
        } catch (e) {
            const known=e instanceof ApiError||e instanceof VertexError;
            if(!res.destroyed)res.status(known ? e.status : 500).json({ error: known ? e.message : '서버 요청 처리에 실패했습니다. 서버 연결과 저장소를 확인하세요.', code: e.code ?? 'SERVER_ERROR' });
        }
    };
    router.get('/health', wrap(async (req, res) => {
        await service.locations(req.user.directories);
        res.json({ version: '0.4.4', models: MODELS, hasKey: !!readKey(req.user.directories) });
    }));
    router.get('/jobs', wrap(async (req, res) => res.json({ jobs: await service.list(req.user.directories) })));
    router.post('/vertex',wrap(async(req,res)=>{
        if(!vertexRequest)throw new ApiError(501,'씬북 서버 플러그인을 업데이트하고 서버를 재시작하세요.','SERVER_UPDATE');
        const controller=new AbortController(),closed=()=>{if(!res.writableEnded)controller.abort();};res.on('close',closed);
        try{const result=await vertexRequest(req.user.directories,req.body,AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]));if(!res.destroyed)res.json(result);}
        catch(e){if(e?.name==='AbortError'||e?.name==='TimeoutError')throw new VertexError('Vertex 분석이 중단되었거나 응답 시간이 초과됐습니다. 자동 재시도하지 않았습니다.','VERTEX_TIMEOUT',504);throw e;}
        finally{res.removeListener('close',closed);}
    }));
    router.post('/review',wrap(async(req,res)=>res.json(await service.review(req.user.directories,req.body?.id,req.body?.review))));
    router.get('/references',wrap(async(req,res)=>res.json({references:await listReferences(req.user.directories)})));
    router.post('/references',wrap(async(req,res)=>{
        try{res.json(await saveReference(req.user.directories,req.body));}catch(e){throw new ApiError(400,e.message,'INVALID_REFERENCE');}
    }));
    router.post('/references/delete',wrap(async(req,res)=>res.json(await service.deleteReference(req.user.directories,req.body?.id))));
    router.post('/generate', wrap(async (req, res) => {
        const result = await service.generate(req.user.directories, readKey(req.user.directories), req.body);
        if (!res.destroyed) res.json(result);
    }));
    router.get('/account', wrap(async (req, res) => {
        const key = readKey(req.user.directories);
        if (!key) throw new ApiError(401, 'NovelAI 키를 먼저 저장하세요.');
        const response = await fetch('https://image.novelai.net/user/subscription', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new ApiError(502, 'NovelAI 계정 상태를 조회할 수 없습니다.');
        const data = await response.json();
        res.json({ active: data.active, tier: data.tier, trainingStepsLeft: data.trainingStepsLeft, usage: data.usage });
    }));
}
export default { info, init };
