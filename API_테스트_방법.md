# API 테스트 방법

## ✅ Worker는 API 전용입니다

정적 파일(HTML)은 이제 Vercel에서 서빙합니다.

## 🔍 테스트할 URL

### 1. 방 목록 API 테스트
브라우저에서 열기:
```
https://chosung-game-v2.sucksuck1114.workers.dev/api/rooms
```

**예상 결과:**
- JSON 데이터가 나와야 함 (방 목록 배열)
- `[]` (빈 배열)이어도 정상

### 2. 루트 경로는 404가 정상
```
https://chosung-game-v2.sucksuck1114.workers.dev/
```

**예상 결과:**
- "API only - Static files served by Vercel" 메시지
- 또는 404 에러
- 이것이 정상입니다! (정적 파일은 Vercel에서 서빙)

## 📍 정리

- ❌ `https://chosung-game-v2.sucksuck1114.workers.dev/` → 404 (정상)
- ✅ `https://chosung-game-v2.sucksuck1114.workers.dev/api/rooms` → JSON (정상)
- ✅ `https://chosungking-jdcuulpss-mistworlds-projects.vercel.app` → 게임 화면 (정상)

## ⚠️ "Assets have not yet been deployed..." 메시지

이 메시지가 나온다면:
- Workers 루트 URL(`/`)로 접근한 것
- 정상적인 동작입니다
- 게임 화면은 Vercel URL에서 확인하세요!



