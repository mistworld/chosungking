# Worker URL 확인 방법

## 배포는 성공했습니다! ✅

Worker 이름: `chosung-api-only`

## URL 확인 방법

### 방법 1: Dashboard에서 확인
1. Cloudflare Dashboard → Workers & Pages
2. `chosung-api-only` Worker 찾기
3. Overview 또는 Settings → Domains & Routes
4. workers.dev URL 확인

### 방법 2: 일반적인 형식
Worker 이름이 `chosung-api-only`이면:
```
https://chosung-api-only.{your-subdomain}.workers.dev
```

예:
- `https://chosung-api-only.sucksuck1114.workers.dev`

### 방법 3: wrangler 명령어
```bash
npx wrangler deployments list --name chosung-api-only
```

## 다음 단계

1. Worker URL 확인
2. Vercel index.html에서 API 주소를 이 URL로 변경
3. 테스트!



