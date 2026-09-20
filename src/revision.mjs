export function mergeRevision(previous,proposed,scope='all'){
    if(previous.after!==proposed.after)throw new Error('수정 중 삽입 위치가 바뀌었습니다.');
    if(!['all','camera','background','characters'].includes(scope))throw new Error('수정 범위를 확인하세요.');
    if(previous.finalPrompt&&['camera','background'].includes(scope))throw new Error('최종 프롬프트를 직접 수정한 장면은 전체 재분석을 선택하거나 직접 고쳐 주세요.');
    const result=structuredClone(previous);
    if(scope==='all')return{...proposed,after:previous.after,evidence:previous.evidence};
    if(scope==='camera')result.camera=proposed.camera;
    if(scope==='background')result.prompt=proposed.prompt;
    if(scope==='characters'){
        if(previous.characters.length!==proposed.characters.length||previous.characters.some((ch,i)=>ch.name!==proposed.characters[i].name))throw new Error('인물 수정에서 등장 인물 구성이 바뀌었습니다.');
        result.characters=previous.characters.map((ch,i)=>({...ch,prompt:proposed.characters[i].prompt,negative:proposed.characters[i].negative}));
    }
    return result;
}
