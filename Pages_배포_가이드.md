# Cloudflare Pages 배포 가이드

## 단계 1: Pages 프로젝트 생성

### Dashboard에서:
1. Workers & Pages → **Pages** 탭 클릭
2. **Create a project** 클릭
3. **Upload assets** 선택 (또는 **Connect to Git** - 나중에)

### 프로젝트 설정:
- Project name: `chosung-game` (또는 원하는 이름)
- Production branch: (Git 안 쓸 거면 무시)
- Build settings:
  - Framework preset: **None**
  - Build command: (비워두기)
  - Build output directory: `public` 또는 `.`

### 파일 업로드:
- **public** 폴더 전체를 ZIP으로 압축
- 또는 직접 드래그 앤 드롭

## 단계 2: Worker는 API만 처리하도록 유지

- Worker는 이미 API만 처리하도록 되어 있음
- Pages에서 Worker API를 호출하면 됨

## 단계 3: 연결

Pages와 Worker를 연결하려면:
- Pages에서 `/api/*` 요청을 Worker로 프록시
- 또는 Pages에서 Worker API 직접 호출



