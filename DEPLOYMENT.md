# Durable Objects 배포 가이드

## 문제 해결: Pages에서 Durable Objects 바인딩

Cloudflare Pages에서 Durable Objects를 사용하려면 **별도의 Workers 스크립트로 먼저 배포**한 후, Pages에서 바인딩해야 합니다.

## 배포 순서

### 1단계: Durable Objects Workers 배포

먼저 DO 클래스를 포함한 Workers 스크립트를 배포합니다:

```bash
wrangler deploy --config wrangler-do.toml
```

이 명령어는 `chosung-game-do`라는 이름의 Workers를 배포하고, `GameStateRoom` Durable Object 클래스를 등록합니다.

### 2단계: Pages에서 바인딩 설정

1. **Cloudflare Dashboard** → **Pages** → 프로젝트 선택
2. **Settings** → **Functions** → **Durable Object Bindings** 섹션
3. **Add binding** 클릭
4. 다음 정보 입력:
   - **Variable name**: `GAME_STATE`
   - **Durable Object**: `chosung-game-do` (1단계에서 배포한 Workers 이름)
   - **Class name**: `GameStateRoom`
5. **Save** 클릭

### 3단계: Pages 배포

```bash
wrangler pages deploy .
```

또는 Git 연동을 사용하는 경우, 커밋 후 자동 배포됩니다.

## 로컬 테스트

### DO Workers 로컬 테스트

```bash
wrangler dev --config wrangler-do.toml
```

### Pages 로컬 테스트

```bash
wrangler pages dev . --config wrangler.toml
```

**주의**: 로컬에서는 DO 바인딩이 자동으로 연결되지 않을 수 있습니다. 프로덕션 환경에서 테스트하는 것을 권장합니다.

## 파일 구조

- `src/game-state-do.js`: Durable Object 클래스 정의 (Workers로 배포)
- `wrangler-do.toml`: DO Workers 배포 설정
- `functions/api/game-state.js`: Pages Functions (DO stub 호출)
- `wrangler.toml`: Pages 배포 설정 (DO 바인딩 참조)

## 문제 해결

### "No option만 나와요"

- DO Workers가 먼저 배포되었는지 확인
- `wrangler-do.toml`의 `name`과 Pages 바인딩의 `script_name`이 일치하는지 확인
- Workers 배포 후 몇 분 기다린 후 다시 시도

### "Durable Object binding GAME_STATE missing"

- Pages 설정에서 DO 바인딩이 추가되었는지 확인
- 배포 후 환경 변수가 제대로 전달되는지 확인


