var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/kv-fallback.js
var memoryStore = /* @__PURE__ */ new Map();
function getRoomList(env) {
  if (env && env.ROOM_LIST) {
    return env.ROOM_LIST;
  }
  console.log("[KV Fallback] Using in-memory ROOM_LIST (local dev only)");
  return {
    async list({ limit = 100 } = {}) {
      const entries = Array.from(memoryStore.entries()).slice(0, limit);
      return {
        keys: entries.map(([name, { metadata }]) => ({
          name,
          metadata: metadata || null
        }))
      };
    },
    async get(name, type) {
      const entry = memoryStore.get(name);
      if (!entry) return null;
      const value = entry.value;
      if (type === "json") return value;
      return JSON.stringify(value);
    },
    async put(name, value, options = {}) {
      const json = typeof value === "string" ? JSON.parse(value) : value;
      memoryStore.set(name, {
        value: json,
        metadata: options.metadata || null
      });
    },
    async delete(name) {
      memoryStore.delete(name);
    }
  };
}
__name(getRoomList, "getRoomList");

// api/create-room.js
async function onRequest(context) {
  const ROOM_LIST = getRoomList(context.env);
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2 });
  }
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders2
    });
  }
  try {
    const { title, gameMode, playerId, playerName } = await context.request.json().catch(() => ({}));
    const now = Date.now();
    let roomNumber = 1;
    try {
      const existing = await ROOM_LIST.list({ limit: 1e3 });
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
      // 명시적으로 false 설정
      roundNumber: 0,
      // 🆕 라운드 번호 (0: 대기, 1: 1판, 2: 2판...)
      scores: { [hostPlayerId]: 0 }
      // 방장 점수 초기화
    };
    await ROOM_LIST.put(roomId, JSON.stringify(roomData), {
      metadata: {
        id: roomId,
        roomNumber,
        createdAt: now,
        playerCount: 1,
        // 방장 자동 입장으로 1
        gameStarted: false,
        roundNumber: 0,
        title: roomTitle,
        gameMode: mode
      }
    });
    return new Response(JSON.stringify({ roomId }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders2
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders2
      }
    });
  }
}
__name(onRequest, "onRequest");
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
__name(generateRoomCode, "generateRoomCode");

// api/game-state.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
async function onRequest2(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const url = new URL(context.request.url);
  const roomId = url.searchParams.get("roomId");
  if (!roomId) {
    return new Response(JSON.stringify({ error: "roomId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  if (!context.env.GAME_STATE) {
    return new Response(JSON.stringify({ error: "Durable Object binding GAME_STATE missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  const id = context.env.GAME_STATE.idFromName(roomId);
  const stub = context.env.GAME_STATE.get(id);
  return stub.fetch(context.request);
}
__name(onRequest2, "onRequest");

// api/join-room.js
async function onRequest3(context) {
  const ROOM_LIST = getRoomList(context.env);
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2 });
  }
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders2
    });
  }
  try {
    const { roomId, playerId, playerName } = await context.request.json();
    if (!roomId || !playerId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders2 }
      });
    }
    const roomData = await ROOM_LIST.get(roomId, "json");
    if (!roomData) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders2 }
      });
    }
    if (roomData.players.length >= 5) {
      return new Response(JSON.stringify({ error: "Room is full" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders2 }
      });
    }
    const existingPlayer = roomData.players.find((p) => p.id === playerId);
    if (!existingPlayer) {
      roomData.players.push({
        id: playerId,
        name: playerName || `\uD50C\uB808\uC774\uC5B4${roomData.players.length + 1}`,
        score: 0,
        joinedAt: Date.now()
      });
      if (!roomData.scores) roomData.scores = {};
      roomData.scores[playerId] = 0;
      await ROOM_LIST.put(roomId, JSON.stringify(roomData), {
        metadata: {
          id: roomId,
          roomNumber: roomData.roomNumber || 0,
          createdAt: roomData.createdAt,
          playerCount: roomData.players.length,
          gameStarted: roomData.gameStarted || false,
          roundNumber: roomData.roundNumber || 0,
          title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
          gameMode: roomData.gameMode || "time"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      roomData
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders2 }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders2 }
    });
  }
}
__name(onRequest3, "onRequest");

