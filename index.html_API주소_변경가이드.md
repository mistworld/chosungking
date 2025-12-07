# index.html API 주소 변경 가이드

## 🎯 문제
방 생성이 안 되는 이유: Vercel의 index.html에서 API 주소를 Cloudflare Workers로 변경하지 않았기 때문

## ✅ 해결 방법

GitHub 저장소(`https://github.com/mistworld/chosungking`)에서:

### 1. `public/index.html` 파일 수정

### 2. API 기본 URL 설정 추가

**파일 상단 (`<head>` 섹션 또는 `<script>` 시작 부분)에 추가:**

```javascript
// API 서버 주소 설정
const API_BASE_URL = 'https://chosung-game-v2.sucksuck1114.workers.dev';
```

### 3. 모든 `/api/` 호출 변경

**변경 전:**
```javascript
fetch('/api/rooms')
fetch('/api/create-room', {...})
fetch('/api/game-state?roomId=...')
```

**변경 후:**
```javascript
fetch(`${API_BASE_URL}/api/rooms`)
fetch(`${API_BASE_URL}/api/create-room`, {...})
fetch(`${API_BASE_URL}/api/game-state?roomId=...`)
```

## 📋 변경할 위치 (약 19개)

1. `/api/rooms` - 방 목록 조회
2. `/api/create-room` - 방 생성 ⭐ (이게 안 되는 이유)
3. `/api/join-room` - 방 참가
4. `/api/game-state` - 게임 상태 (여러 곳)
5. `/api/validate-word` - 단어 검증
6. `/api/chat` - 채팅
7. `/api/leave-room` - 방 나가기

## 🔧 빠른 해결 방법

### 방법 1: 전역 변수로 설정 (권장)

`<script>` 태그 시작 부분에 추가:

```javascript
// API 서버 설정
const API_BASE_URL = 'https://chosung-game-v2.sucksuck1114.workers.dev';

// 기존 함수들을 수정:
// fetch('/api/...') → fetch(`${API_BASE_URL}/api/...`)
```

### 방법 2: 정규식으로 일괄 변경

모든 `/api/`를 `${API_BASE_URL}/api/`로 변경

## ⚠️ 중요

1. **GitHub에 푸시하면 Vercel이 자동으로 재배포됩니다**
2. 변경 후 브라우저 캐시를 지우거나 시크릿 모드로 테스트하세요
3. 브라우저 콘솔에서 네트워크 탭으로 API 요청이 어디로 가는지 확인하세요

## 🧪 테스트

변경 후:
1. Vercel URL에서 게임 화면 확인
2. 방 생성 버튼 클릭
3. 브라우저 콘솔(F12)에서 네트워크 탭 확인
4. `/api/create-room` 요청이 `https://chosung-game-v2.sucksuck1114.workers.dev/api/create-room`로 가는지 확인



