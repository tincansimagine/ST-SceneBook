// crypto.randomUUID exists only on HTTPS and localhost. SillyTavern is often
// opened from a phone over plain http://192.168.x.x, where it is missing.
if(typeof crypto.randomUUID!=='function'){
    crypto.randomUUID=()=>{
        const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;
        const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
        return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    };
}