// api/leave-room.js
async function onRequest4(context) {
  const ROOM_LIST = getRoomList(context.env);
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2 });
  }
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders2
    });
  }
  try {
    const { roomId, playerId } = await context.request.json();
    if (!roomId || !playerId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders2 }
      });
    }
    const roomData = await ROOM_LIST.get(roomId, "json");
    if (!roomData) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders2 }
      });
    }
    const wasHost = roomData.players.length > 0 && roomData.players[0].id === playerId;
    let newHostId = null;
    roomData.players = roomData.players.filter((p) => p.id !== playerId);
    if (roomData.scores && roomData.scores[playerId]) {
      delete roomData.scores[playerId];
    }
    if (roomData.playerWords && roomData.playerWords[playerId]) {
      delete roomData.playerWords[playerId];
    }
    if (wasHost && roomData.players.length > 0) {
      newHostId = roomData.players[0].id;
      roomData.hostId = newHostId;
    }
    await ROOM_LIST.put(roomId, JSON.stringify(roomData), {
      metadata: {
        id: roomId,
        roomNumber: roomData.roomNumber || 0,
        createdAt: roomData.createdAt,
        playerCount: roomData.players.length,
        gameStarted: roomData.gameStarted || false,
        roundNumber: roomData.roundNumber || 0,
        title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
        gameMode: roomData.gameMode || "time"
      }
    });
    return new Response(JSON.stringify({
      success: true,
      remainingPlayers: roomData.players.length,
      newHostId
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders2 }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders2 }
    });
  }
}
__name(onRequest4, "onRequest");

// api/rooms.js
async function onRequest5(context) {
  const ROOM_LIST = getRoomList(context.env);
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2 });
  }
  try {
    const rooms = await ROOM_LIST.list({ limit: 100 });
    console.log(`\uC804\uCCB4 \uBC29 \uAC1C\uC218: ${rooms.keys.length}`);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1e3;
    const activeRooms = [];
    const seenIds = /* @__PURE__ */ new Set();
    const roomPromises = rooms.keys.map((key) => ROOM_LIST.get(key.name, "json"));
    const roomDataArray = await Promise.all(roomPromises);
    for (let i = 0; i < rooms.keys.length; i++) {
      const key = rooms.keys[i];
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
        if (seenIds.has(roomId)) continue;
        seenIds.add(roomId);
        activeRooms.push({
          id: roomId,
          roomNumber: roomData.roomNumber || 0,
          createdAt,
          title: roomData.title || "\uCD08\uC131 \uBC30\uD2C0\uBC29",
          gameMode: roomData.gameMode || "time",
          playerCount,
          maxPlayers: roomData.maxPlayers || 5,
          players: [],
          gameStarted: roomData.gameStarted || false
        });
      } catch (error) {
        console.error(`\uBC29 \uCC98\uB9AC \uC2E4\uD328 ${key.name}:`, error);
      }
    }
    activeRooms.sort((a, b) => b.createdAt - a.createdAt);
    console.log(`\uD65C\uC131 \uBC29 \uAC1C\uC218: ${activeRooms.length}`);
    return new Response(JSON.stringify(activeRooms), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders2
      }
    });
  } catch (error) {
    console.error("rooms.js \uC5D0\uB7EC:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders2
      }
    });
  }
}
__name(onRequest5, "onRequest");

// api/validate-word.js
async function onRequest6(context) {
  const { request } = context;
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2 });
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
      }), { status: 200, headers: corsHeaders2 });
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
    }), { status: 200, headers: corsHeaders2 });
  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      error: "\uC0AC\uC804 \uAC80\uC0C9 \uC911 \uC624\uB958",
      message: error.message
    }), { status: 500, headers: corsHeaders2 });
  }
}
__name(onRequest6, "onRequest");

// ../.wrangler/tmp/pages-3m5XJS/functionsRoutes-0.5054983008001064.mjs
var routes = [
  {
    routePath: "/api/create-room",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/game-state",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/join-room",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/leave-room",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/rooms",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/api/validate-word",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest6]
  }
];

// ../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
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

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
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

// ../.wrangler/tmp/bundle-IwTqco/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
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

// ../.wrangler/tmp/bundle-IwTqco/middleware-loader.entry.ts
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
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.7092190514526968.mjs.map
