# API 근거와 검증 범위

확인일: 2026-09-20~21.

- NovelAI 모델 안내: https://docs.novelai.net/en/image/models/
- 공식 웹 클라이언트: https://novelai.net/ 의 당시 `_next/static/chunks/pages/_app-82fe03e3291d150d.js`.
- SillyTavern 공개 release 소스: https://github.com/SillyTavern/SillyTavern/tree/release
- 참조한 ST 파일: `public/scripts/st-context.js`, `public/scripts/extensions/shared.js`, `public/script.js`, `public/scripts/utils.js`, `src/endpoints/novelai.js`.
- 허락받은 오토픽 서버 플러그인: `ref/autopic/plugin/index.mjs`의 V4.5 Vibe/Director Reference 필드.

현재 공식 클라이언트에서 확인한 계약:

| 항목 | V5 | V4.5 |
|---|---|---|
| 모델 ID | `nai-diffusion-5-full`, `nai-diffusion-5-curated` | `nai-diffusion-4-5-full`, `nai-diffusion-4-5-curated` |
| 인물 수 | 32 | 6 |
| 프롬프트 토큰 예산 | Full 1471 / Curated 703 | 512 |
| 프롬프트 컨테이너 | `v4_prompt`, `v4_negative_prompt` | 동일 |
| 설정 버전 | `params_version: 4` | 공식 웹의 현재 기본값도 4 |
| 인물 배치 | 자유 좌표 | 5단계 격자 |
| 스케줄러 | Karras 강제 | 선택 가능 |
| Vibe / Precise Reference | 현재 미지원 | 지원 |
| 투명 배경 | `straight_alpha` | 미지원 |

V5의 모델명만 바꾸고 구형 본문으로 전송하는 방식은 사용하지 않는다. generation은 `https://image.novelai.net/ai/generate-image`, 계정 조회는 같은 호스트의 `/user/subscription`을 사용한다. `api.novelai.net/docs-json`의 이미지 enum은 구형이므로 최신 모델 목록의 단독 근거로 삼지 않았다.

토큰 예산은 모델 문서화에 사용한다. 현재 확장에 Qwen/T5 토크나이저를 번들하지 않았으므로 부정확한 문자 수를 정확한 토큰 수처럼 표시하지 않는다. 큰 프롬프트의 실제 모델 처리와 이미지 품질은 실계정 검증 대상이다.

계정 키는 ST의 `readSecret(request.user.directories, SECRET_KEYS.NOVEL)`로 읽는다. 프런트엔드는 ST의 인증/CSRF 헤더로 자체 플러그인을 호출한다. 직접 NovelAI 키 입력칸이나 전역 fetch 교체는 없다.

검증 구분:

1. 순수 프로토콜/대기열/저장소: Node 자동 테스트.
2. 브라우저 상호작용: 로컬 가상 ST와 테스트 응답으로 검증.
3. 실제 ST 설치 + 실제 NovelAI/LLM 계정의 이미지 품질·요금·사용 권한: 아직 미검증. 설치 가이드의 실환경 확인 절차가 필요하다.

공식 웹 번들은 변경될 수 있는 관찰 근거이며 장기 호환 보장이 아니다. 추출한 코드 자체를 배포하지 않는다.


## PNG 생성 정보 가져오기 (0.3.0)

- [NovelAI 공식 메타데이터 도구](https://github.com/NovelAI/novelai-image-metadata)와 [nai_meta.py](https://github.com/NovelAI/novelai-image-metadata/blob/main/nai_meta.py): 알파 채널 최하위 비트, 열 우선 순회, `stealth_pngcomp` 헤더, 32비트 길이, gzip JSON 형식을 대조했다. 코드를 복사하지 않고 파일 형식에 맞는 JS 판독기를 작성했다. 메타데이터 서명/출처 진위 검증은 구현하지 않았으며 표시 정보가 인증됐다고 주장하지 않는다.
- 일반 PNG tEXt/zTXt/iTXt의 Comment JSON과 v4_prompt/v4_negative_prompt 캡션은 공식 클라이언트 저장 형태와 대조했다. V5 역시 필드 이름은 v4_prompt다.
- 공식 클라이언트의 Source 모델 식별값 중 확인한 값만 자동 매칭한다. 새로운 해시·지원하지 않는 구형 모델은 사용자가 선택한다. 원본 파일은 브라우저에서만 읽고 생성 정보 확인 단계에서 서버에 업로드하지 않는다.
- 합성 PNG로 일반/압축 텍스트·알파 저장, CRC 오류, 파일 잘림, 길이 초과, 모델 불명, 비용 보호, 인물 좌표·순서 옵션을 검증했다. 사용자의 실제 NovelAI 원본 파일은 이번 대화에서 제공되지 않았다.

## 답변 자동 처리 (0.4.0)

- 로컬 SillyTavern 1.19.0 staging의 `public/script.js`를 확인했다. 스트리밍 `finalizeIntermediaryMessage`는 `markUIGenStopped`를 통해 `GENERATION_ENDED`를 발생시킨 다음 `MESSAGE_RECEIVED`를 보낸다. 일반 응답은 수신이 먼저 올 수 있다. 두 이벤트를 모두 기록한 뒤 완료된 메시지를 한 번만 처리한다.
- `GENERATION_STARTED`에서 `setExtensionPrompt(key, value, IN_CHAT, 0, false, SYSTEM)`로 선택적 지시문을 넣는다. 종료·중지·채팅 변경 시 제거하고 Quiet·impersonate·dry-run에는 넣지 않는다. AutoPic의 흐름을 확인하되 전역 fetch나 다른 확장의 프롬프트를 수정하지 않는다.
- 명시적인 분석 프로필은 `ConnectionManagerRequestService.sendRequest`를 사용한다. 선택하지 않으면 `getContext().generateRaw({prompt, responseLength, trimNames:false})`로 현재 채팅 연결을 사용한다. 이 호출에 대상 이전의 제한된 문맥과 대상 본문만 전달하며 이후 답변은 넣지 않는다.
- 독립된 `<!--scenebook ... -->` JSON 블록을 해석하고 원문 인용이 한 문단에만 일치하는지 검사한다. 선택된 스와이프만 정리하며 다른 스와이프를 변경하지 않는다. 정보가 없거나 잘못되면 답변 분석으로 이어진다. 명시적인 빈 장면 배열은 추가 분석·이미지 요청을 만들지 않는다.
- 이번 수정은 유료 API 요청 없이 Node 회귀 테스트와 가상 이벤트/이미지 응답으로 검증한다. 실제 계정의 생성 권한·이미지 품질을 검증했다는 의미는 아니다.
