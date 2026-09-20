export class WorkQueue {
    constructor(onChange = () => {}) { this.items = []; this.running = false; this.onChange = onChange; this.paused = false; }
    add(key, run, label = '', metadata = {}) {
        if (this.items.some(x => x.key === key && ['waiting', 'running'].includes(x.state))) return false;
        if (this.items.filter(x => x.state === 'waiting').length >= 20) throw new Error('대기열이 가득 찼습니다 (최대 20개).');
        this.items.push({ ...metadata, key, run, label, state: 'waiting' });
        this.onChange(); void this.drain(); return true;
    }
    cancelWaiting(predicate = () => true) { this.items.filter(x => x.state === 'waiting'&&predicate(x)).forEach(x => x.state = 'cancelled'); this.onChange(); }
    toggle() { this.paused = !this.paused; this.onChange(); if (!this.paused) void this.drain(); }
    async drain() {
        if (this.running) return;
        this.running = true;
        try {
            let item;
            while (!this.paused && (item = this.items.find(x => x.state === 'waiting'))) {
                item.state = 'running'; this.onChange();
                try { await item.run(); item.state = 'done'; }
                catch (e) { item.state = 'failed'; item.error = e.message; }
                this.onChange();
            }
        } finally {
            this.running = false;
            if (this.items.length > 100) this.items = this.items.slice(-100);
            this.onChange();
        }
    }
}
