import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { buildPayload, normalizeScene, validateConfig } from './core.mjs';
import { applyReferences } from './references.mjs';

export class ApiError extends Error {
    constructor(status, message, code = 'REQUEST_FAILED') { super(message); this.status = status; this.code = code; }
}
const validId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function completePng(bytes) {
    if(bytes.length<45||bytes.length>32*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return false;
    let offset=8,header=false,data=false;
    while(offset+12<=bytes.length){
        const length=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8);
        if(offset+12+length>bytes.length)return false;
        if(!header){if(kind!=='IHDR'||length!==13||!bytes.readUInt32BE(offset+8)||!bytes.readUInt32BE(offset+12))return false;header=true;}
        if(kind==='IDAT')data=true;
        if(kind==='IEND')return length===0&&data&&offset+12===bytes.length;
        offset+=length+12;
    }
    return false;
}
async function atomic(file, data) {
    const temporary=`${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, file);
}
export class GenerationService {
    constructor({ fetchImpl = fetch, extractPng, timeoutMs = 180000 }) {
        this.fetch = fetchImpl; this.extractPng = extractPng; this.timeoutMs = timeoutMs;
        this.active = new Map(); this.cooldowns = new Map();
    }
    async locations(directories) {
        if (typeof directories?.root !== 'string' || !directories.root || typeof directories?.userImages !== 'string' || !directories.userImages) throw new ApiError(500, 'SillyTavern 사용자 저장 경로를 읽을 수 없습니다. 씬북 서버 플러그인을 업데이트하고 서버를 재시작하세요.', 'USER_DIRECTORIES');
        const ledger = path.join(directories.root, 'autopic2-jobs');
        const images = path.join(directories.userImages, 'autopic2');
        await Promise.all([mkdir(ledger, { recursive: true }), mkdir(images, { recursive: true })]);
        return { ledger, images, user: path.resolve(directories.root) };
    }
    async list(directories) {
        const dirs = await this.locations(directories);
        const files = (await readdir(dirs.ledger)).filter(x => validId(x.slice(0, -5)) && x.endsWith('.json'));
        const records = await Promise.all(files.map(async name => {
            try {
                const r = JSON.parse(await readFile(path.join(dirs.ledger, name), 'utf8'));
                if (r.status === 'running' && this.active.get(dirs.user)?.id !== r.id) r.status = 'uncertain';
                if(r.status==='uncertain'){
                    const image=await readFile(path.join(dirs.images,`${r.id}.png`)).catch(()=>null);
                    if(image&&completePng(image)){r.status='done';r.url=`/user/images/autopic2/${r.id}.png`;await atomic(path.join(dirs.ledger,name),r);}
                }
                return r;
            } catch { return null; }
        }));
        return records.filter(Boolean).sort((a, b) => b.created - a.created).slice(0, 100);
    }
    async review(directories,id,review){
        if(!validId(id)||!review||typeof review.summary!=='string'||review.summary.length>4000||!Array.isArray(review.issues)||review.issues.length>20||review.issues.some(x=>typeof x!=='string'||x.length>1000))throw new ApiError(400,'검수 결과 형식을 확인하세요.');
        const dirs=await this.locations(directories),file=path.join(dirs.ledger,id+'.json');
        const record=JSON.parse(await readFile(file,'utf8'));if(record.status!=='done')throw new ApiError(409,'완성된 이미지만 검수할 수 있습니다.');
        record.review={summary:review.summary,issues:review.issues,created:Date.now()};await atomic(file,record);return record;
    }
    async generate(directories, key, input) {
        if (!key) throw new ApiError(401, 'SillyTavern API 연결에서 NovelAI 키를 먼저 저장하세요.', 'NO_KEY');
        if (!validId(input?.id)) throw new ApiError(400, '올바른 작업 ID가 필요합니다.');
        let config, scene;
        try {
            config = validateConfig(input.config);
            scene = normalizeScene(input.scene, config.model);
            buildPayload(scene, config, 0);
        } catch (e) { throw new ApiError(400, e.message, 'INVALID_INPUT'); }
        const dirs = await this.locations(directories);
        const fingerprint = hash({ config, scene });
        // Acquire before any await: even two tabs with different job IDs cannot overlap.
        if (this.active.has(dirs.user)) throw new ApiError(409, '다른 이미지가 생성 중입니다. 완료 후 다시 시도하세요.', 'BUSY');
        const controller = new AbortController();
        this.active.set(dirs.user, { id: input.id, controller });
        const file = path.join(dirs.ledger, `${input.id}.json`);
        let record;
        try {
            let previous;
            try { previous = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
            if (previous) {
                if (previous.fingerprint !== fingerprint) throw new ApiError(409, '같은 작업 ID로 다른 요청을 보낼 수 없습니다.', 'ID_CONFLICT');
                if (previous.status === 'done') return previous;
                throw new ApiError(409, '이미 접수된 작업입니다. 복구함을 확인하세요. 새 생성은 새 작업으로 시작해야 합니다.', 'ALREADY_SUBMITTED');
            }
            if ((this.cooldowns.get(dirs.user) ?? 0) > Date.now()) throw new ApiError(429, 'NovelAI 요청 제한 대기 중입니다. 잠시 후 다시 시도하세요.', 'COOLDOWN');
            const seed = config.seed === -1 ? randomInt(0, 4294967296) : config.seed;
            const payload = buildPayload(scene, config, seed);
            record = { id: input.id, fingerprint, status: 'running', created: Date.now(), scene, config, seed };
            // Persist intent BEFORE the paid request. A restart never silently replays it.
            await atomic(file, record);
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                if(config.references.length)await applyReferences(payload,config,directories,key,this.fetch,controller.signal);
                const response = await this.fetch('https://image.novelai.net/ai/generate-image', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                    body: JSON.stringify(payload), signal: controller.signal,
                });
                if (!response.ok) {
                    if (response.status === 429) this.cooldowns.set(dirs.user, Date.now() + 60000);
                    const messages = { 400: 'NovelAI가 생성 설정을 거부했습니다.', 401: 'NovelAI 키를 확인하세요.', 402: 'Anlas 또는 생성 한도가 부족합니다.', 403: '계정의 모델 사용 권한을 확인하세요.', 429: 'NovelAI 요청 한도입니다. 최소 60초 후 다시 시도하세요.' };
                    throw new ApiError(response.status >= 500 ? 502 : response.status, messages[response.status] ?? 'NovelAI 생성에 실패했습니다. 복구함을 확인하세요.', `NAI_${response.status}`);
                }
                const declaredSize = Number(response.headers.get('content-length'));
                if (declaredSize > 32 * 1024 * 1024) throw new Error('이미지 응답 크기가 너무 큽니다.');
                const archive = await response.arrayBuffer();
                if (archive.byteLength > 32 * 1024 * 1024) throw new Error('이미지 응답 크기가 너무 큽니다.');
                const png = Buffer.from(await this.extractPng(archive) ?? []);
                if (!completePng(png)) throw new Error('유효한 PNG가 반환되지 않았습니다.');
                const imageFile=path.join(dirs.images,`${input.id}.png`);
                await writeFile(`${imageFile}.tmp`,png);await rename(`${imageFile}.tmp`,imageFile);
                record = { ...record, status: 'done', url: `/user/images/autopic2/${input.id}.png`, finished: Date.now() };
                await atomic(file, record);
                return record;
            } finally { clearTimeout(timeout); }
        } catch (error) {
            if (record) {
                // A lost connection/timeout can still have consumed credits. Never auto-retry.
                const uncertain = !(error instanceof ApiError) || error.status >= 500;
                record = { ...record, status: uncertain ? 'uncertain' : 'failed', error: error instanceof ApiError ? error.message : '결과를 확인할 수 없습니다. 자동 재시도하지 않았습니다.', finished: Date.now() };
                await atomic(file, record).catch(() => {});
            }
            if (error instanceof ApiError) throw error;
            throw new ApiError(502, '생성 결과를 확인할 수 없습니다. 복구함에서 확인하세요. 중복 결제를 막기 위해 자동 재시도하지 않습니다.', 'UNCERTAIN');
        } finally { this.active.delete(dirs.user); }
    }
}
