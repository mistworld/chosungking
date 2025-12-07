// ============================================
// Dashboard Quick edit용 통합 파일 v15
// game-state-do.js + worker.js를 하나로 합침
// WORKER-v15-FORCE-DEPLOY-2025-12-06-17:30
// ============================================

// game-state-do.js 내용
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export class GameStateRoom {
  constructor(state, env) {
      this.state = state;
      this.env = env;
      this.roomStatePromise = null;
  }

  async fetch(request) {
      if (request.method === 'OPTIONS') {
          return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const roomId = url.searchParams.get('roomId');

      if (!roomId) {
          return this.json({ error: 'roomId is required' }, 400);
      }

      if (request.method === 'GET') {
          const snapshot = await this.getState();
          if (!snapshot) {
              return this.json({ error: 'Room not found' }, 404);
          }
          return this.json(snapshot);
      }

      if (request.method === 'POST') {
          const body = await request.json();
          const updated = await this.state.blockConcurrencyWhile(() =>
              this.applyUpdate(roomId, body)
          );
          return this.json(updated);
      }

      if (request.method === 'DELETE') {
          await this.state.blockConcurrencyWhile(async () => {
              await this.state.storage.deleteAll();
              this.roomStatePromise = Promise.resolve(null);
          });
          return this.json({ success: true });
      }

      return this.json({ error: 'Method not allowed' }, 405);
  }

  async alarm() {
      await this.state.storage.deleteAll();
      this.roomStatePromise = Promise.resolve(null);
  }

  async applyUpdate(roomId, update) {
      const state = await this.ensureState(roomId);
      const now = Date.now();

      if (state.gameMode === 'turn' && Array.isArray(update.players) && update.players.length > 0) {
          if (!state.players || state.players.length === 0) {
              state.players = update.players;
              console.log(`[턴제] state.players 초기화: ${state.players.map(p => p.id || p).join(', ')}`);
          } else if (update.players.length > state.players.length) {
              state.players = update.players;
              console.log(`[턴제] state.players 업데이트 (새 플레이어 추가): ${state.players.map(p => p.id || p).join(', ')}`);
          }
      }

      if (update.playerId && update.score !== undefined) {
          state.scores[update.playerId] = update.score;
          state.playerWords[update.playerId] = update.words || [];
          state.lastUpdate = now;
      }

      if (update.chatMessage && update.playerName) {
          if (!state.chatMessages) {
              state.chatMessages = [];
          }
          state.chatMessages.push({
              playerId: update.playerId,
              playerName: update.playerName,
              message: update.chatMessage,
              timestamp: now
          });
          if (state.chatMessages.length > 100) {
              state.chatMessages = state.chatMessages.slice(-100);
          }
      }

      if (update.action === 'start_game') {
          state.gameStarted = true;
          state.startTime = now;
          state.timeLeft = 180;
          state.consonants = update.consonants || state.consonants || [];
          state.endTime = null;
          state.roundNumber += 1;
          
          if (update.gameMode === 'turn') {
              state.gameMode = 'turn';
              state.usedWords = [];
              state.playerLives = {};
              state.eliminatedPlayers = [];
              state.turnCount = {};
              state.isFirstTurn = true;
              
              if (Array.isArray(update.players) && update.players.length > 0) {
                  state.players = update.players;
              }
              
              const players = state.players || [];
              if (players.length > 0) {
                  const firstPlayer = players[0];
                  state.currentTurnPlayerId = firstPlayer.id;
                  state.turnStartTime = now;
                  state.playerLives[firstPlayer.id] = 0;
                  state.turnCount[firstPlayer.id] = 0;
              } else {
                  state.currentTurnPlayerId = update.hostPlayerId || null;
                  state.turnStartTime = now;
              }
          }
          
          await this.state.storage.deleteAlarm();
      }

      if (update.action === 'new_game') {
          state.gameStarted = true;
          state.startTime = now;
          state.timeLeft = 180;
          state.consonants = update.consonants || [];
          state.endTime = null;
          state.scores = {};
          state.playerWords = {};
          state.roundNumber += 1;
          
          if (update.gameMode === 'turn' || state.gameMode === 'turn') {
              state.gameMode = 'turn';
              state.usedWords = [];
              state.playerLives = {};
              state.eliminatedPlayers = [];
              state.turnCount = {};
              state.isFirstTurn = true;
              
              if (Array.isArray(update.players) && update.players.length > 0) {
                  state.players = update.players;
              }
              
              const players = state.players || [];
              if (players.length > 0) {
                  const firstPlayer = players[0];
                  state.currentTurnPlayerId = firstPlayer.id;
                  state.turnStartTime = now;
                  state.playerLives[firstPlayer.id] = 0;
                  state.turnCount[firstPlayer.id] = 0;
              } else {
                  state.currentTurnPlayerId = update.hostPlayerId || state.currentTurnPlayerId || null;
                  state.turnStartTime = now;
              }
          }
          
          await this.state.storage.deleteAlarm();
      }

      if (update.action === 'submit_word' && state.gameMode === 'turn') {
          const { playerId, word, isValid, wordLength, hasSpecialConsonant } = update;
          
          if (playerId !== state.currentTurnPlayerId) {
              console.log(`[턴제] ${playerId}는 현재 턴이 아닙니다. 현재 턴: ${state.currentTurnPlayerId}`);
              return state;
          }
          
          if (state.turnStartTime) {
              const turnTimeLimit = state.isFirstTurn ? 9000 : 6000;
              const elapsed = now - state.turnStartTime;
              
              if (elapsed >= turnTimeLimit) {
                  console.log(`[턴제] ${playerId} 시간 초과 (${elapsed}ms >= ${turnTimeLimit}ms). 단어 거부`);
                  
                  if (!state.playerLives[playerId]) state.playerLives[playerId] = 0;
                  state.playerLives[playerId] -= 1;
                  
                  if (state.playerLives[playerId] < 0) {
                      if (!state.eliminatedPlayers.includes(playerId)) {
                          state.eliminatedPlayers.push(playerId);
                          console.log(`[턴제] ${playerId} 탈락!`);
                      }
                      
                      const activePlayers = (state.players || []).filter(p => !state.eliminatedPlayers.includes(p.id));
                      if (activePlayers.length <= 1) {
                          state.gameStarted = false;
                          state.endTime = now;
                          return state;
                      }
                      
                      await this.nextTurn(state, now, state.players || []);
                  } else {
                      state.turnStartTime = now;
                      console.log(`[턴제] ${playerId} 연장권 사용. 다음 6초 시작`);
                  }
                  
                  return state;
              }
          }
          
          if (isValid) {
              const wordLower = word.toLowerCase();
              if (state.usedWords.includes(wordLower)) {
                  console.log(`[턴제] 중복 단어: ${wordLower}`);
                  return state;
              }
              
              state.usedWords.push(wordLower);
              
              if (!state.turnCount[playerId]) state.turnCount[playerId] = 0;
              state.turnCount[playerId] += 1;
              
              let livesEarned = 0;
              if (wordLength === 2 && hasSpecialConsonant) {
                  livesEarned = 1;
              } else if (wordLength === 2) {
                  livesEarned = 0;
              } else if (wordLength === 3) {
                  livesEarned = 1;
              } else if (wordLength === 4) {
                  livesEarned = 3;
              } else if (wordLength >= 5) {
                  livesEarned = 5;
              }
              
              if (!state.playerLives[playerId]) state.playerLives[playerId] = 0;
              state.playerLives[playerId] += livesEarned;
              
              console.log(`[턴제] ${playerId}가 "${word}" 맞춤. 연장권 +${livesEarned}, 현재: ${state.playerLives[playerId]}`);
              
              await this.nextTurn(state, now, state.players || []);
          }
      }
      
      if (update.action === 'turn_timeout' && state.gameMode === 'turn') {
          const { playerId } = update;
          if (playerId === state.currentTurnPlayerId) {
              if (!state.playerLives[playerId]) state.playerLives[playerId] = 0;
              state.playerLives[playerId] -= 1;
              
              console.log(`[턴제] ${playerId} 시간 초과. 연장권 -1, 현재: ${state.playerLives[playerId]}`);
              
              if (state.playerLives[playerId] < 0) {
                  if (!state.eliminatedPlayers.includes(playerId)) {
                      state.eliminatedPlayers.push(playerId);
                      console.log(`[턴제] ${playerId} 탈락!`);
                  }
                  
                  const activePlayers = (state.players || []).filter(p => !state.eliminatedPlayers.includes(p.id));
                  if (activePlayers.length <= 1) {
                      state.gameStarted = false;
                      state.endTime = now;
                      return state;
                  }
                  
                  await this.nextTurn(state, now, state.players || []);
              } else {
                  state.turnStartTime = now;
                  console.log(`[턴제] ${playerId} 연장권 사용. 다음 6초 시작`);
              }
          }
      }
      if (update.action === 'player_rejoin' && state.gameMode === 'turn') {
          const { playerId } = update;
          if (playerId && state.eliminatedPlayers && !state.eliminatedPlayers.includes(playerId)) {
              state.eliminatedPlayers.push(playerId);
              console.log(`[턴제] 탈락자 ${playerId} 재입장 - eliminatedPlayers에 다시 추가`);
          }
      }

      if (update.action === 'end_game') {
          state.gameStarted = false;
          state.endTime = now;
          await this.state.storage.setAlarm(now + 60 * 1000);
      }

      await this.persistState(state);
      return state;
  }

  async ensureState(roomId) {
      let snapshot = await this.getState();

      if (!snapshot) {
          snapshot = {
              id: roomId,
              createdAt: Date.now(),
              gameStarted: false,
              startTime: null,
              endTime: null,
              timeLeft: 180,
              consonants: [],
              scores: {},
              playerWords: {},
              roundNumber: 0,
              lastUpdate: null,
              chatMessages: [],
              gameMode: 'time',
              currentTurnPlayerId: null,
              turnStartTime: null,
              playerLives: {},
              eliminatedPlayers: [],
              usedWords: [],
              turnCount: {},
              isFirstTurn: true
          };
          await this.persistState(snapshot);
      }

      if (!snapshot.chatMessages) {
          snapshot.chatMessages = [];
      }
      if (!snapshot.gameMode) snapshot.gameMode = 'time';
      if (!snapshot.playerLives) snapshot.playerLives = {};
      if (!snapshot.eliminatedPlayers) snapshot.eliminatedPlayers = [];
      if (!snapshot.usedWords) snapshot.usedWords = [];
      if (!snapshot.turnCount) snapshot.turnCount = {};
      if (snapshot.isFirstTurn === undefined) snapshot.isFirstTurn = true;
      return snapshot;
  }

  async getState() {
      if (!this.roomStatePromise) {
          this.roomStatePromise = this.state.storage.get('roomState');
      }
      return this.roomStatePromise;
  }

  async persistState(state) {
      this.roomStatePromise = Promise.resolve(state);
      await this.state.storage.put('roomState', state);
  }

  async nextTurn(state, now, players = []) {
      let playerList = state.players || [];
      if (playerList.length === 0 && players.length > 0) {
          playerList = players;
          state.players = players;
          console.log(`[턴제] nextTurn: state.players 없어서 전달받은 players 사용: ${players.map(p => p.id || p).join(', ')}`);
      }
      
      if (playerList.length === 0) {
          console.log('[턴제] nextTurn: players 배열이 비어있음 - 게임 종료');
          state.gameStarted = false;
          state.endTime = now;
          return;
      }
      
      console.log('[턴제] nextTurn 호출:', {
          currentTurn: state.currentTurnPlayerId,
          players: playerList.map(p => p.id),
          eliminated: state.eliminatedPlayers
      });
      
      const activePlayers = playerList.filter(p => !state.eliminatedPlayers.includes(p.id));
      if (activePlayers.length <= 1) {
          state.gameStarted = false;
          state.endTime = now;
          return;
      }
      
      const currentIndex = activePlayers.findIndex(p => p.id === state.currentTurnPlayerId);
      if (currentIndex === -1) {
          state.currentTurnPlayerId = activePlayers[0].id;
          state.turnStartTime = now;
          state.isFirstTurn = true;
          return;
      }
      
      const nextIndex = (currentIndex + 1) % activePlayers.length;
      const nextPlayer = activePlayers[nextIndex];
      
      state.currentTurnPlayerId = nextPlayer.id;
      state.turnStartTime = now;
      state.isFirstTurn = false;
      
      if (state.playerLives[nextPlayer.id] === undefined) {
          state.playerLives[nextPlayer.id] = 0;
      }
      if (state.turnCount[nextPlayer.id] === undefined) {
          state.turnCount[nextPlayer.id] = 0;
      }
  }

  json(payload, status = 200) {
      return new Response(JSON.stringify(payload), {
          status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }
}

// worker.js 내용 (나머지)
async function handleRooms(env) {
  const corsHeadersWithCache = {
      ...corsHeaders,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
  };
  const STALE_PLAYER_TIMEOUT = 5 * 1000;
  try {
      if (!env.ROOM_LIST) {
          console.log('ROOM_LIST가 없음!');
          return new Response(JSON.stringify([]), {
              headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeadersWithCache 
              }
          });
      }
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      const rooms = [];
      const seenIds = new Set();
      const roomIdSet = new Set();
      const list = await env.ROOM_LIST.list({ limit: 100 });
      console.log(`[rooms] list() 결과: ${list.keys.length}개`);
      
      const recentRooms = await env.ROOM_LIST.get('_recent_rooms', 'json') || [];
      const recentRoomIds = new Set(recentRooms.map(r => r.roomId));
      console.log(`[rooms] 최근 생성된 방: ${recentRoomIds.size}개`);
      
      const roomPromises = list.keys.map(key => env.ROOM_LIST.get(key.name, 'json'));
      const roomDataArray = await Promise.all(roomPromises);
      
      const recentRoomPromises = Array.from(recentRoomIds)
          .filter(id => !list.keys.some(k => k.name === id))
          .map(id => env.ROOM_LIST.get(id, 'json'));
      const recentRoomDataArray = await Promise.all(recentRoomPromises);
      
      for (let i = 0; i < list.keys.length; i++) {
          const key = list.keys[i];
          try {
              const roomData = roomDataArray[i];
              if (!roomData) {
                  console.log(`roomData 없음, 키 제거 대상: ${key.name}`);
                  continue;
              }
              const createdAt = roomData.createdAt || now;
              const roomId = roomData.id || key.name;
              const players = Array.isArray(roomData.players) ? roomData.players : [];
              
              let playerCount = players.length;
              
              if (roomData.lastSeen && typeof roomData.lastSeen === 'object' && players.length > 0) {
                  const activePlayers = players.filter(p => {
                      const last = roomData.lastSeen[p.id];
                      return !last || (typeof last === 'number' && (now - last) < STALE_PLAYER_TIMEOUT);
                  });
                  playerCount = activePlayers.length;
              }
              if ((now - createdAt) >= ONE_HOUR) {
                  continue;
              }
              if (playerCount <= 0) {
                  continue;
              }
              if (seenIds.has(roomId)) {
                  continue;
              }
              seenIds.add(roomId);
              rooms.push({
                  id: roomId,
                  roomNumber: roomData.roomNumber || 0,
                  createdAt,
                  title: roomData.title || '초성 배틀방',
                  gameMode: roomData.gameMode || 'time',
                  playerCount,
                  maxPlayers: roomData.maxPlayers || 5,
                  players: [],
                  gameStarted: roomData.gameStarted || false
              });
          } catch (error) {
              console.error(`방 처리 실패 ${key.name}:`, error);
          }
      }
      
      for (const roomData of recentRoomDataArray) {
          if (!roomData) continue;
          const roomId = roomData.id;
          if (seenIds.has(roomId)) continue;
          
          try {
              const createdAt = roomData.createdAt || now;
              const players = Array.isArray(roomData.players) ? roomData.players : [];
              
              let playerCount = players.length;
              
              if (roomData.lastSeen && typeof roomData.lastSeen === 'object' && players.length > 0) {
                  const activePlayers = players.filter(p => {
                      const last = roomData.lastSeen[p.id];
                      return !last || (typeof last === 'number' && (now - last) < STALE_PLAYER_TIMEOUT);
                  });
                  playerCount = activePlayers.length;
              }
              
              if ((now - createdAt) >= ONE_HOUR) continue;
              if (playerCount <= 0) continue;
              
              seenIds.add(roomId);
              rooms.push({
                  id: roomId,
                  roomNumber: roomData.roomNumber || 0,
                  createdAt,
                  title: roomData.title || '초성 배틀방',
                  gameMode: roomData.gameMode || 'time',
                  playerCount,
                  maxPlayers: roomData.maxPlayers || 5,
                  players: [],
                  gameStarted: roomData.gameStarted || false
              });
          } catch (error) {
              console.error(`최근 방 처리 실패 ${roomData?.id}:`, error);
          }
      }
      rooms.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log(`활성 방 개수: ${rooms.length}`);
      return new Response(JSON.stringify(rooms), {
          headers: { 
              'Content-Type': 'application/json',
              ...corsHeadersWithCache 
          }
      });
  } catch (error) {
      console.error('rooms.js 에러:', error);
      return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 
              'Content-Type': 'application/json',
              ...corsHeadersWithCache 
          }
      });
  }
}

