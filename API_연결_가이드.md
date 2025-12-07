# 🚀 하이브리드 배포 완성 가이드

## ✅ 완료된 것
- Vercel 배포 성공: `https://chosungking-jdcuulpss-mistworlds-projects.vercel.app`
- 게임 화면 정상 표시
- Worker 코드를 API 전용으로 수정 완료

## 🔄 다음 단계

### 1단계: Cloudflare Worker 배포
```bash
cd "C:\Users\김현희윈도우\Downloads\1130초성왕"
npx wrangler deploy --config wrangler-api-only.toml
```

배포 후 나오는 Worker URL을 확인:
- 예: `https://chosung-api-only.sucksuck1114.workers.dev`
- 이 URL을 복사해두세요!

### 2단계: Vercel의 index.html에서 API 주소 변경

GitHub 저장소 (`https://github.com/mistworld/chosungking`)에서:

1. `public/index.html` 파일 수정
2. 모든 `/api/` 호출을 Cloudflare Workers URL로 변경

**변경 예시:**
```javascript
// 변경 전
fetch('/api/rooms')

// 변경 후
fetch('https://chosung-api-only.sucksuck1114.workers.dev/api/rooms')
```

**변경할 API 엔드포인트 (약 19개):**
- `/api/rooms`
- `/api/create-room`
- `/api/join-room`
- `/api/game-state`
- `/api/validate-word`
- `/api/chat`
- `/api/leave-room`

### 3단계: GitHub에 푸시 후 Vercel 재배포

1. GitHub에 변경사항 푸시
2. Vercel이 자동으로 재배포
3. 테스트!

## 📋 체크리스트

- [ ] Cloudflare Worker 배포 완료
- [ ] Worker URL 확인 및 복사
- [ ] GitHub에서 index.html의 모든 API 주소 변경
- [ ] GitHub에 푸시
- [ ] Vercel 자동 재배포 확인
- [ ] 게임에서 방 생성 테스트
- [ ] 멀티플레이어 테스트

## 🎯 최종 구조

```
Vercel (정적 파일)
├── index.html ← API 주소를 Cloudflare Workers로 변경
├── sound/*.mp3
└── banner/*.jpg

Cloudflare Workers (API만)
├── /api/rooms
├── /api/create-room
├── /api/game-state
├── /api/validate-word
├── /api/chat
└── Durable Objects + KV (그대로 작동)
```

## 💡 CORS는 이미 설정됨

Worker 코드에서:
```javascript
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',  // 모든 origin 허용
    ...
};
```

Vercel URL도 자동으로 허용됩니다!



