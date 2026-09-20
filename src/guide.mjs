import { el, button, modal, field } from './ui.mjs';

export const HELP={
    model:'이미지를 그릴 NovelAI 모델입니다. V5는 자유 좌표, V4.5는 5 × 5 인물 배치와 이미지 참조를 지원합니다.',
    width:'출력 이미지의 픽셀 너비입니다. 64의 배수를 사용합니다. 채팅에 보이는 크기는 최대 너비에서 따로 정합니다.',
    height:'출력 이미지의 픽셀 높이입니다. 64의 배수를 사용합니다.',
    steps:'노이즈를 다듬는 반복 횟수입니다. 높을수록 생성 시간과 비용이 늘 수 있으며, 항상 더 좋은 결과가 되지는 않습니다.',
    scale:'Guidance: 프롬프트를 따르는 강도입니다. 너무 높으면 색과 윤곽이 과해질 수 있습니다.',
    seed:'같은 조건의 무작위 시작값입니다. -1은 매번 새 값입니다. 시드만 같다고 다른 모델·설정에서 같은 그림이 나오지는 않습니다.',
    sampler:'이미지를 다듬는 계산 방법입니다. 변경하면 같은 시드라도 결과가 달라집니다.',
    scheduler:'노이즈를 줄여 가는 방식입니다. 씬북의 V5 생성은 Karras를 사용합니다.',
    cfgRescale:'Guidance로 과해진 밝기·대비를 완화하는 보정입니다. 0이면 적용하지 않습니다.',
    quality:'그림체·장면 뒤에 모델별 품질 태그를 추가합니다. 이미지 메타데이터에서 장면을 가져올 때는 중복을 막기 위해 끕니다.',
    useCoords:'인물의 화면 위치를 요청에 반영합니다. 좌표는 구도 지시이며 결과의 정확한 위치를 보장하지는 않습니다.',
    useOrder:'인물 프롬프트의 순서 정보를 모델에 전달합니다. 인물 목록의 위·아래 버튼으로 순서를 바꿀 수 있습니다.',
    profileId:'채팅에서 장면을 뽑는 LLM 연결입니다. NovelAI 이미지 API 키와는 별도이며 직접 작성에는 필요하지 않습니다.',
    analysisMode:'빠르게는 장면을 바로 추출합니다. 정밀하게는 인물 복장·외형의 변화 시점을 먼저 확인하므로 LLM 호출이 추가됩니다.',
    maxScenes:'한 답변에서 분석하거나 생성할 장면 수의 상한입니다. 적절한 장면이 없으면 0개일 수 있습니다.',
    contextMessages:'선택한 답변 이전에 읽을 메시지 수입니다. 늘리면 분석 입력량도 늘어납니다. 이후 메시지는 읽지 않습니다.',
    style:'모든 이미지의 공통 그림체 프롬프트입니다. 생성 전 장면 편집에서도 이번 작업의 값을 수정할 수 있습니다.',
    negative:'그리지 않았으면 하는 요소입니다. 공통 제외 요소와 장면·인물별 제외 요소를 따로 적용합니다.',
    analysisPrompt:'장면 선택과 프롬프트 작성을 LLM에 지시하는 템플릿입니다. {{data}}는 채팅 데이터 자리이며 JSON 응답 형식을 유지해야 합니다.',
    automatic:'사용 안 함은 수동 시작, 분석 후 검토는 초안까지만, 분석 후 생성은 새 답변에서 이미지 요청까지 진행합니다.',
    every:'자동 처리할 답변 간격입니다. 2라면 대상 답변 두 번마다 처리합니다.',
    sessionLimit:'이번 접속에서 허용할 이미지 요청 수입니다. 분석 호출 수나 계정 잔액을 뜻하지 않습니다.',
    budgetGuard:'1,048,576픽셀·28 Steps를 넘는 요청을 차단합니다. 구독 상태나 잔액을 판단하는 무료 생성 보장은 아닙니다.',
    transparent:'V5에서 알파 채널을 가진 이미지를 요청합니다.',
    placement:'문단 뒤는 선택한 본문 뒤에, 답변 아래는 답변 끝에 표시합니다. 프롬프트의 구도와는 별도입니다.',
    displayWidth:'채팅에서 표시할 이미지의 최대 너비입니다. 원본 파일의 해상도는 바꾸지 않습니다.',
    compact:'채팅 삽화의 표시를 줄입니다. 원본은 그대로 보관됩니다.',
    playerMode:'POV는 플레이어를 화면 밖으로 두도록 분석에 지시합니다. 등장 가능은 본문에서 보이는 경우에 등장시킵니다.',
};
const steps=[
    ['연결 준비','확장 설정 → 씬북에서 연결 상태를 확인하세요. 이미지 생성은 서버 플러그인과 SillyTavern에 저장한 NovelAI 키를 사용합니다. 장면 분석을 쓸 때는 생성 탭의 연결 프로필도 선택하고 저장하세요.'],
    ['인물 등록','인물 탭에서 이름·고정 외형·기본 복장을 입력하세요. 현재 채팅만 또는 계정 기본값으로 저장할 수 있습니다. 외형 프로필은 변신·의상 등 다른 모습과 그 조건을 기록하는 곳입니다.'],
    ['장면 준비','원하는 답변의 삽화 버튼은 장면을 분석합니다. 직접 작성은 빈 편집기를 엽니다. 이미지 읽기는 NovelAI PNG에 저장된 프롬프트와 설정을 가져옵니다. 이 단계에서는 그림을 생성하지 않습니다.'],
    ['프롬프트와 배치','장면 편집에서 장면 프롬프트·제외 요소를 수정하고, 인물·배치에서 이름을 선택해 개별 프롬프트를 다듬으세요. 번호 점을 드래그하거나 좌표를 입력합니다. 위·아래 버튼은 인물 순서를 바꾸며, 삭제는 확인 뒤 되돌릴 수 있습니다.'],
    ['생성과 다시 편집','최종 프롬프트에서 실제 보낼 내용을 확인한 뒤 생성을 누르세요. 결과의 수정은 새 버전으로 남습니다. 같은 시드는 조건 비교, 새 시드는 새 구도 탐색에 씁니다. 결과 비교와 갤러리에서 이전 그림을 확인할 수 있습니다.'],
];
const extra=[
    ['이미지 읽기','NovelAI 원본 PNG의 일반 텍스트와 알파 채널 메타데이터를 브라우저에서 읽습니다. 설정 적용은 생성 옵션만 저장하고, 장면 편집은 프롬프트·인물·좌표까지 가져옵니다. 스크린샷·변환본·메타데이터 삭제본은 복원할 수 없습니다. 모르는 모델은 직접 선택해야 합니다. 이미지 원본이나 참조용 인코딩, Img2Img 설정은 복원하지 않습니다.'],
    ['프롬프트 공유','생성 탭 → 프롬프트의 편집에서 공통 그림체·제외 요소와 장면 분석 지시문을 수정하고 JSON으로 주고받습니다. 채팅 내용·API 키는 공유 파일에 넣지 않습니다. 장면 편집의 내보내기는 현재 장면들의 프롬프트·인물·생성 옵션을 저장합니다.'],
    ['인물 · 배치','번호는 인물 프롬프트 순서입니다. 이름을 바꾸면 목록과 배치판의 설명에 즉시 반영됩니다. V5는 자유 좌표, V4.5는 격자 중심점에 맞춥니다. 방향키로도 이동할 수 있고, Shift를 누르면 V5 이동 간격이 커집니다. 균등 배치·좌우 뒤집기·중앙은 위치를 빠르게 정리합니다.'],
    ['참조: Vibe / Precise','이미지 읽기가 생성 정보를 복원하는 기능이라면, 참조는 이미지 자체의 분위기나 인물 특징을 새 그림에 반영합니다. V4.5에서 Vibe는 분위기·그림체, Precise는 인물·스타일 용도로 사용합니다. 강도·충실도·정보량을 조절할 수 있습니다. 현재 V5에서는 적용할 수 없습니다.'],
    ['수정 · 삭제 · 초안','재분석은 수정 지시를 LLM에 전달합니다. 구도·배경·인물로 범위를 좁힐 수 있습니다. 초안 저장으로 나중에 이어 편집하세요. 인물·장면 삭제 확인창에서 취소할 수 있으며 편집기의 되돌리기는 목록 변경 이전 상태를 복원합니다. 삭제한 인물 라이브러리도 저장 전 되돌릴 수 있습니다.'],
    ['작업 · 갤러리','정지 / 재개는 다음 이미지 요청부터 적용됩니다. 이미 전송된 요청은 취소·환불되지 않습니다. 오류·중단된 유료 요청을 자동 재전송하지 않습니다. 완성된 이미지는 갤러리에 남고, 대상 답변이 바뀌었을 때도 삽입으로 복구할 수 있습니다.'],
    ['AI 검수 · 내보내기','AI 검수는 이미지를 볼 수 있는 연결 프로필로 결과를 평가합니다. 검수 의견이 원본을 자동 수정하지는 않습니다. 채팅 내보내기는 표시 중인 삽화와 대화를 하나의 HTML로 저장합니다. 프리셋·백업은 생성 설정을 저장하며 가져온 뒤 자동 생성은 꺼집니다.'],
];
export function showGuide(){
    const {body}=modal('사용법'),step=el('section','ap2-guide-step'),navigation=el('div','ap2-actions');let index=0;
    const back=button('이전',()=>{index--;render();}),next=button('다음',()=>{index++;render();});
    const count=el('span','ap2-muted');navigation.append(back,count,next);
    const render=()=>{step.replaceChildren(el('h3','',steps[index][0]),el('p','',steps[index][1]));count.textContent=`${index+1} / ${steps.length}`;back.disabled=index===0;next.disabled=index===steps.length-1;};
    render();body.append(step,navigation);
    const search=field('기능 찾기','',{type:'search',placeholder:'예: 시드, 배치, 프롬프트'}),list=el('div','ap2-guide-topics');body.append(search.wrap,list);
    const labels={model:'모델',width:'가로',height:'세로',steps:'Steps',scale:'Guidance',seed:'시드 Seed',sampler:'샘플러',scheduler:'스케줄러',cfgRescale:'CFG rescale',quality:'품질 태그',useCoords:'좌표 적용',useOrder:'인물 순서',profileId:'연결 프로필',analysisMode:'분석 방식',maxScenes:'최대 장면',contextMessages:'이전 메시지',style:'그림체',negative:'제외 요소',analysisPrompt:'장면 분석 프롬프트',automatic:'자동 처리',every:'답변 간격',sessionLimit:'접속당 요청 한도',budgetGuard:'비용 보호',transparent:'투명 배경',placement:'삽입 위치',displayWidth:'최대 너비',compact:'작게 표시',playerMode:'플레이어'};
    const topics=[...extra,...Object.entries(HELP).map(([k,v])=>[labels[k],v])];
    const filter=()=>{list.replaceChildren();const query=search.read().trim().toLowerCase();for(const [title,description]of topics){if(query&&!`${title} ${description}`.toLowerCase().includes(query))continue;const d=el('details','ap2-guide-topic');d.open=!!query;d.append(el('summary','',title),el('p','',description));list.append(d);}if(!list.children.length)list.append(el('p','ap2-muted','일치하는 설명이 없습니다.'));};search.input.addEventListener('input',filter);filter();
}