async function handleCreateRoom(request, env) {
  const { title, gameMode, playerId, playerName } = await request.json().catch(() => ({}));
  const now = Date.now();
  let roomNumber = 1;
  try {
      const existing = await env.ROOM_LIST.list({ limit: 1000 });
      const usedNumbers = new Set();
      for (const key of existing.keys) {
          const meta = key.metadata;
          if (meta && typeof meta.roomNumber === 'number' && meta.roomNumber > 0) {
              usedNumbers.add(meta.roomNumber);
          }
      }
      while (usedNumbers.has(roomNumber)) {
          roomNumber++;
      }
  } catch (e) {
      console.error('[create-room] roomNumber 계산 실패, 1부터 시작:', e);
      roomNumber = 1;
  }
  const roomId = generateRoomCode();
  
  const randomTitles = [
      "초성 배틀방",
      "빠른 대결",
      "도전! 초성왕",
      "친구들과 한판",
      "단어 천재 모여라"
  ];
  
  const roomTitle = title && title.trim() ? title.trim() : randomTitles[Math.floor(Math.random() * randomTitles.length)];
  
  const mode = gameMode === 'turn' ? 'turn' : 'time';
  
  const hostPlayerId = playerId || `player_${Date.now()}`;
  const hostPlayerName = playerName || '방장';
  
  const roomData = {
      id: roomId,
      roomNumber,
      createdAt: now,
      title: roomTitle,
      gameMode: mode,
      players: [{
          id: hostPlayerId,
          name: hostPlayerName,
          score: 0,
          joinedAt: now
      }],
      maxPlayers: 5,
      acceptingPlayers: true,
      gameStarted: false,
      roundNumber: 0,
      scores: { [hostPlayerId]: 0 },
      lastSeen: { [hostPlayerId]: now }
  };
  
  await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
      metadata: {
          id: roomId,
          roomNumber,
          createdAt: now,
          playerCount: 1,
          gameStarted: false,
          roundNumber: 0,
          title: roomTitle,
          gameMode: mode
      }
  });
  
  try {
      const recentRooms = await env.ROOM_LIST.get('_recent_rooms', 'json') || [];
      recentRooms.push({ roomId, createdAt: now });
      const oneMinuteAgo = now - 60 * 1000;
      const filtered = recentRooms.filter(r => r.createdAt > oneMinuteAgo).slice(-20);
      await env.ROOM_LIST.put('_recent_rooms', JSON.stringify(filtered));
  } catch (e) {
      console.error('[create-room] recent rooms 업데이트 실패 (무시):', e);
  }
  
  return jsonResponse({ roomId });
}

