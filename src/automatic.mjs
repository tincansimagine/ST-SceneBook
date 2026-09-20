// MESSAGE_RECEIVED and GENERATION_ENDED arrive in opposite orders for streaming
// and non-streaming replies. Keep both signals; never await our work in ST events.
export class AutomaticResponses {
    constructor({ scope, message, aborted = () => false, run, error = () => {} }) {
        Object.assign(this, { scope, message, aborted, run, error });
        this.pending = []; this.seen = []; this.active = null; this.running = false;
    }
    start(type, dryRun = false) {
        if (dryRun || type === 'quiet') return;
        this.active = { scope: this.scope(), ended: false, stopped: type === 'impersonate' };
    }
    stop() {
        if (this.active) this.active.stopped = true;
        this.pending = this.pending.filter(p => p.generation !== this.active);
    }
    end() {
        if (this.active) this.active.ended = true;
        this.schedule();
    }
    receive(index, type) {
        if (['quiet', 'impersonate', 'first_message'].includes(type)) return;
        const message = this.message(Number(index));
        if (!message || message.is_user || message.is_system || !String(message.mes ?? '').trim()) return;
        const generation = this.active;
        if (generation?.stopped || this.aborted()) return;
        this.pending.push({ message, source: message.mes, swipe: message.swipe_id ?? 0, scope: this.scope(), generation });
        this.schedule();
    }
    reset() { this.active = null; this.pending = []; this.seen = []; }
    schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => void this.drain(), 0); }
    async drain() {
        if (this.running || (this.active && !this.active.ended && !this.active.stopped)) return;
        this.running = true;
        try {
            while (this.pending.length && (!this.active || this.active.ended || this.active.stopped)) {
                const p = this.pending.shift();
                if (p.scope !== this.scope() || p.generation?.stopped || p.message.mes !== p.source || (p.message.swipe_id ?? 0) !== p.swipe) continue;
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
