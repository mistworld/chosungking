import { onRequest as __api_create_room_js_onRequest } from "C:\\Users\\김현희윈도우\\Downloads\\1126 거의완벽 대기방오류 점수팝업안됨\\functions\\api\\create-room.js"
import { onRequest as __api_game_state_js_onRequest } from "C:\\Users\\김현희윈도우\\Downloads\\1126 거의완벽 대기방오류 점수팝업안됨\\functions\\api\\game-state.js"
import { onRequest as __api_join_room_js_onRequest } from "C:\\Users\\김현희윈도우\\Downloads\\1126 거의완벽 대기방오류 점수팝업안됨\\functions\\api\\join-room.js"
import { onRequest as __api_leave_room_js_onRequest } from "C:\\Users\\김현희윈도우\\Downloads\\1126 거의완벽 대기방오류 점수팝업안됨\\functions\\api\\leave-room.js"
import { onRequest as __api_rooms_js_onRequest } from "C:\\Users\\김현희윈도우\\Downloads\\1126 거의완벽 대기방오류 점수팝업안됨\\functions\\api\\rooms.js"
import { onRequest as __api_validate_word_js_onRequest } from "C:\\Users\\김현희윈도우\\Downloads\\1126 거의완벽 대기방오류 점수팝업안됨\\functions\\api\\validate-word.js"

export const routes = [
    {
      routePath: "/api/create-room",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_create_room_js_onRequest],
    },
  {
      routePath: "/api/game-state",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_game_state_js_onRequest],
    },
  {
      routePath: "/api/join-room",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_join_room_js_onRequest],
    },
  {
      routePath: "/api/leave-room",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_leave_room_js_onRequest],
    },
  {
      routePath: "/api/rooms",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_rooms_js_onRequest],
    },
  {
      routePath: "/api/validate-word",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_validate_word_js_onRequest],
    },
  ]