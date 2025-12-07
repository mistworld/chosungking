// index.html에서 API 주소를 변경하는 스크립트
// Node.js로 실행하거나, 내용을 복사해서 사용

const API_BASE_URL = 'https://chosung-game-v2.sucksuck1114.workers.dev';

// 변경 규칙:
// fetch('/api/...') → fetch(`${API_BASE_URL}/api/...`)
// fetch(`/api/...`) → fetch(`${API_BASE_URL}/api/...`)

// 모든 API 호출 패턴:
/*
fetch('/api/rooms') 
→ fetch(`${API_BASE_URL}/api/rooms`)

fetch('/api/create-room', {...})
→ fetch(`${API_BASE_URL}/api/create-room`, {...})

fetch(`/api/game-state?roomId=${roomId}`)
→ fetch(`${API_BASE_URL}/api/game-state?roomId=${roomId}`)
*/

// 변경해야 할 위치들:
// 1. 방 목록: fetch('/api/rooms')
// 2. 방 생성: fetch('/api/create-room', {...}) ← 이게 문제!
// 3. 방 참가: fetch('/api/join-room', {...})
// 4. 게임 상태: fetch(`/api/game-state?roomId=...`)
// 5. 단어 검증: fetch('/api/validate-word', {...})
// 6. 채팅: fetch(`/api/chat?roomId=...`)
// 7. 방 나가기: fetch('/api/leave-room', {...})



