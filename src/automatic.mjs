// MESSAGE_RECEIVED and GENERATION_ENDED arrive in opposite orders for streaming
// and non-streaming replies. Keep both signals; never await our work in ST events.
export class AutomaticResponses {
    constructor({ scope, message, aborted = () => false, abortSignal = () => null, read = () => null, waitForRender = false, run, error = () => {} }) {
        Object.assign(this, { scope, message, aborted, abortSignal, read, waitForRender, run, error });
        this.pending = []; this.seen = []; this.active = null; this.running = false;
        this.observed = new WeakMap();
    }
    start(type, dryRun = false) {
        if (dryRun || type === 'quiet') return;
        // An interrupted renderer from a previous reply must not hold later
        // replies behind a completion event that will never arrive.
        if(this.waitForRender)this.pending=this.pending.filter(p=>p.finalized);
        this.active = { scope: this.scope(), ended: false, stopped: type === 'impersonate', previousSignal: this.abortSignal() };
    }
    stop() {
        if (this.active) this.active.stopped = true;
        this.pending = this.pending.filter(p => p.generation !== this.active);
    }
    end() {
        if (this.active) this.active.ended = true;
        this.schedule();
    }
    receive(index, type, finalized = false) {
        if (['quiet', 'impersonate', 'first_message'].includes(type)) return;
        const message = this.message(Number(index));
        if (!message || message.is_user || message.is_system || !String(message.mes ?? '').trim()) return;
        const generation = this.active;
        const previous=this.observed.get(message),swipe=message.swipe_id??0,scope=this.scope(),signal=this.abortSignal();
        // Render notifications also occur when browsing old messages. Only use
        // one as a completion signal for a reply received in this generation.
        if(finalized&&(!previous||previous.generation!==generation||previous.scope!==scope||previous.swipe!==swipe))return;
        if(generation?.stopped||this.aborted()||(signal?.aborted&&signal!==generation?.previousSignal))return;
        let embedded=this.read(message.mes);
        if(!embedded?.found&&previous?.scope===scope&&previous.swipe===swipe&&previous.embedded?.found&&previous.embedded.source===message.mes.trimEnd())embedded=previous.embedded;
        const candidate={message,source:message.mes,swipe,scope,generation,embedded,finalized};
        this.observed.set(message,candidate);
        const pending=this.pending.findIndex(p=>p.message===message&&p.scope===scope&&p.swipe===swipe&&p.generation===generation);
        if(pending<0)this.pending.push(candidate);else this.pending[pending]=candidate;
        if(finalized&&generation)generation.ended=true;
        // In ST, MESSAGE_RECEIVED is followed by CHARACTER_MESSAGE_RENDERED.
        // Waiting for the latter also lets async post-processors finish first.
        if(!this.waitForRender||finalized)this.schedule();
    }
    reset() { this.active = null; this.pending = []; this.seen = []; this.observed=new WeakMap(); }
    schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => void this.drain(), 0); }
    async drain() {
        if (this.running || (this.active && !this.active.ended && !this.active.stopped)) return;
        this.running = true;
        try {
            while (this.pending.length && (!this.active || this.active.ended || this.active.stopped)) {
                const p = this.pending.shift();
                if (p.scope !== this.scope() || p.generation?.stopped || (p.message.swipe_id ?? 0) !== p.swipe) continue;
                if(this.waitForRender&&!p.finalized){this.pending.unshift(p);break;}
                if(p.message.mes!==p.source){
                    // Another extension may strip the same hidden comment after
                    // MESSAGE_RECEIVED. Retain the plan only for that exact body.
                    if(!p.embedded?.found||p.embedded.source!==p.message.mes.trimEnd())continue;
                    p.source=p.message.mes;
                }
                if (this.seen.some(s => s.scope === p.scope && s.message === p.message && s.source === p.source && s.swipe === p.swipe)) continue;
                this.seen.push(p); if (this.seen.length > 100) this.seen.shift();
                try { await this.run(p); } catch (e) { this.error(e); }
            }
        } finally { this.running = false; }
    }
}

export function migrateWorkflow(saved, defaults) {
    const next = { ...structuredClone(defaults), ...saved };
    // An old off/every-two combination can be an intentional user choice.
    // Fill missing fields only; never interpret saved choices as unused defaults.
    next.workflowVersion = 2;
    return next;
}
export const workflowEnabled=config=>config.promptInjection===true&&config.automatic!=='off';
