# PowerShell 실행 정책 문제 해결

## 문제
"이 시스템에서 스크립트를 실행할 수 없으므로 nodejs npm.ps1 파일을 로드할 수 없다"는 에러가 발생하는 경우

## 해결 방법

### 방법 1: 실행 정책 변경 (권장)

관리자 권한으로 PowerShell을 열고 다음 명령어 실행:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 방법 2: 일시적으로 실행 정책 우회

현재 세션에서만 실행 정책을 우회:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### 방법 3: npx 사용

wrangler 대신 npx를 사용:

```powershell
npx wrangler deploy --config wrangler-do.toml
```

### 방법 4: CMD 사용

PowerShell 대신 명령 프롬프트(CMD) 사용:

```cmd
wrangler deploy --config wrangler-do.toml
```

## 배포 명령어

수정 후 다음 명령어로 배포:

```powershell
wrangler deploy --config wrangler-do.toml
```

또는

```cmd
wrangler deploy --config wrangler-do.toml
```


