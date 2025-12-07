# 🔍 Vercel 배포 확인 및 문제 해결

## 📊 현재 상황

**증상:**
- 방 생성 버튼 클릭 시 `TypeError: Failed to fetch` 에러
- 네트워크 탭에 `/api/create-room` POST 요청이 없음
- 방 목록 조회는 정상 작동 (200 OK, 빈 배열 반환)

**원인:**
- Vercel이 최신 코드를 아직 배포하지 않았을 가능성
- 또는 브라우저 캐시 문제

---

## ✅ 해결 방법

### 1단계: Vercel Dashboard 확인

1. https://vercel.com 로그인
2. **chosungking** 프로젝트 클릭
3. **Deployments** 탭 확인

**확인 사항:**
- 최신 커밋 (`d5248ab - Update API URLs to Cloudflare Workers`)이 배포되었는지
- 배포 상태가 "Ready" 인지
- 배포 시간 확인

---

### 2단계: 배포 완료 대기

**배포 시간:** 보통 1-3분 소요

**배포 상태 확인:**
- 🟡 **Building**: 빌드 중
- 🟢 **Ready**: 배포 완료
- 🔴 **Error**: 배포 실패

---

### 3단계: 브라우저 캐시 삭제

배포가 완료되었는데도 문제가 계속되면:

1. **Chrome/Edge:**
   - `Ctrl + Shift + Delete`
   - "캐시된 이미지 및 파일" 선택
   - "데이터 삭제" 클릭

2. **또는 시크릿 모드:**
   - `Ctrl + Shift + N`
   - https://chosungking.vercel.app 접속

3. **또는 강력 새로고침:**
   - `Ctrl + Shift + R` (Windows)
   - `Cmd + Shift + R` (Mac)

---

### 4단계: 강제 재배포 (필요시)

Vercel Dashboard에서:

1. **Deployments** 탭
2. 최신 배포 클릭
3. **⋯** (더보기) 버튼 클릭
4. **Redeploy** 선택
5. **Redeploy** 버튼 클릭

---

## 🧪 테스트 방법

### 1. API URL 확인

브라우저 개발자 도구 (F12) → Console 탭에서:

```javascript
console.log(API_BASE);
```

**예상 결과:**
```
https://steep-moon-7816.sucksuck1114.workers.dev
```

만약 `undefined`가 나오면 Vercel이 아직 최신 코드를 배포하지 않은 것입니다.

---

### 2. 방 생성 테스트

1. https://chosungking.vercel.app 접속
2. **함께하기** 버튼 클릭
3. **시간제 방 만들기** 버튼 클릭
4. 방 제목 입력 (선택사항)
5. **확인** 버튼 클릭

**개발자 도구 (F12) → Network 탭 확인:**
- `create-room` POST 요청이 보여야 함
- Status: 200 OK
- Response: `{"roomId":"XXXX"}`

---

## 🔧 Cloudflare Workers 테스트

터미널에서 직접 API 테스트:

```powershell
# 방 목록 조회
curl https://steep-moon-7816.sucksuck1114.workers.dev/api/rooms

# 방 생성 (PowerShell)
$body = @{title='테스트방'; gameMode='time'; playerId='test123'; playerName='테스터'} | ConvertTo-Json
Invoke-RestMethod -Uri 'https://steep-moon-7816.sucksuck1114.workers.dev/api/create-room' -Method POST -Body $body -ContentType 'application/json'
```

**예상 결과:**
```json
{"roomId":"ABCD"}
```

---

## ⚠️ 만약 Cloudflare Workers에서 에러가 나면

### 에러 1: `error code: 1101`

**원인:** Worker가 응답하지 않음

**해결 방법:**
1. Cloudflare Dashboard 확인
2. Worker 재배포:
   ```powershell
   cd "C:\Users\김현희윈도우\Downloads\1130초성왕"
   powershell -ExecutionPolicy Bypass -Command "wrangler deploy"
   ```

---

### 에러 2: `KV Namespace not found`

**원인:** KV 바인딩 문제

**해결 방법:**
1. Cloudflare Dashboard → Workers & Pages → steep-moon-7816
2. Settings → Variables → KV Namespace Bindings 확인
3. `ROOM_LIST`, `WORD_CACHE`가 바인딩되어 있는지 확인

---

### 에러 3: `Durable Object not found`

**원인:** DO 바인딩 또는 마이그레이션 문제

**해결 방법:**
1. Cloudflare Dashboard → Workers & Pages → steep-moon-7816
2. Settings → Variables → Durable Object Bindings 확인
3. `GAME_STATE` → `GameStateRoom`이 바인딩되어 있는지 확인

---

## 📝 체크리스트

배포 확인:
- [ ] Git push 완료 (`d5248ab` 커밋)
- [ ] Vercel 배포 완료 (Ready 상태)
- [ ] 브라우저 캐시 삭제
- [ ] `API_BASE` 변수 확인 (개발자 도구 Console)
- [ ] 방 생성 테스트 (Network 탭에서 POST 요청 확인)

Cloudflare Workers 확인:
- [ ] `/api/rooms` GET 요청 성공 (200 OK)
- [ ] `/api/create-room` POST 요청 성공 (200 OK)
- [ ] KV Namespaces 바인딩 확인
- [ ] Durable Objects 바인딩 확인

---

## 🎯 다음 단계

1. **Vercel Dashboard에서 배포 상태 확인** (1-3분 대기)
2. **브라우저 캐시 삭제** 후 재테스트
3. **개발자 도구 (F12)로 Network 탭 확인**
4. 문제가 계속되면 **강제 재배포**

---

## 💡 참고

**Vercel 배포 URL:**
- Production: https://chosungking.vercel.app
- Preview: https://chosungking-git-master-[username].vercel.app

**Cloudflare Workers URL:**
- https://steep-moon-7816.sucksuck1114.workers.dev

**GitHub 리포:**
- https://github.com/mistworld/chosung-scramble