async function handleJoinRoom(request, env) {
  const { roomId, playerId, playerName } = await request.json();
  if (!roomId || !playerId) {
      return jsonResponse({ error: 'Missing parameters' }, 400);
  }
  const roomData = await env.ROOM_LIST.get(roomId, 'json');
  if (!roomData) {
      return jsonResponse({ error: 'Room not found' }, 404);
  }
  if (roomData.players.length >= 5) {
      return jsonResponse({ error: 'Room is full' }, 400);
  }
  if (playerName) {
      const duplicateName = roomData.players.find(p => 
          p.name && p.name.toLowerCase() === playerName.toLowerCase() && p.id !== playerId
      );
      if (duplicateName) {
          return jsonResponse({ 
              error: 'DUPLICATE_NAME',
              message: '이미 같은 닉네임이 있습니다. 다른 이름으로 변경해주세요.' 
          }, 400);
      }
  }
  const existingPlayer = roomData.players.find(p => p.id === playerId);
  if (!existingPlayer) {
      roomData.players.push({
          id: playerId,
          name: playerName || `플레이어${roomData.players.length + 1}`,
          score: 0,
          joinedAt: Date.now()
      });
      roomData.scores = roomData.scores || {};
      roomData.scores[playerId] = 0;
      await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
          metadata: {
              id: roomId,
              roomNumber: roomData.roomNumber || 0,
              createdAt: roomData.createdAt,
              playerCount: roomData.players.length,
              gameStarted: roomData.gameStarted || false,
              roundNumber: roomData.roundNumber || 0,
              title: roomData.title || '초성 배틀방',
              gameMode: roomData.gameMode || 'time'
          }
      });
  } else {
      if (roomData.gameMode === 'turn' && roomData.gameStarted) {
          try {
              if (env.GAME_STATE) {
                  const id = env.GAME_STATE.idFromName(roomId);
                  const stub = env.GAME_STATE.get(id);
                  const stateRequest = new Request(`http://dummy/game-state?roomId=${roomId}`, {
                      method: 'GET'
                  });
                  const stateResponse = await stub.fetch(stateRequest);
                  if (stateResponse.ok) {
                      const doState = await stateResponse.json();
                      if (doState.eliminatedPlayers && doState.eliminatedPlayers.includes(playerId)) {
                          const rejoinRequest = new Request(`http://dummy/game-state?roomId=${roomId}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  action: 'player_rejoin',
                                  playerId: playerId
                              })
                          });
                          await stub.fetch(rejoinRequest);
                          console.log(`[join-room] 탈락자 ${playerId} 재입장 - eliminatedPlayers에 다시 추가`);
                      }
                  }
              }
          } catch (e) {
              console.error('[join-room] 탈락자 재입장 처리 실패 (무시):', e);
          }
      }
      
      existingPlayer.name = playerName || existingPlayer.name;
      existingPlayer.joinedAt = Date.now();
      
      await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
          metadata: {
              id: roomId,
              roomNumber: roomData.roomNumber || 0,
              createdAt: roomData.createdAt,
              playerCount: roomData.players.length,
              gameStarted: roomData.gameStarted || false,
              roundNumber: roomData.roundNumber || 0,
              title: roomData.title || '초성 배틀방',
              gameMode: roomData.gameMode || 'time'
          }
      });
  }
  return jsonResponse({ success: true, roomData });
}

async function handleLeaveRoom(request, env) {
  const { roomId, playerId } = await request.json();
  if (!roomId || !playerId) {
      return jsonResponse({ error: 'Missing parameters' }, 400);
  }
  const roomData = await env.ROOM_LIST.get(roomId, 'json');
  if (!roomData) {
      return jsonResponse({ error: 'Room not found' }, 404);
  }
  const wasHost = roomData.players.length > 0 && roomData.players[0].id === playerId;
  let newHostId = null;
  roomData.players = roomData.players.filter(p => p.id !== playerId);
  if (roomData.scores) delete roomData.scores[playerId];
  if (roomData.playerWords) delete roomData.playerWords[playerId];
  if (wasHost && roomData.players.length > 0) {
      newHostId = roomData.players[0].id;
      roomData.hostId = newHostId;
  }
  
  if (roomData.players.length === 0) {
      try {
          await env.ROOM_LIST.delete(roomId);
          try {
              const recentRooms = await env.ROOM_LIST.get('_recent_rooms', 'json') || [];
              const filtered = recentRooms.filter(r => r.roomId !== roomId);
              if (filtered.length !== recentRooms.length) {
                  await env.ROOM_LIST.put('_recent_rooms', JSON.stringify(filtered));
              }
          } catch (e) {
              console.error('[leave-room] recent_rooms 정리 실패 (무시):', e);
          }
      } catch (e) {
          console.error('[leave-room] 마지막 플레이어 퇴장 시 방 삭제 실패:', e);
          await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
              metadata: {
                  id: roomId,
                  roomNumber: roomData.roomNumber || 0,
                  createdAt: roomData.createdAt,
                  playerCount: roomData.players.length,
                  gameStarted: roomData.gameStarted || false,
                  roundNumber: roomData.roundNumber || 0,
                  title: roomData.title || '초성 배틀방',
                  gameMode: roomData.gameMode || 'time'
              }
          });
      }
  } else {
      await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
          metadata: {
              id: roomId,
              roomNumber: roomData.roomNumber || 0,
              createdAt: roomData.createdAt,
              playerCount: roomData.players.length,
              gameStarted: roomData.gameStarted || false,
              roundNumber: roomData.roundNumber || 0,
              title: roomData.title || '초성 배틀방',
              gameMode: roomData.gameMode || 'time'
          }
      });
  }
  
  return jsonResponse({ 
      success: true, 
      remainingPlayers: roomData.players.length,
      newHostId: newHostId
  });
}

async function handleGameState(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const pingPlayerId = url.searchParams.get('playerId') || null;
  if (!roomId) {
      return jsonResponse({ error: 'roomId is required' }, 400);
  }
  if (request.method === 'GET') {
      const roomData = await env.ROOM_LIST.get(roomId, 'json');
      if (!roomData) {
          return jsonResponse({ error: 'Room not found' }, 404);
      }
      const now = Date.now();
      if (pingPlayerId) {
          if (!roomData.lastSeen) roomData.lastSeen = {};
          roomData.lastSeen[pingPlayerId] = now;
          try {
              await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
                  metadata: {
                      id: roomId,
                      createdAt: roomData.createdAt,
                      playerCount: roomData.players?.length || 0,
                      gameStarted: roomData.gameStarted || false,
                      roundNumber: roomData.roundNumber || 0,
                      title: roomData.title || '초성 배틀방',
                      gameMode: roomData.gameMode || 'time'
                  }
              });
          } catch (e) {
              console.error('[game-state] lastSeen 업데이트 실패 (무시):', e);
          }
      }
      let doState = null;
      
      if (env.GAME_STATE) {
          try {
              const id = env.GAME_STATE.idFromName(roomId);
              const stub = env.GAME_STATE.get(id);
              const doResponse = await stub.fetch(request);
              
              if (doResponse.ok) {
                  doState = await doResponse.json();
              }
          } catch (error) {
              console.error(`[game-state] DO 에러 (무시하고 KV 데이터 사용):`, error);
          }
      }
      
      if (!doState) {
          doState = {
              id: roomId,
              createdAt: roomData.createdAt,
              roomNumber: roomData.roomNumber || null,
              gameStarted: roomData.gameStarted || false,
              startTime: null,
              endTime: null,
              timeLeft: 180,
              consonants: [],
              scores: roomData.scores || {},
              playerWords: roomData.playerWords || {},
              roundNumber: roomData.roundNumber || 0,
              lastUpdate: null,
              chatMessages: []
          };
      }
      
      doState.players = roomData.players || [];
      doState.maxPlayers = roomData.maxPlayers || 5;
      doState.acceptingPlayers = roomData.acceptingPlayers !== false;
      doState.createdAt = roomData.createdAt;
      doState.roomNumber = roomData.roomNumber || doState.roomNumber || null;
      doState.title = roomData.title || '초성 배틀방';
      doState.gameMode = roomData.gameMode || 'time';
      
      if (doState.gameMode === 'turn') {
          doState.currentTurnPlayerId = doState.currentTurnPlayerId || null;
          doState.turnStartTime = doState.turnStartTime || null;
          doState.playerLives = doState.playerLives || {};
          doState.eliminatedPlayers = doState.eliminatedPlayers || [];
          if (doState.usedWords && Array.isArray(doState.usedWords)) {
              doState.usedWords = doState.usedWords.slice(-100);
          } else {
              doState.usedWords = [];
          }
          doState.turnCount = doState.turnCount || {};
          doState.isFirstTurn = doState.isFirstTurn !== undefined ? doState.isFirstTurn : true;
      } else {
          doState.usedWords = [];
          if (doState.playerWords) {
              for (const playerId in doState.playerWords) {
                  const words = doState.playerWords[playerId];
                  if (Array.isArray(words)) {
                      for (const wordObj of words) {
                          if (wordObj && wordObj.word) {
                              doState.usedWords.push(wordObj.word);
                          }
                      }
                  }
              }
          }
      }
      
      if (!doState.scores || Object.keys(doState.scores).length === 0) {
          if (roomData.scores) {
              doState.scores = roomData.scores;
          }
      } else {
          if (roomData.scores) {
              doState.scores = { ...roomData.scores, ...doState.scores };
          }
      }
      if (!doState.playerWords || Object.keys(doState.playerWords).length === 0) {
          if (roomData.playerWords) {
              doState.playerWords = roomData.playerWords;
          }
      } else {
          if (roomData.playerWords) {
              doState.playerWords = { ...roomData.playerWords, ...doState.playerWords };
          }
      }
      
      if (!doState.chatMessages || !Array.isArray(doState.chatMessages)) {
          doState.chatMessages = [];
      }
      
      if (!doState.players || !Array.isArray(doState.players)) {
          doState.players = [];
      }
      
      console.log(`[game-state] GET ${roomId}: players=${doState.players.length}, gameStarted=${doState.gameStarted}, chatMessages=${doState.chatMessages.length}`);
      
      return jsonResponse(doState);
  }
  
  if (!env.GAME_STATE) {
      return jsonResponse({ error: 'Durable Object binding GAME_STATE missing' }, 500);
  }
  
  let updateBody = null;
  if (request.method === 'POST') {
      const clonedRequest = request.clone();
      updateBody = await clonedRequest.json();
  }
  
  const id = env.GAME_STATE.idFromName(roomId);
  const stub = env.GAME_STATE.get(id);
  const doResponse = await stub.fetch(request);
  
  if (request.method === 'POST' && updateBody && updateBody.action) {
      try {
          const roomData = await env.ROOM_LIST.get(roomId, 'json');
          if (roomData) {
              if (updateBody.action === 'new_game') {
                  roomData.gameStarted = true;
                  roomData.roundNumber = (roomData.roundNumber || 0) + 1;
                  roomData.scores = {};
                  roomData.playerWords = {};
              } else if (updateBody.action === 'start_game') {
                  roomData.gameStarted = true;
                  roomData.roundNumber = (roomData.roundNumber || 0) + 1;
              } else if (updateBody.action === 'end_game') {
                  roomData.gameStarted = false;
              }
              
              await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
                  metadata: {
                      id: roomId,
                      createdAt: roomData.createdAt,
                      playerCount: roomData.players?.length || 0,
                      gameStarted: roomData.gameStarted || false,
                      roundNumber: roomData.roundNumber || 0
                  }
              });
          }
      } catch (error) {
          console.error(`[game-state] KV 업데이트 실패 (무시):`, error);
      }
  }
  
  return doResponse;
}

async function handleChat(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  
  if (!roomId) {
      return jsonResponse({ error: 'roomId is required' }, 400);
  }
  if (!env.GAME_STATE) {
      return jsonResponse({ error: 'Durable Object binding GAME_STATE missing' }, 500);
  }
  const id = env.GAME_STATE.idFromName(roomId);
  const stub = env.GAME_STATE.get(id);
  if (request.method === 'POST') {
      const { playerName, message } = await request.json();
      
      if (!playerName || !message) {
          return jsonResponse({ error: 'Missing playerName or message' }, 400);
      }
      const chatRequest = new Request(`http://dummy/game-state?roomId=${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              chatMessage: message,
              playerId: url.searchParams.get('playerId') || 'unknown',
              playerName: playerName
          })
      });
      
      const response = await stub.fetch(chatRequest);
      return response;
  }
  if (request.method === 'GET') {
      const stateRequest = new Request(`http://dummy/game-state?roomId=${roomId}`, {
          method: 'GET'
      });
      const stateResponse = await stub.fetch(stateRequest);
      const state = await stateResponse.json();
      
      return jsonResponse(state.chatMessages || []);
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ============================================
// v15 - handleValidateWord 함수 (최신 버전)
// ============================================
async function handleValidateWord(request, env) {
    const FILE_VERSION = '2025-12-06-WORKER-v15-FORCE-DEPLOY';
    console.log('[handleValidateWord-v15] 실행됨', FILE_VERSION);
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Expose-Headers': 'X-Cache, X-Source, X-Response-Time, X-KV-Time',
        'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { word } = await request.json();
        const trimmedWord = word.trim();
        const cacheKey = `word:${trimmedWord}`;
        
        const kvBinding = env.WORD_CACHE_NEW;
        
        if (kvBinding) {
            const kvStartTime = performance.now();
            
            try {
                const kvData = await kvBinding.get(cacheKey, 'json');
                const kvTime = performance.now() - kvStartTime;
                
                if (kvData && kvData.word && kvData.definition) {
                    const kvTimeRounded = Math.round(kvTime);
                    const result = {
                        valid: true,
                        source: 'KV_DICTIONARY',
                        word: kvData.word,
                        definitions: [{
                            definition: kvData.definition,
                            pos: '',
                            source: 'KV_DICTIONARY'
                        }],
                        length: kvData.word.length,
                        _kvTime: Math.round(kvTime * 100) / 100,
                        _fileVersion: FILE_VERSION
                    };
                    
                    const responseHeaders = new Headers(corsHeaders);
                    responseHeaders.set('X-Cache', 'HIT');
                    responseHeaders.set('X-Source', 'KV_DICTIONARY');
                    responseHeaders.set('X-Response-Time', `${kvTimeRounded}ms`);
                    responseHeaders.set('X-KV-Time', `${kvTimeRounded}ms`);
                    
                    return new Response(JSON.stringify(result), { 
                        status: 200, 
                        headers: responseHeaders
                    });
                }
            } catch (error) {
                // KV 읽기 실패 시 조용히 API로 폴백
            }
        }

        const apiUrl = new URL('https://stdict.korean.go.kr/api/search.do');
        apiUrl.searchParams.append('key', 'C670DD254FE59C25E23DC785BA2AAAFE');
        apiUrl.searchParams.append('q', trimmedWord);
        apiUrl.searchParams.append('req_type', 'xml');

        const response = await fetch(apiUrl.toString());
        const xmlText = await response.text();

        const totalMatch = xmlText.match(/<total>(\d+)<\/total>/);
        const total = totalMatch ? parseInt(totalMatch[1]) : 0;

        let result;
        
        if (total === 0) {
            result = {
                valid: false,
                error: '사전에 없는 단어입니다.',
                word: trimmedWord,
                definitions: [],
                length: trimmedWord.length,
                _fileVersion: FILE_VERSION
            };
        } else {
            let definition = '';
            
            let defMatch = xmlText.match(/<definition>([^<]+)<\/definition>/);
            if (!defMatch) {
                defMatch = xmlText.match(/<definition><!\[CDATA\[([^\]]+)\]\]><\/definition>/);
            }
            if (!defMatch) {
                defMatch = xmlText.match(/<definition>([\s\S]*?)<\/definition>/);
            }

            if (defMatch) {
                definition = defMatch[1]
                    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
                    .replace(/<[^>]*>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            const posMatch = xmlText.match(/<pos>([^<]+)<\/pos>/);
            const pos = posMatch ? posMatch[1].trim() : '';

            if (!definition) {
                definition = '✅ 사전 등재 단어';
            }

            if (definition.length > 80) {
                definition = definition.substring(0, 77) + '...';
            }

            result = {
                valid: true,
                source: '표준국어대사전',
                word: trimmedWord,
                definitions: [{
                    definition: definition,
                    pos: pos,
                    source: '표준국어대사전'
                }],
                length: trimmedWord.length,
                _fileVersion: FILE_VERSION
            };
        }
        
        if (kvBinding && result.valid) {
            try {
                const kvValue = {
                    word: trimmedWord,
                    definition: result.definitions[0]?.definition || '✅ 사전 등재 단어'
                };
                await kvBinding.put(cacheKey, JSON.stringify(kvValue), {
                    expirationTtl: 30 * 24 * 60 * 60
                });
            } catch (cacheError) {
                // 캐시 저장 실패해도 결과는 반환
            }
        }

        return new Response(JSON.stringify(result), { 
            status: 200, 
            headers: {
                ...corsHeaders,
                'X-Cache': 'MISS',
                'X-Source': 'API',
                'X-Response-Time': 'API_CALL'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            valid: false,
            error: '사전 검색 중 오류',
            message: error.message
        }), { status: 500, headers: corsHeaders });
    }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

export default {
  async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const WORKER_CODE_VERSION = 'WORKER-v15-FORCE-DEPLOY-2025-12-06-17:30';
      const FILE_VERSION = '2025-12-06-WORKER-v15-FORCE-DEPLOY';
      
      const baseHeaders = {
          'X-Worker-Version': WORKER_CODE_VERSION,
          'X-Worker-Executed': 'YES-v15',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
      };
      
      if (url.pathname === '/test-worker') {
          return new Response(JSON.stringify({
              message: 'Worker 실행됨!',
              version: WORKER_CODE_VERSION,
              timestamp: new Date().toISOString(),
              url: request.url,
              envKeys: Object.keys(env || {}),
              hasWordCacheNew: !!env.WORD_CACHE_NEW,
              wordCacheNewType: typeof env.WORD_CACHE_NEW
          }), {
              headers: { 
                  'Content-Type': 'application/json', 
                  ...baseHeaders
              }
          });
      }
      
      if (request.method === 'OPTIONS') {
          return new Response(null, { 
              headers: baseHeaders
          });
      }

      if (url.pathname === '/api/rooms' && request.method === 'GET') {
          return handleRooms(env);
      }

      if (url.pathname === '/api/create-room' && request.method === 'POST') {
          return handleCreateRoom(request, env);
      }

      if (url.pathname === '/api/join-room' && request.method === 'POST') {
          return handleJoinRoom(request, env);
      }

      if (url.pathname === '/api/leave-room' && request.method === 'POST') {
          return handleLeaveRoom(request, env);
      }

      if (url.pathname === '/api/game-state') {
          return handleGameState(request, env); 
      }

      if (url.pathname === '/api/validate-word' && request.method === 'POST') {
          return handleValidateWord(request, env);
      }

      if (url.pathname === '/api/chat') {
          return handleChat(request, env);
      }

      if (env.ASSETS) {
          return env.ASSETS.fetch(request);
      }
      
      return new Response('Not Found', { status: 404 });
  }
};

