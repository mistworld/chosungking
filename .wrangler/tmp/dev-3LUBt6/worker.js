var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/game-state-do.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var GameStateRoom = class {
  static {
    __name(this, "GameStateRoom");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.roomStatePromise = null;
  }
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");
    if (!roomId) {
      return this.json({ error: "roomId is required" }, 400);
    }
    if (request.method === "GET") {
      const snapshot = await this.getState();
      if (!snapshot) {
        return this.json({ error: "Room not found" }, 404);
      }
      return this.json(snapshot);
    }
    if (request.method === "POST") {
      const body = await request.json();
      const updated = await this.state.blockConcurrencyWhile(
        () => this.applyUpdate(roomId, body)
      );
      return this.json(updated);
    }
    if (request.method === "DELETE") {
      await this.state.blockConcurrencyWhile(async () => {
        await this.state.storage.deleteAll();
        this.roomStatePromise = Promise.resolve(null);
      });
      return this.json({ success: true });
    }
    return this.json({ error: "Method not allowed" }, 405);
  }
  async alarm() {
    await this.state.storage.deleteAll();
    this.roomStatePromise = Promise.resolve(null);
  }
  async applyUpdate(roomId, update) {
    const state = await this.ensureState(roomId);
    const now = Date.now();
    if (update.playerId && update.score !== void 0) {
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
    if (update.action === "start_game") {
      state.gameStarted = true;
      state.startTime = now;
      state.timeLeft = 180;
      state.consonants = update.consonants || state.consonants || [];
      state.endTime = null;
      state.roundNumber += 1;
      if (update.gameMode === "turn") {
        state.gameMode = "turn";
        state.usedWords = [];
        state.playerLives = {};
        state.eliminatedPlayers = [];
        state.turnCount = {};
        state.isFirstTurn = true;
        const players = update.players || [];
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
    if (update.action === "new_game") {
      state.gameStarted = true;
      state.startTime = now;
      state.timeLeft = 180;
      state.consonants = update.consonants || [];
      state.endTime = null;
      state.scores = {};
      state.playerWords = {};
      state.roundNumber += 1;
      if (update.gameMode === "turn" || state.gameMode === "turn") {
        state.gameMode = "turn";
        state.usedWords = [];
        state.playerLives = {};
        state.eliminatedPlayers = [];
        state.turnCount = {};
        state.isFirstTurn = true;
        const players = update.players || state.players || [];
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
    if (update.action === "submit_word" && state.gameMode === "turn") {
      const { playerId, word, isValid, wordLength, hasSpecialConsonant } = update;
      if (playerId !== state.currentTurnPlayerId) {
        console.log(`[\uD134\uC81C] ${playerId}\uB294 \uD604\uC7AC \uD134\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uD604\uC7AC \uD134: ${state.currentTurnPlayerId}`);
        return state;
      }
      if (state.turnStartTime) {
        const turnTimeLimit = state.isFirstTurn ? 8e3 : 5e3;
        const elapsed = now - state.turnStartTime;
        if (elapsed >= turnTimeLimit) {
          console.log(`[\uD134\uC81C] ${playerId} \uC2DC\uAC04 \uCD08\uACFC (${elapsed}ms >= ${turnTimeLimit}ms). \uB2E8\uC5B4 \uAC70\uBD80`);
          if (!state.playerLives[playerId]) state.playerLives[playerId] = 0;
          state.playerLives[playerId] -= 1;
          if (state.playerLives[playerId] < 0) {
            if (!state.eliminatedPlayers.includes(playerId)) {
              state.eliminatedPlayers.push(playerId);
              console.log(`[\uD134\uC81C] ${playerId} \uD0C8\uB77D!`);
            }
            const activePlayers = (update.players || []).filter((p) => !state.eliminatedPlayers.includes(p.id));
            if (activePlayers.length <= 1) {
              state.gameStarted = false;
              state.endTime = now;
              return state;
            }
            await this.nextTurn(state, now, update.players || []);
          } else {
            state.turnStartTime = now;
            console.log(`[\uD134\uC81C] ${playerId} \uC5F0\uC7A5\uAD8C \uC0AC\uC6A9. \uB2E4\uC74C 5\uCD08 \uC2DC\uC791`);
          }
          return state;
        }
      }
      if (isValid) {
        const wordLower = word.toLowerCase();
        if (state.usedWords.includes(wordLower)) {
          console.log(`[\uD134\uC81C] \uC911\uBCF5 \uB2E8\uC5B4: ${wordLower}`);
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
        console.log(`[\uD134\uC81C] ${playerId}\uAC00 "${word}" \uB9DE\uCDA4. \uC5F0\uC7A5\uAD8C +${livesEarned}, \uD604\uC7AC: ${state.playerLives[playerId]}`);
        const players = update.players || state.players || [];
        await this.nextTurn(state, now, players);
      }
    }
    if (update.action === "turn_timeout" && state.gameMode === "turn") {
      const { playerId } = update;
      if (playerId === state.currentTurnPlayerId) {
        if (!state.playerLives[playerId]) state.playerLives[playerId] = 0;
        state.playerLives[playerId] -= 1;
        console.log(`[\uD134\uC81C] ${playerId} \uC2DC\uAC04 \uCD08\uACFC. \uC5F0\uC7A5\uAD8C -1, \uD604\uC7AC: ${state.playerLives[playerId]}`);
        if (state.playerLives[playerId] < 0) {
          if (!state.eliminatedPlayers.includes(playerId)) {
            state.eliminatedPlayers.push(playerId);
            console.log(`[\uD134\uC81C] ${playerId} \uD0C8\uB77D!`);
          }
          const activePlayers = (update.players || []).filter((p) => !state.eliminatedPlayers.includes(p.id));
          if (activePlayers.length <= 1) {
            state.gameStarted = false;
            state.endTime = now;
            return state;
          }
          await this.nextTurn(state, now, update.players || []);
        } else {
          state.turnStartTime = now;
          console.log(`[\uD134\uC81C] ${playerId} \uC5F0\uC7A5\uAD8C \uC0AC\uC6A9. \uB2E4\uC74C 5\uCD08 \uC2DC\uC791`);
        }
      }
    }
    if (update.action === "end_game") {
      state.gameStarted = false;
      state.endTime = now;
      await this.state.storage.setAlarm(now + 60 * 1e3);
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
        // 채팅 메시지 배열 추가
        // 🆕 턴제 모드 상태
        gameMode: "time",
        // 'time' or 'turn'
        currentTurnPlayerId: null,
        turnStartTime: null,
        playerLives: {},
        // { playerId: 연장권 개수 }
        eliminatedPlayers: [],
        // 탈락한 플레이어 ID 목록
        usedWords: [],
        // 전체 사용된 단어 목록 (중복 체크용)
        turnCount: {},
        // { playerId: 턴 횟수 }
        isFirstTurn: true
        // 첫 턴 여부 (8초 vs 5초)
      };
      await this.persistState(snapshot);
    }
    if (!snapshot.chatMessages) {
      snapshot.chatMessages = [];
    }
    if (!snapshot.gameMode) snapshot.gameMode = "time";
    if (!snapshot.playerLives) snapshot.playerLives = {};
    if (!snapshot.eliminatedPlayers) snapshot.eliminatedPlayers = [];
    if (!snapshot.usedWords) snapshot.usedWords = [];
    if (!snapshot.turnCount) snapshot.turnCount = {};
    if (snapshot.isFirstTurn === void 0) snapshot.isFirstTurn = true;
    return snapshot;
  }
  async getState() {
    if (!this.roomStatePromise) {
      this.roomStatePromise = this.state.storage.get("roomState");
    }
    return this.roomStatePromise;
  }
  async persistState(state) {
    this.roomStatePromise = Promise.resolve(state);
    await this.state.storage.put("roomState", state);
  }
  // 🆕 턴제 모드: 다음 턴으로 전환
  async nextTurn(state, now, players = []) {
    const playerList = players.length > 0 ? players : state.players || [];
    if (playerList.length === 0) {
      console.log("[\uD134\uC81C] nextTurn: players \uBC30\uC5F4\uC774 \uBE44\uC5B4\uC788\uC74C");
      return;
    }
    console.log("[\uD134\uC81C] nextTurn \uD638\uCD9C:", {
      currentTurn: state.currentTurnPlayerId,
      players: playerList.map((p) => p.id),
      eliminated: state.eliminatedPlayers
    });
    const activePlayers = playerList.filter((p) => !state.eliminatedPlayers.includes(p.id));
    if (activePlayers.length <= 1) {
      state.gameStarted = false;
      state.endTime = now;
      return;
    }
    const currentIndex = activePlayers.findIndex((p) => p.id === state.currentTurnPlayerId);
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
    if (state.playerLives[nextPlayer.id] === void 0) {
      state.playerLives[nextPlayer.id] = 0;
    }
    if (state.turnCount[nextPlayer.id] === void 0) {
      state.turnCount[nextPlayer.id] = 0;
    }
  }
  json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

// src/worker.js
var corsHeaders2 = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
async function handleRooms(env) {
  const corsHeadersWithCache = {
    ...corsHeaders2,
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
  try {
    if (!env.ROOM_LIST) {
      console.log("ROOM_LIST\uAC00 \uC5C6\uC74C!");
      return new Response(JSON.stringify([]), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeadersWithCache
        }
      });
    }
    const list = await env.ROOM_LIST.list({ limit: 100 });
    console.log(`\uC804\uCCB4 \uBC29 \uAC1C\uC218: ${list.keys.length}`);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1e3;
    const rooms = [];
    const seenIds = /* @__PURE__ */ new Set();
    const roomPromises = list.keys.map((key) => env.ROOM_LIST.get(key.name, "json"));
    const roomDataArray = await Promise.all(roomPromises);
    for (let i = 0; i < list.keys.length; i++) {
      const key = list.keys[i];
      try {
        const roomData = roomDataArray[i];
        if (!roomData) {
          console.log(`roomData \uC5C6\uC74C, \uD0A4 \uC81C\uAC70 \uB300\uC0C1: ${key.name}`);
          continue;
        }
        const createdAt = roomData.createdAt || now;
        const playerCount = Array.isArray(roomData.players) ? roomData.players.length : 0;
        const roomId = roomData.id || key.name;
        if (now - createdAt >= ONE_HOUR) {
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
          title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
          gameMode: roomData.gameMode || "time",
          playerCount,
          maxPlayers: roomData.maxPlayers || 5,
          players: [],
          // 클라이언트 호환성
          gameStarted: roomData.gameStarted || false
        });
      } catch (error) {
        console.error(`\uBC29 \uCC98\uB9AC \uC2E4\uD328 ${key.name}:`, error);
      }
    }
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    console.log(`\uD65C\uC131 \uBC29 \uAC1C\uC218: ${rooms.length}`);
    return new Response(JSON.stringify(rooms), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeadersWithCache
      }
    });
  } catch (error) {
    console.error("rooms.js \uC5D0\uB7EC:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeadersWithCache
      }
    });
  }
}
__name(handleRooms, "handleRooms");
async function handleCreateRoom(request, env) {
  const { title, gameMode, playerId, playerName } = await request.json().catch(() => ({}));
  const now = Date.now();
  let roomNumber = 1;
  try {
    const existing = await env.ROOM_LIST.list({ limit: 1e3 });
    let maxNum = 0;
    for (const key of existing.keys) {
      const meta = key.metadata;
      if (meta && typeof meta.roomNumber === "number" && meta.roomNumber > maxNum) {
        maxNum = meta.roomNumber;
      }
    }
    roomNumber = maxNum + 1;
  } catch (e) {
    console.error("[create-room] roomNumber \uACC4\uC0B0 \uC2E4\uD328, 1\uBD80\uD130 \uC2DC\uC791:", e);
    roomNumber = 1;
  }
  const roomId = generateRoomCode();
  const randomTitles = [
    "\uCD08\uC131 \uBC30\uD2C0\uBC29",
    "\uBE60\uB978 \uB300\uACB0",
    "\uB3C4\uC804! \uCD08\uC131\uC655",
    "\uCE5C\uAD6C\uB4E4\uACFC \uD55C\uD310",
    "\uB2E8\uC5B4 \uCC9C\uC7AC \uBAA8\uC5EC\uB77C"
  ];
  const roomTitle = title && title.trim() ? title.trim() : randomTitles[Math.floor(Math.random() * randomTitles.length)];
  const mode = gameMode === "turn" ? "turn" : "time";
  const hostPlayerId = playerId || `player_${Date.now()}`;
  const hostPlayerName = playerName || "\uBC29\uC7A5";
  const roomData = {
    id: roomId,
    roomNumber,
    createdAt: now,
    title: roomTitle,
    // 🆕 제목 추가
    gameMode: mode,
    // 🆕 게임 모드 추가
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
    scores: { [hostPlayerId]: 0 }
    // 방장 점수 초기화
  };
  await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
    metadata: {
      id: roomId,
      roomNumber,
      createdAt: now,
      playerCount: 1,
      // 방장 자동 입장으로 1
      gameStarted: false,
      roundNumber: 0,
      title: roomTitle,
      // 🆕 제목도 metadata에 저장
      gameMode: mode
      // 🆕 게임 모드도 metadata에 저장
    }
  });
  return jsonResponse({ roomId });
}
__name(handleCreateRoom, "handleCreateRoom");
async function handleJoinRoom(request, env) {
  const { roomId, playerId, playerName } = await request.json();
  if (!roomId || !playerId) {
    return jsonResponse({ error: "Missing parameters" }, 400);
  }
  const roomData = await env.ROOM_LIST.get(roomId, "json");
  if (!roomData) {
    return jsonResponse({ error: "Room not found" }, 404);
  }
  if (roomData.players.length >= 5) {
    return jsonResponse({ error: "Room is full" }, 400);
  }
  const existingPlayer = roomData.players.find((p) => p.id === playerId);
  if (!existingPlayer) {
    roomData.players.push({
      id: playerId,
      name: playerName || `\uD50C\uB808\uC774\uC5B4${roomData.players.length + 1}`,
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
        title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
        // 🆕 제목도 metadata에 저장
        gameMode: roomData.gameMode || "time"
        // 🆕 게임 모드도 metadata에 저장
      }
    });
  }
  return jsonResponse({ success: true, roomData });
}
__name(handleJoinRoom, "handleJoinRoom");
async function handleLeaveRoom(request, env) {
  const { roomId, playerId } = await request.json();
  if (!roomId || !playerId) {
    return jsonResponse({ error: "Missing parameters" }, 400);
  }
  const roomData = await env.ROOM_LIST.get(roomId, "json");
  if (!roomData) {
    return jsonResponse({ error: "Room not found" }, 404);
  }
  const wasHost = roomData.players.length > 0 && roomData.players[0].id === playerId;
  let newHostId = null;
  roomData.players = roomData.players.filter((p) => p.id !== playerId);
  if (roomData.scores) delete roomData.scores[playerId];
  if (roomData.playerWords) delete roomData.playerWords[playerId];
  if (wasHost && roomData.players.length > 0) {
    newHostId = roomData.players[0].id;
    roomData.hostId = newHostId;
  }
  await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
    metadata: {
      id: roomId,
      roomNumber: roomData.roomNumber || 0,
      createdAt: roomData.createdAt,
      playerCount: roomData.players.length,
      gameStarted: roomData.gameStarted || false,
      roundNumber: roomData.roundNumber || 0,
      title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
      // 🆕 제목도 metadata에 저장
      gameMode: roomData.gameMode || "time"
      // 🆕 게임 모드도 metadata에 저장
    }
  });
  return jsonResponse({
    success: true,
    remainingPlayers: roomData.players.length,
    newHostId
    // 새 방장 ID 반환
  });
}
__name(handleLeaveRoom, "handleLeaveRoom");
async function handleGameState(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId");
  const pingPlayerId = url.searchParams.get("playerId") || null;
  if (!roomId) {
    return jsonResponse({ error: "roomId is required" }, 400);
  }
  if (request.method === "GET") {
    const roomData = await env.ROOM_LIST.get(roomId, "json");
    if (!roomData) {
      return jsonResponse({ error: "Room not found" }, 404);
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
            title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
            gameMode: roomData.gameMode || "time"
          }
        });
      } catch (e) {
        console.error("[game-state] lastSeen \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uBB34\uC2DC):", e);
      }
    }
    let doState = null;
    if (env.GAME_STATE) {
      try {
        const id2 = env.GAME_STATE.idFromName(roomId);
        const stub2 = env.GAME_STATE.get(id2);
        const doResponse2 = await stub2.fetch(request);
        if (doResponse2.ok) {
          doState = await doResponse2.json();
        }
      } catch (error) {
        console.error(`[game-state] DO \uC5D0\uB7EC (\uBB34\uC2DC\uD558\uACE0 KV \uB370\uC774\uD130 \uC0AC\uC6A9):`, error);
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
        // 채팅 메시지 초기화
      };
    }
    doState.players = roomData.players || [];
    doState.maxPlayers = roomData.maxPlayers || 5;
    doState.acceptingPlayers = roomData.acceptingPlayers !== false;
    doState.createdAt = roomData.createdAt;
    doState.roomNumber = roomData.roomNumber || doState.roomNumber || null;
    doState.title = roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29";
    doState.gameMode = roomData.gameMode || "time";
    if (doState.gameMode === "turn") {
      doState.currentTurnPlayerId = doState.currentTurnPlayerId || null;
      doState.turnStartTime = doState.turnStartTime || null;
      doState.playerLives = doState.playerLives || {};
      doState.eliminatedPlayers = doState.eliminatedPlayers || [];
      doState.usedWords = doState.usedWords || [];
      doState.turnCount = doState.turnCount || {};
      doState.isFirstTurn = doState.isFirstTurn !== void 0 ? doState.isFirstTurn : true;
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
    return jsonResponse({ error: "Durable Object binding GAME_STATE missing" }, 500);
  }
  let updateBody = null;
  if (request.method === "POST") {
    const clonedRequest = request.clone();
    updateBody = await clonedRequest.json();
  }
  const id = env.GAME_STATE.idFromName(roomId);
  const stub = env.GAME_STATE.get(id);
  const doResponse = await stub.fetch(request);
  if (request.method === "POST" && updateBody && updateBody.action) {
    try {
      const roomData = await env.ROOM_LIST.get(roomId, "json");
      if (roomData) {
        if (updateBody.action === "new_game") {
          roomData.gameStarted = true;
          roomData.roundNumber = (roomData.roundNumber || 0) + 1;
          roomData.scores = {};
          roomData.playerWords = {};
        } else if (updateBody.action === "start_game") {
          roomData.gameStarted = true;
          roomData.roundNumber = (roomData.roundNumber || 0) + 1;
        } else if (updateBody.action === "end_game") {
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
      console.error(`[game-state] KV \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 (\uBB34\uC2DC):`, error);
    }
  }
  return doResponse;
}
__name(handleGameState, "handleGameState");
async function handleChat(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId");
  if (!roomId) {
    return jsonResponse({ error: "roomId is required" }, 400);
  }
  if (!env.GAME_STATE) {
    return jsonResponse({ error: "Durable Object binding GAME_STATE missing" }, 500);
  }
  const id = env.GAME_STATE.idFromName(roomId);
  const stub = env.GAME_STATE.get(id);
  if (request.method === "POST") {
    const { playerName, message } = await request.json();
    if (!playerName || !message) {
      return jsonResponse({ error: "Missing playerName or message" }, 400);
    }
    const chatRequest = new Request(`http://dummy/game-state?roomId=${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatMessage: message,
        playerId: url.searchParams.get("playerId") || "unknown",
        playerName
      })
    });
    const response = await stub.fetch(chatRequest);
    return response;
  }
  if (request.method === "GET") {
    const stateRequest = new Request(`http://dummy/game-state?roomId=${roomId}`, {
      method: "GET"
    });
    const stateResponse = await stub.fetch(stateRequest);
    const state = await stateResponse.json();
    return jsonResponse(state.chatMessages || []);
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}
__name(handleChat, "handleChat");
async function handleValidateWord(request, env) {
  const corsHeaders3 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders3 });
  }
  try {
    const { word } = await request.json();
    const trimmedWord = word.trim();
    if (env.WORD_CACHE) {
      const cacheKey = `word:${trimmedWord}`;
      const cached = await env.WORD_CACHE.get(cacheKey, "json");
      if (cached) {
        console.log(`[\uCE90\uC2DC \uD788\uD2B8] ${trimmedWord}`);
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: {
            ...corsHeaders3,
            "X-Cache": "HIT"
          }
        });
      }
    }
    const apiUrl = new URL("https://stdict.korean.go.kr/api/search.do");
    apiUrl.searchParams.append("key", "C670DD254FE59C25E23DC785BA2AAAFE");
    apiUrl.searchParams.append("q", trimmedWord);
    apiUrl.searchParams.append("req_type", "xml");
    const response = await fetch(apiUrl.toString());
    const xmlText = await response.text();
    const totalMatch = xmlText.match(/<total>(\d+)<\/total>/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    let result;
    if (total === 0) {
      result = {
        valid: false,
        error: "\uC0AC\uC804\uC5D0 \uC5C6\uB294 \uB2E8\uC5B4\uC785\uB2C8\uB2E4.",
        word: trimmedWord,
        definitions: [],
        length: trimmedWord.length
      };
    } else {
      let definition = "";
      let defMatch = xmlText.match(/<definition>([^<]+)<\/definition>/);
      if (!defMatch) {
        defMatch = xmlText.match(/<definition><!\[CDATA\[([^\]]+)\]\]><\/definition>/);
      }
      if (!defMatch) {
        defMatch = xmlText.match(/<definition>([\s\S]*?)<\/definition>/);
      }
      if (defMatch) {
        definition = defMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      }
      const posMatch = xmlText.match(/<pos>([^<]+)<\/pos>/);
      const pos = posMatch ? posMatch[1].trim() : "";
      if (!definition) {
        definition = "\u2705 \uC0AC\uC804 \uB4F1\uC7AC \uB2E8\uC5B4";
      }
      if (definition.length > 80) {
        definition = definition.substring(0, 77) + "...";
      }
      result = {
        valid: true,
        source: "\uD45C\uC900\uAD6D\uC5B4\uB300\uC0AC\uC804",
        word: trimmedWord,
        definitions: [{
          definition,
          pos,
          source: "\uD45C\uC900\uAD6D\uC5B4\uB300\uC0AC\uC804"
        }],
        length: trimmedWord.length
      };
    }
    if (env.WORD_CACHE) {
      const cacheKey = `word:${trimmedWord}`;
      try {
        await env.WORD_CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 30 * 24 * 60 * 60
          // 30일
        });
        console.log(`[\uCE90\uC2DC \uC800\uC7A5] ${trimmedWord}`);
      } catch (cacheError) {
        console.error(`[\uCE90\uC2DC \uC800\uC7A5 \uC2E4\uD328] ${trimmedWord}:`, cacheError);
      }
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders3,
        "X-Cache": "MISS"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      error: "\uC0AC\uC804 \uAC80\uC0C9 \uC911 \uC624\uB958",
      message: error.message
    }), { status: 500, headers: corsHeaders3 });
  }
}
__name(handleValidateWord, "handleValidateWord");
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
__name(generateRoomCode, "generateRoomCode");
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders2 }
  });
}
__name(jsonResponse, "jsonResponse");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders2 });
    }
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      return handleRooms(env);
    }
    if (url.pathname === "/api/create-room" && request.method === "POST") {
      return handleCreateRoom(request, env);
    }
    if (url.pathname === "/api/join-room" && request.method === "POST") {
      return handleJoinRoom(request, env);
    }
    if (url.pathname === "/api/leave-room" && request.method === "POST") {
      return handleLeaveRoom(request, env);
    }
    if (url.pathname === "/api/game-state") {
      return handleGameState(request, env);
    }
    if (url.pathname === "/api/validate-word" && request.method === "POST") {
      return handleValidateWord(request, env);
    }
    if (url.pathname === "/api/chat") {
      return handleChat(request, env);
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
};

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-s2EUUW/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-s2EUUW/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  GameStateRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
