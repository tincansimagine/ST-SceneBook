import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile,realpath,mkdir,copyFile,rename,access } from 'node:fs/promises';
const files=['package.json','index.mjs','service.mjs','core.mjs','references.mjs','vertex.mjs'];
const exists=async p=>access(p).then(()=>true,()=>false);
export async function findHost(start){
    let candidate=path.resolve(start);
    for(;;){
        try{const pkg=JSON.parse(await readFile(path.join(candidate,'package.json'),'utf8'));if(pkg.name?.toLowerCase()==='sillytavern'&&await exists(path.join(candidate,'src','endpoints','secrets.js')))return candidate;}catch{}
        const parent=path.dirname(candidate);if(parent===candidate)throw new Error('SillyTavern 폴더를 지정하세요: node install-server.mjs /경로/SillyTavern');candidate=parent;
    }
}
export async function installServer(source,host){
    const resolved=await realpath(host);if(await findHost(resolved)!==resolved)throw new Error('지정한 경로가 SillyTavern 루트가 아닙니다.');
    // Check the complete bundle before changing any installed file.
    const bytes=await Promise.all(files.map(name=>readFile(path.join(source,name))));
    const version=JSON.parse(bytes[0]).version;
    const plugins=path.join(resolved,'plugins'),target=path.join(plugins,'autopic2');await mkdir(plugins,{recursive:true});
    const checkedPlugins=await realpath(plugins);if(checkedPlugins!==plugins)throw new Error('plugins 심볼릭 링크 대신 실제 SillyTavern 폴더를 사용하세요.');
    if(await exists(target)&&await realpath(target)!==target)throw new Error('autopic2가 심볼릭 링크입니다. 실제 설치 폴더를 확인하세요.');
    const backup=path.join(resolved,'backups',`scenebook-server-${Date.now()}`);let backedUp=false;
    for(const name of files)if(await exists(path.join(target,name))){await mkdir(backup,{recursive:true});await copyFile(path.join(target,name),path.join(backup,name));backedUp=true;}
    await mkdir(target,{recursive:true});
    for(const name of files){const tmp=path.join(target,`${name}.installing`);await copyFile(path.join(source,name),tmp);await rename(tmp,path.join(target,name));}
    return {version,target,backup:backedUp?backup:null};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    try{
        const here=path.dirname(fileURLToPath(import.meta.url)),host=process.argv[2]?path.resolve(process.argv[2]):await findHost(here);
        const result=await installServer(path.join(here,'server-plugin','autopic2'),host);
        console.log(`씬북 서버 ${result.version} 설치 완료: ${result.target}`);
        if(result.backup)console.log(`이전 파일 보관: ${result.backup}`);
        console.log('SillyTavern 서버를 완전히 종료·재시작한 뒤 씬북 설정의 확인을 누르세요.');
        console.log('처음 설치라면 config.yaml의 enableServerPlugins가 true인지 확인하세요. 사용자 설정과 API 키는 변경하지 않았습니다.');
    }catch(e){console.error(e.message);process.exitCode=1;}
}
