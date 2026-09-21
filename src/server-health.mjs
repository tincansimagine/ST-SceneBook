export const CLIENT_VERSION='0.4.16';
export function validateHealth(value){
    const version=typeof value?.version==='string'?value.version:'알 수 없음';
    const match=version.match(/^(\d+)\.(\d+)\.(\d+)(?:$|[-+])/);
    const current=match&&(+match[1]>0||+match[2]>4||+match[2]===4&&+match[3]>=1);
    if(!current){const error=new Error(`서버 플러그인 ${version} 실행 중 · 씬북 ${CLIENT_VERSION}의 server-plugin/autopic2를 SillyTavern/plugins/autopic2에 덮어쓰고 서버를 완전히 종료·재시작한 뒤 ‘확인’을 누르세요.`);error.code='SERVER_UPDATE';throw error;}
    if(typeof value.hasKey!=='boolean')throw new Error('씬북 서버의 연결 확인 응답이 올바르지 않습니다.');
    return value;
}
export function createHealthCheck(request,{ttl=5000,now=Date.now}={}){
    let cached=null,expires=0,pending=null;
    return async function check(force=false){
        if(!force&&cached&&now()<expires)return cached;
        if(pending)return pending;
        pending=Promise.resolve().then(request).then(validateHealth).then(value=>{cached=value;expires=now()+ttl;return value;}).finally(()=>{pending=null;});
        return pending;
    };
}
