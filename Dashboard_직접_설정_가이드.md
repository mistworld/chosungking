# Dashboard에서 직접 Worker 설정 가이드

## ✅ 새 Worker 생성 완료
Worker 이름: `steep-moon-7816`
URL: `https://steep-moon-7816.sucksuck1114.workers.dev/`

## 📋 설정 단계

### 1단계: Worker 코드 붙여넣기

1. Dashboard → `steep-moon-7816` Worker
2. **Edit code** 클릭
3. `src/worker.js` 파일 내용 전체 복사
4. Dashboard 코드 에디터에 붙여넣기
5. **Save and deploy** 클릭

### 2단계: KV Namespace 바인딩 추가

Settings → Bindings → **Add binding** → **KV namespace**

#### 첫 번째 KV:
- **Variable name**: `ROOM_LIST`
- **KV namespace**: `fdd09a3f8360417b8b710dcbc0ad1d93` (기존 namespace 선택)

#### 두 번째 KV:
- **Variable name**: `WORD_CACHE`
- **KV namespace**: `c2668ae36bf64d74b174663e61f91d53` (기존 namespace 선택)

### 3단계: Durable Objects 바인딩

**⚠️ 주의**: DO는 별도 Worker가 필요할 수 있습니다.

#### 옵션 1: DO Worker 별도 생성
1. Dashboard → Create Worker
2. 이름: `chosung-do-worker`
3. `src/game-state-do.js` 코드 붙여넣기
4. Deploy

#### 옵션 2: 메인 Worker에 DO 포함
- `src/worker.js`에 이미 `export { GameStateRoom }` 있음
- Dashboard에서 DO 바인딩 추가 시도
- "No option" 나오면 옵션 1 사용

### 4단계: DO 바인딩 추가 (옵션 2 시도)

Settings → Bindings → **Add binding** → **Durable Objects**

- **Variable name**: `GAME_STATE`
- **Class name**: `GameStateRoom`
- **Script name**: `chosung-do-worker` (또는 메인 Worker 이름)

## 🧪 테스트

### 1. API 테스트
```
https://steep-moon-7816.sucksuck1114.workers.dev/api/rooms
```

JSON 응답이 나와야 함!

### 2. Vercel index.html 수정
모든 `/api/`를 다음으로 변경:
```
https://steep-moon-7816.sucksuck1114.workers.dev/api/
```

## 📝 최종 API URL
```
https://steep-moon-7816.sucksuck1114.workers.dev
```



