# Durable Objects Dashboard에 안 보이는 문제 해결

## 문제
- 배포는 성공했지만 Dashboard에 Durable Objects가 안 보임
- "No Durable Objects found" 메시지

## 해결 방법 (단계별)

### 1단계: 완전히 새로운 태그로 변경

제가 이미 `v3-initial-deploy-2024`로 변경했습니다.

### 2단계: 강제 재배포

CMD에서 다음 명령어 실행:

```cmd
wrangler deploy --config wrangler-do.toml --force
```

`--force` 플래그를 사용하면 강제로 재배포됩니다.

### 3단계: 배포 로그 확인

배포할 때 다음 메시지들을 확인하세요:

✅ 성공 메시지:
- "Applied migration v3-initial-deploy-2024"
- "Uploaded chosung-game-do"
- "Published chosung-game-do"

❌ 에러 메시지가 있으면 복사해서 알려주세요.

### 4단계: 계정 확인

혹시 다른 계정에 배포되었을 수 있습니다:

```cmd
wrangler whoami
```

나오는 이메일 주소가 Dashboard에 로그인한 계정과 같은지 확인하세요.

### 5단계: Dashboard 확인 (5-10분 후)

배포 후 5-10분 기다린 다음:
1. Dashboard 새로고침 (F5)
2. Workers & Pages → Durable Objects 탭
3. `GameStateRoom` 확인

## 여전히 안 보이면

### 방법 A: Workers 목록에서 확인

1. Workers & Pages → Overview
2. `chosung-game-do` Worker 찾기
3. 클릭 → Settings 탭
4. Durable Objects 섹션 확인

### 방법 B: 실제 작동 테스트

Dashboard에 안 보여도 실제로 작동하는지 확인:

1. Pages → 프로젝트 → Settings → Functions
2. Durable Object Bindings → Add binding
3. 드롭다운에서 `chosung-game-do` 선택 시도
4. 선택되면 작동하는 것입니다!

### 방법 C: 완전히 새로 시작

위 방법들이 안 되면:

1. 기존 Worker 삭제 (Dashboard에서)
2. 태그를 완전히 새로운 것으로 변경
3. 다시 배포


