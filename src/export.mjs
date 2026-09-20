import { safeImagePath,sourceKey } from '../plugin/core.mjs';
import { narrativeBlocks } from './context.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function exportMessages(chat){
    return chat.filter(m=>!m.is_system).map(m=>{
        const state=m.extra?.autopic2?.views?.[sourceKey(m.mes,m.swipe_id??0)];
        const images=state?.source===m.mes?(state.slots??[]).filter(s=>!s.hidden).map(s=>({job:s.versions?.[s.selected],anchor:s.anchor})).filter(s=>safeImagePath(s.job?.url)):[];
        return{name:m.name??(m.is_user?'사용자':'캐릭터'),source:String(m.mes??''),images};
    });
}
export function exportHtml(messages,assets,title='삽화 채팅'){
    const figure=({job})=>{
        const image=assets.get(job.url);if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image??''))throw new Error('내보낼 PNG를 확인할 수 없습니다.');
        return `<figure><img src="${image}" alt="${escape(job.scene?.title)}"><figcaption>${escape(job.scene?.title)}</figcaption></figure>`;
    };
    const content=messages.map(m=>{
        const blocks=narrativeBlocks(m.source),insertions=new Map(),tail=[];
        for(const item of m.images){const block=blocks.find(b=>b.content===item.anchor?.quote);if(block){const items=insertions.get(block.end)??[];items.push(item);insertions.set(block.end,items);}else tail.push(item);}
        let cursor=0,body='';for(const [end,items]of [...insertions].sort((a,b)=>a[0]-b[0])){body+=`<div class="text">${escape(m.source.slice(cursor,end))}</div>`+items.map(figure).join('');cursor=end;}
        body+=`<div class="text">${escape(m.source.slice(cursor))}</div>`+tail.map(figure).join('');
        return `<article><h2>${escape(m.name)}</h2>${body}</article>`;
    }).join('\n');
    return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escape(title)}</title><style>body{background:#171c24;color:#ebeae6;font:16px/1.8 system-ui,sans-serif;margin:0}main{max-width:850px;padding:24px;margin:auto}article{padding:24px 0;border-bottom:1px solid #48505a}h1{font-size:26px}h2{font-size:16px;color:#b7d5bd}.text{white-space:pre-wrap;overflow-wrap:anywhere}figure{max-width:640px;margin:24px auto}img{display:block;width:100%;height:auto;border-radius:12px}figcaption{font-size:13px;opacity:.7;text-align:center;margin-top:8px}</style><main><h1>${escape(title)}</h1>${content}</main></html>`;
}
export async function downloadChat(chat,title){
    const messages=exportMessages(structuredClone(chat)),assets=new Map();
    const urls=[...new Set(messages.flatMap(m=>m.images.map(i=>i.job.url)))];
    if(urls.length>200)throw new Error('한 번에 최대 200개의 삽화를 내보낼 수 있습니다.');
    let total=0;
    for(const url of urls){
        const response=await fetch(url);if(!response.ok)throw new Error('일부 원본 이미지를 읽지 못했습니다. 내보내기를 중단했습니다.');
        const blob=await response.blob();total+=blob.size;if(total>50*1024*1024)throw new Error('삽화 합계가 50MB를 넘습니다. 내보내기를 중단했습니다.');
        const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(new Blob([blob],{type:'image/png'}));});assets.set(url,image);
    }
    const url=URL.createObjectURL(new Blob([exportHtml(messages,assets,title)],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='autopic2-chat.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
