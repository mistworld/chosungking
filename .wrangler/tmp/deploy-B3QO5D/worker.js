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
      await this.state.storage.deleteAlarm();
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
        chatMessages: []
        // 채팅 메시지 배열 추가
      };
      await this.persistState(snapshot);
    }
    if (!snapshot.chatMessages) {
      snapshot.chatMessages = [];
    }
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
    for (const key of list.keys) {
      try {
        const meta = key.metadata;
        if (meta && meta.id) {
          if (seenIds.has(meta.id)) {
            continue;
          }
          seenIds.add(meta.id);
          const playerCount = meta.playerCount || 0;
          if (now - meta.createdAt < ONE_HOUR && playerCount > 0) {
            rooms.push({
              id: meta.id,
              createdAt: meta.createdAt,
              playerCount,
              maxPlayers: 5,
              players: [],
              // 클라이언트 호환성
              gameStarted: meta.gameStarted || false
              // 게임 진행 중 여부
            });
          }
        } else {
          console.log(`metadata \uC5C6\uB294 \uBC29 \uBC1C\uACAC: ${key.name}`);
          const roomData = await env.ROOM_LIST.get(key.name, "json");
          const playerCount = roomData?.players?.length || 0;
          if (roomData && now - roomData.createdAt < ONE_HOUR && playerCount > 0) {
            const roomId = roomData.id || key.name;
            if (seenIds.has(roomId)) {
              continue;
            }
            seenIds.add(roomId);
            rooms.push({
              id: roomId,
              createdAt: roomData.createdAt,
              playerCount,
              maxPlayers: 5,
              players: [],
              gameStarted: roomData.gameStarted || false
              // 게임 진행 중 여부
            });
            await env.ROOM_LIST.put(key.name, JSON.stringify(roomData), {
              metadata: {
                id: roomId,
                createdAt: roomData.createdAt,
                playerCount: roomData.players?.length || 0,
                gameStarted: roomData.gameStarted || false,
                roundNumber: roomData.roundNumber || 0
              }
            });
          }
        }
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
async function handleCreateRoom(env) {
  const roomId = generateRoomCode();
  const now = Date.now();
  const roomData = {
    id: roomId,
    createdAt: now,
    players: [],
    maxPlayers: 5,
    acceptingPlayers: true,
    gameStarted: false,
    roundNumber: 0
  };
  await env.ROOM_LIST.put(roomId, JSON.stringify(roomData), {
    metadata: {
      id: roomId,
      createdAt: now,
      playerCount: 0,
      gameStarted: false,
      roundNumber: 0
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
        createdAt: roomData.createdAt,
        playerCount: roomData.players.length,
        gameStarted: roomData.gameStarted || false,
        roundNumber: roomData.roundNumber || 0
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
      createdAt: roomData.createdAt,
      playerCount: roomData.players.length,
      gameStarted: roomData.gameStarted || false,
      roundNumber: roomData.roundNumber || 0
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
  if (!roomId) {
    return jsonResponse({ error: "roomId is required" }, 400);
  }
  if (request.method === "GET") {
    const roomData = await env.ROOM_LIST.get(roomId, "json");
    if (!roomData) {
      return jsonResponse({ error: "Room not found" }, 404);
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
async function handleValidateWord(request) {
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
    const apiUrl = new URL("https://stdict.korean.go.kr/api/search.do");
    apiUrl.searchParams.append("key", "C670DD254FE59C25E23DC785BA2AAAFE");
    apiUrl.searchParams.append("q", trimmedWord);
    apiUrl.searchParams.append("req_type", "xml");
    const response = await fetch(apiUrl.toString());
    const xmlText = await response.text();
    const totalMatch = xmlText.match(/<total>(\d+)<\/total>/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    if (total === 0) {
      return new Response(JSON.stringify({
        valid: false,
        error: "\uC0AC\uC804\uC5D0 \uC5C6\uB294 \uB2E8\uC5B4\uC785\uB2C8\uB2E4.",
        word: trimmedWord,
        definitions: [],
        length: trimmedWord.length
      }), { status: 200, headers: corsHeaders3 });
    }
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
    return new Response(JSON.stringify({
      valid: true,
      source: "\uD45C\uC900\uAD6D\uC5B4\uB300\uC0AC\uC804",
      word: trimmedWord,
      definitions: [{
        definition,
        pos,
        source: "\uD45C\uC900\uAD6D\uC5B4\uB300\uC0AC\uC804"
      }],
      length: trimmedWord.length
    }), { status: 200, headers: corsHeaders3 });
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
      return handleCreateRoom(env);
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
      return handleValidateWord(request);
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
export {
  GameStateRoom,
  worker_default as default
};
//# sourceMappingURL=worker.js.map
