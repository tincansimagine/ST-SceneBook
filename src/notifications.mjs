let host;
export function placeNotices(){
    if(!host)return;
    // Modal dialogs make outside elements inert. Keep alerts inside the active
    // dialog, then move them out on close instead of deleting them with it.
    const parent=Array.from(document.querySelectorAll('dialog[open]')).at(-1)??document.body;
    if(host.hidePopover&&host.matches(':popover-open'))host.hidePopover();
    if(host.parentElement!==parent)parent.append(host);
    if(host.childElementCount&&host.showPopover)host.showPopover();
}
function fallback(message,kind,persistent){
    if(!host){host=document.createElement('aside');host.id='ap2-notices';host.setAttribute('aria-label','씬북 알림');host.setAttribute('popover','manual');document.addEventListener('close',placeNotices,true);}
    const box=document.createElement('div');box.className=`ap2-toast ap2-toast-${kind}`;box.setAttribute('role',kind==='error'?'alert':'status');
    const title=document.createElement('strong');title.textContent='씬북';const content=document.createElement('span');content.textContent=message;
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','알림 닫기');
    const close=()=>{box.remove();if(!host.childElementCount&&host.hidePopover&&host.matches(':popover-open'))host.hidePopover();};dismiss.onclick=close;
    box.append(title,content,dismiss);host.append(box);
    placeNotices();
    if(!persistent)setTimeout(close,kind==='error'?15000:5000);
    return {close,update:value=>{content.textContent=value;}};
}
export function notify(message,{kind='info',persistent=false}={}){
    const toast=globalThis.toastr;
    // Browser dialogs occupy the top layer. Keep their alerts in a top-layer
    // popover too, so closing the editor cannot swallow a generation failure.
    if(toast?.[kind]&&!document.querySelector('dialog[open]')){
        const node=toast[kind](String(message),'씬북',{escapeHtml:true,closeButton:true,progressBar:!persistent,timeOut:persistent?0:kind==='error'?15000:5000,extendedTimeOut:persistent?0:1500,preventDuplicates:false});
        if(node)return {close:()=>node.remove(),update:value=>node.find('.toast-message').text(value)};
    }
    return fallback(String(message),kind,persistent);
}
export function notice(message,error=false){return notify(message,{kind:error?'error':'info'});}
export function progressNotice(message){return notify(message,{persistent:true});}
