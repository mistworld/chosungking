# Workers 배포 확인 및 문제 해결

## 문제: "Total Upload 성공"했지만 Dashboard에 Worker가 안 보임

### 1. Dashboard에서 확인할 위치

**중요**: Durable Objects만 있는 Workers는 때때로 일반 Workers 목록에 표시되지 않을 수 있습니다.

#### 확인 방법:

1. **Cloudflare Dashboard** → **Workers & Pages** → **Overview**
   - 여기서 `chosung-game-do`가 보이는지 확인

2. **Workers & Pages** → **Durable Objects** 탭
   - 여기서 `GameStateRoom` 클래스가 등록되어 있는지 확인
   - `gamestateroom`이 보인다면 클래스는 등록된 것입니다

3. **Workers & Pages** → **Workers** 탭
   - 모든 Workers 목록을 확인

### 2. 배포 상태 확인 (터미널에서)

```bash
# 배포 목록 확인
wrangler deployments list --config wrangler-do.toml

# Workers 목록 확인
wrangler list

# 특정 Worker 정보 확인
wrangler tail --config wrangler-do.toml
```

### 3. 실제로 배포되었는지 확인

배포가 성공했다면 다음 명령어로 테스트:

```bash
# Worker가 응답하는지 확인
curl https://chosung-game-do.YOUR_ACCOUNT.workers.dev
```

또는 Dashboard에서:
- **Workers & Pages** → `chosung-game-do` 선택 → **Settings** → **Triggers** → **Routes** 확인

### 4. 문제 해결 방법

#### 방법 1: 명시적으로 배포 확인

```bash
wrangler deploy --config wrangler-do.toml --name chosung-game-do
```

#### 방법 2: 배포 로그 확인

배포 시 나온 전체 로그를 확인하세요. 특히:
- "Uploaded chosung-game-do" 메시지
- "Published chosung-game-do" 메시지
- 에러나 경고 메시지

#### 방법 3: Dashboard에서 수동 확인

1. **Workers & Pages** → **Create** → **Create Worker**
2. 기존에 `chosung-game-do`가 있는지 검색
3. 없다면 새로 생성하거나, 있다면 설정 확인

### 5. wrangler.toml 충돌 문제

**답**: `wrangler.toml`과 `wrangler-do.toml`은 충돌하지 않습니다.
- `wrangler.toml`: Pages 배포용 (`--config` 없이 사용)
- `wrangler-do.toml`: Workers 배포용 (`--config wrangler-do.toml`로 사용)

### 6. Durable Objects만 있는 Workers의 특성

Durable Objects만 export하고 메인 handler가 거의 없는 Workers는:
- Dashboard에서 다르게 표시될 수 있습니다
- **Durable Objects** 탭에서 클래스가 등록되어 있으면 정상입니다
- 실제 Worker 엔드포인트는 사용되지 않을 수 있습니다 (Pages에서 직접 DO를 호출하므로)

### 7. 최종 확인

**중요**: Pages에서 DO를 사용하려면:
1. ✅ DO Workers 배포 완료 (`chosung-game-do`)
2. ✅ DO 클래스 등록 확인 (`GameStateRoom` / `gamestateroom`)
3. ⏳ Pages에서 DO 바인딩 추가 (다음 단계)

**결론**: `gamestateroom`이 보인다면 DO 클래스는 정상적으로 등록된 것입니다. 
Dashboard에 `chosung-game-do` Worker가 안 보여도, DO 클래스가 등록되어 있으면 Pages에서 바인딩할 수 있습니다.


