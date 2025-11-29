# Dashboard에 Worker가 안 보이는 문제 해결

## 문제
- CMD로 배포는 성공했지만 Dashboard에 Worker가 안 보임
- Pages에서 바인딩할 때 드롭다운에 옵션이 없음

## 확인 방법

### 1단계: 계정 확인

CMD에서 다음 명령어 실행:

```cmd
wrangler whoami
```

나오는 이메일 주소가 Dashboard에 로그인한 계정과 **정확히** 같은지 확인하세요.

### 2단계: Dashboard에서 Worker 확인

1. **Workers & Pages** → **Overview** 클릭
2. 여기서 **모든 Worker 목록**을 볼 수 있습니다
3. `chosung-game-state-do`가 있는지 확인

### 3단계: 배포 상태 확인

배포할 때 나온 메시지를 다시 확인:
- "Total Upload" 메시지가 있었나요?
- "Published" 메시지가 있었나요?
- 에러 메시지가 있었나요?

## 해결 방법

### 방법 1: 로그아웃/로그인 (시도해볼 가치 있음)

1. Dashboard에서 로그아웃
2. 다시 로그인
3. Workers & Pages → Overview 확인

### 방법 2: 배포 재확인

다시 배포해서 정확한 메시지 확인:

```cmd
wrangler deploy --config wrangler-do.toml
```

배포할 때 나오는 **전체 메시지**를 복사해서 확인하세요.

### 방법 3: Worker 이름 확인

혹시 다른 이름으로 배포되었을 수 있습니다.

Dashboard → Workers & Pages → Overview에서:
- `chosung`으로 시작하는 모든 Worker 찾기
- 비슷한 이름이 있는지 확인

### 방법 4: 완전히 새로 배포

Worker 이름을 다시 변경해서 배포:

1. `wrangler-do.toml` 파일에서 `name` 변경
2. 다시 배포
3. Dashboard 확인

## 중요 사항

**CMD로 배포가 성공했다고 해서 반드시 Dashboard에 보이는 것은 아닙니다.**

가능한 이유:
- Cloudflare가 처리하는데 시간이 걸림 (최대 10-15분)
- 다른 계정에 배포됨
- Worker 이름 충돌
- 배포는 되었지만 Dashboard에 반영 안 됨

## 다음 단계

1. `wrangler whoami`로 계정 확인
2. Dashboard에서 Worker 목록 확인
3. 로그아웃/로그인 시도
4. 결과 알려주기


