# AI 번역 확장 프로그램

Chrome/Edge Manifest V3 기반 AI 페이지/선택 영역 번역 확장 프로그램입니다.
현 언어 한국어만 지원중이며, 나중에 다른언어 추가 예정입니다.

## 기능

- 페이지 텍스트를 번역문으로 교체하고 원문으로 복원할 수 있습니다.
- 텍스트를 선택한 뒤 우클릭 메뉴에서 "선택한 텍스트 AI로 번역"을 실행할 수 있습니다.
- 페이지, 선택 영역, 이미지, 사전 기능별 프롬프트 프로필을 설정할 수 있습니다.
- 여러 프로바이더를 등록하고 프로필별로 프로바이더와 모델을 선택할 수 있습니다.
- system, user, assistant 역할의 메시지를 순서대로 구성해 프리필 방식 프롬프트를 만들 수 있습니다.
- 토큰 제한, 온도, top-p, 추론 강도를 설정할 수 있습니다.
- OpenAI, Claude, Gemini, Ollama 로컬, Ollama 클라우드 API, Custom OpenAI 호환 API를 지원합니다.
- 선택 번역 결과에서 단어를 지정해 AI 사전 설명을 생성하고 저장할 수 있습니다.

이미지 번역은 현재 설정/프로필 구조만 준비되어 있으며, 실제 OCR/이미지 워크플로우는 다음 단계입니다.

## 개발

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
```

## Chrome 또는 Edge에 로드하기

1. `npm.cmd run build`를 실행합니다.
2. Chrome에서는 `chrome://extensions`, Edge에서는 `edge://extensions`를 엽니다.
3. 개발자 모드를 켭니다.
4. "Load unpacked" 또는 "압축해제된 확장 프로그램 로드"를 선택합니다.
5. `E:\AI Trans\dist` 폴더를 선택합니다.

확장 프로그램 옵션 페이지에서 프로바이더, API 키, 기본 URL, 모델, 프롬프트를 설정합니다.

조만간 릴리즈 하면 zip파일로 바로 적용 가능한 파일 형태로 만들겠습니다.
