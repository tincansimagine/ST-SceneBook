import { GenerationService, ApiError } from './service.mjs';
import { MODELS } from './core.mjs';
import { listReferences,saveReference } from './references.mjs';

export const info = { id: 'autopic2', name: '씬북', description: 'Isolated NovelAI illustration service with durable job recovery.' };
export async function init(router) {
    // Loaded only in SillyTavern, keeping the protocol and service testable in isolation.
    const { readSecret, SECRET_KEYS } = await import('../../src/endpoints/secrets.js');
    const { extractFileFromZipBuffer } = await import('../../src/util.js');
    const service = new GenerationService({ extractPng: buffer => extractFileFromZipBuffer(buffer, '.png') });
    registerRoutes(router, { service, readKey: directories => readSecret(directories, SECRET_KEYS.NOVEL) });
}
// The same routes can be exercised against ST's real directory contract without
// reading the user's keys or sending a paid request during integration tests.
export function registerRoutes(router, { service, readKey }) {
    const wrap = handler => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            if (!req.user?.directories) throw new ApiError(401, '로그인이 필요합니다.');
            return await handler(req, res);
        } catch (e) {
            res.status(e instanceof ApiError ? e.status : 500).json({ error: e instanceof ApiError ? e.message : '서버 저장소를 확인하세요.', code: e.code ?? 'SERVER_ERROR' });
        }
    };
    router.get('/health', wrap(async (req, res) => {
        await service.locations(req.user.directories);
        res.json({ version: '0.4.1', models: MODELS, hasKey: !!readKey(req.user.directories) });
    }));
    router.get('/jobs', wrap(async (req, res) => res.json({ jobs: await service.list(req.user.directories) })));
    router.post('/review',wrap(async(req,res)=>res.json(await service.review(req.user.directories,req.body?.id,req.body?.review))));
    router.get('/references',wrap(async(req,res)=>res.json({references:await listReferences(req.user.directories)})));
    router.post('/references',wrap(async(req,res)=>{
        try{res.json(await saveReference(req.user.directories,req.body));}catch(e){throw new ApiError(400,e.message,'INVALID_REFERENCE');}
    }));
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
