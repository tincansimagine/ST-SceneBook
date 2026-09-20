# API 근거와 검증 범위

## 0.4.5 변경 범위

- 사용자가 제공한 지시에 JSON 마지막 `]}` 누락과 주석 앞 역슬래시가 있었다. 엄격한 JSON 파싱 후 [jsonrepair](https://github.com/josdejong/jsonrepair)의 로컬 정적 ESM 복구로 넘어가며 유효한 JSON 문자열을 보호한다. 라이브러리 3.15.0의 ISC 라이선스·출처를 동봉하고 배포 아카이브를 npm의 SHA-512와 대조했다. 라이브러리의 기존 테스트를 이번 변경에 대한 자체 검증으로 주장하지 않는다.
- 단일 객체·숫자 문자열 등 알려진 스키마 타입 오류를 정리한 뒤 기존 장면·인물·좌표·원문 근거 검증을 유지한다. 자동 처리에서는 장면별로 검증하여 오류 장면이 다른 정상 장면까지 막지 않게 한다. 일반 코드 예제는 보호하고, 본문 뒤의 주석 전용 코드 블록만 해제한다.
- 과거 실패 원문은 저장된 메시지 본문을 유지한 채 다시 해석하여 편집기에 전달한다. 서버 API 변경·추가 LLM 호출·과거 유료 요청 자동 재전송은 없다.
- 사용자 요청에 따라 이번 변경의 실행 테스트·브라우저 QA·유료 요청은 수행하지 않았다.

## 0.4.4 변경 범위

- 이번 수정은 사용자 요청에 따라 실행 테스트·브라우저 QA·유료 API 요청 없이 작성했다. 아래의 과거 검증 기록을 0.4.4 검증 결과로 해석하지 않는다.
- 로컬 ST `public/script.js`의 스트리밍/일반 응답 경로와 `public/lib/eventemitter.js`를 읽어 수신→렌더, 종료→수신 순서와 `makeFirst`/`makeLast` API를 대조했다. 실제 모바일 조합의 동작 확인은 남아 있다.
- PNG seed는 정규화와 적용 양쪽에서 제외한다. 서버 API와 플러그인 파일은 변경하지 않으며 기존 0.4.2 이상 서버를 그대로 사용한다.

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
- 명시적인 분석 프로필은 기본적으로 `ConnectionManagerRequestService.sendRequest`를 사용한다. 0.4.2의 Vertex 인증 경로는 아래 항목을 참고한다. 선택하지 않으면 `getContext().generateRaw({prompt, responseLength, trimNames:false})`로 현재 채팅 연결을 사용한다. 이 호출에 대상 이전의 제한된 문맥과 대상 본문만 전달하며 이후 답변은 넣지 않는다.
- 독립된 `<!--scenebook ... -->` JSON 블록을 해석하고 원문 인용이 한 문단에만 일치하는지 검사한다. 선택된 스와이프만 정리하며 다른 스와이프를 변경하지 않는다. 정보가 없거나 잘못되면 답변 분석으로 이어진다. 명시적인 빈 장면 배열은 추가 분석·이미지 요청을 만들지 않는다.
- 이번 수정은 유료 API 요청 없이 Node 회귀 테스트와 가상 이벤트/이미지 응답으로 검증한다. 실제 계정의 생성 권한·이미지 품질을 검증했다는 의미는 아니다.

## 사용자 저장 경로 수정 (0.4.1)

- 로컬 ST `src/constants.js`의 `USER_DIRECTORY_TEMPLATE`, `src/users.js`의 `getUserDirectories` 및 `/user/images/*` 정적 경로를 직접 대조했다. 사용자 이미지 경로 속성은 `userImages`다. `images`는 사용자 경로 객체에 존재하지 않으며 `PUBLIC_DIRECTORIES.images`와 혼동해서는 안 된다.
- 생성·복구·갤러리·검수·참조 저장에서 `userImages`를 사용한다. 사용자 루트의 기존 작업 기록 경로와 공개 이미지 URL은 바뀌지 않는다.
- `tests/st-contract.test.mjs`는 설치된 ST의 실제 `USER_DIRECTORY_TEMPLATE`과 Express를 불러와 임시 사용자 두 명으로 HTTP 라우트를 검사한다. health → generate → jobs → PNG 조회 → review, 참조 업로드·목록·이미지 조회, 사용자 간 격리를 검증한다. 경로 객체를 잘못 만들었던 기존 테스트도 실제 속성 이름으로 수정했다.
- 이미지 공급자 응답과 키만 테스트 값으로 대체한다. 사용자 키·채팅·기존 이미지 파일은 읽거나 변경하지 않는다. `SILLYTAVERN_ROOT` 환경 변수로 다른 위치의 ST를 지정할 수 있다. 호스트가 없는 환경은 해당 계약 테스트를 건너뛰었다고 표시한다.

## Vertex 프로필·알림 수정 (0.4.2)

- 로컬 ST 1.19.0 staging의 `public/scripts/extensions/shared.js`, `custom-request.js`, `src/endpoints/google.js`, `secrets.js`, `prompt-converters.js`를 대조했다. 기존 씬북의 `includePreset:false`는 프리셋에 저장된 `vertexai_auth_mode`를 누락한다. ST의 Vertex 인증 기본값은 Express이며, 확인한 인증 코드의 `readSecret` 호출은 요청의 `secret_id`를 사용하지 않는다.
- Vertex 전용 서버 라우트는 선택된 키 ID를 현재 사용자의 Vertex API 키/서비스 계정 저장소에서만 조회한다. 서비스 계정의 프로젝트와 서명에는 같은 키를 사용한다. 키가 없을 때 다른 활성 키로 재시도하지 않는다. ST의 프롬프트 후처리·Google 메시지 변환·추론 예산 함수를 실행하되 원본 메시지는 복사한다.
- [Google 공식 Express REST 안내](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/express-mode/api-reference)에 따라 프로젝트 없는 Express 요청은 전역 `aiplatform.googleapis.com`을 사용한다. 프로젝트가 지정된 요청은 ST 설정의 리전·프로젝트를 유지한다. 목적지는 고정 Google HTTPS 호스트이며 API 키는 헤더, Full 토큰은 Authorization 헤더에만 담는다. 서비스 계정 토큰 교환은 `oauth2.googleapis.com/token`에 한정한다.
- 다른 공급자와 명시적 프록시는 ST의 기존 연결 경로를 유지한다. 현재 채팅의 활성 프로필·키를 변경하지 않는다. 새 라우트가 없는 서버는 업데이트·재시작을 안내한다.
- ST에 포함된 Toastr로 진행·완료·오류를 알린다. 브라우저 모달이 열려 있으면 전역 popover를 사용하여 알림이 가려지거나 닫힌 편집 창과 함께 없어지지 않게 한다. 메시지는 HTML로 삽입하지 않는다.
- 단위 테스트는 선택한 키·인증 방식·리전·프리셋·이미지 입력 보존, 사용자 격리, 누락 키·오류·잘린 출력과 무재시도를 검증한다. HTTP 계약 테스트는 실제 ST 메시지 변환 코드를 실행하고 임시 사용자 경로와 선택 키를 사용한다. 공급자 응답과 키는 테스트 값으로 대체하며 실계정 인증·유료 생성은 실행하지 않는다.

## 주입 중심 흐름·설정 보존 (0.4.3)

- 제공된 AutoPic의 `CHAT_COMPLETION_PROMPT_READY` 주입과 `MESSAGE_RECEIVED` 삽화 블록 추출을 재확인했다. 씬북은 자신의 확장 프롬프트 키로 기본 지시문을 주입하며, 답변의 구조화된 장면을 로컬에서 검증·합성해 생성한다. 추가 LLM 분석은 명시적인 수동 분석에 한정한다.
- 주입 스위치가 자동 처리의 활성화 조건이다. 끄면 지시문을 제거하고 대기 중인 자동 생성만 취소한다. 이미 전송된 이미지 요청은 결과를 보존한다. 저장된 꺼짐·간격·커스텀 프롬프트를 기본값으로 간주해 바꾸지 않는다.
- ST의 `loadExtensionSettings`는 저장값을 합친 후 확장을 활성화한다. 확인한 리셋 위험은 씬북의 수동 저장 폼과 off/every-two 값을 바꾸던 자체 이관이다. 이를 입력 시 저장 및 결측 필드만 추가하는 이관으로 교체한다. ST `saveSettingsDebounced`로 서버 저장을 요청한다. 저장소 연결이 끊어진 상태의 서버 저장까지 보장하지 않는다.
- 최대 10개의 설정 변경 전 스냅샷은 같은 ST 계정의 확장 설정에 보관한다. 사용자 API 키·채팅 원문은 이 스냅샷에 포함하지 않는다. 기존에 사라진 값 중 보관되지 않은 정보는 복원할 수 없다.
- 사용자 스크린샷의 'SillyTavern 사용자 디렉터리가 필요합니다.' 문자열은 보관된 0.4.0 이하 서버 `service.mjs`의 `directories.images` 검사와 일치한다. 0.4.1 이후에는 `userImages`를 사용한다. 클라이언트가 구형 health 응답을 준비 완료로 간주하지 않도록 버전을 검사하고 실제 서버 버전을 표시한다.
- `install-server.mjs`는 ST 루트를 확인하고 완전한 6개 파일 묶음을 먼저 검증한 뒤 교체한다. 기존 파일을 backups에 보관한다. 사용자 데이터·키·config.yaml·기존 오토픽 플러그인은 변경하지 않는다. 서버 재시작은 사용자가 수행한다.
