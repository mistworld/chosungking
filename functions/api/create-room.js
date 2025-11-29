import { getRoomList } from './kv-fallback.js';

export async function onRequest(context) {
    const ROOM_LIST = getRoomList(context.env);

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (context.request.method !== 'POST') {
        return new Response('Method not allowed', { 
            status: 405,
            headers: corsHeaders 
        });
    }

    try {
        const { title, gameMode, playerId, playerName } = await context.request.json().catch(() => ({}));
        const now = Date.now();

        // 🆕 방번호: 기존 방들의 최대 roomNumber를 찾아 +1 (1,2,3,... 순차 부여)
        let roomNumber = 1;
        try {
            const existing = await ROOM_LIST.list({ limit: 1000 });
            let maxNum = 0;
            for (const key of existing.keys) {
                const meta = key.metadata;
                if (meta && typeof meta.roomNumber === 'number' && meta.roomNumber > maxNum) {
                    maxNum = meta.roomNumber;
                }
            }
            roomNumber = maxNum + 1;
        } catch (e) {
            console.error('[create-room] roomNumber 계산 실패, 1부터 시작:', e);
            roomNumber = 1;
        }

        const roomId = generateRoomCode();
        
        // 랜덤 제목 목록
        const randomTitles = [
            "초성 배틀방",
            "빠른 대결",
            "도전! 초성왕",
            "친구들과 한판",
            "단어 천재 모여라"
        ];
        
        // 제목이 없으면 랜덤 선택
        const roomTitle = title && title.trim() ? title.trim() : randomTitles[Math.floor(Math.random() * randomTitles.length)];
        
        // 게임 모드 (기본값: time)
        const mode = gameMode === 'turn' ? 'turn' : 'time';
        
        // 방장 플레이어 정보 (방 생성 시 자동 입장)
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
            gameStarted: false,  // 명시적으로 false 설정
            roundNumber: 0,       // 🆕 라운드 번호 (0: 대기, 1: 1판, 2: 2판...)
            scores: { [hostPlayerId]: 0 }  // 방장 점수 초기화
        };

        // 방 생성 시 즉시 metadata 설정 (가짜방 방지)
        // 방장이 자동으로 입장하므로 playerCount: 1
        await ROOM_LIST.put(roomId, JSON.stringify(roomData), {
            metadata: {
                id: roomId,
                roomNumber,
                createdAt: now,
                playerCount: 1,  // 방장 자동 입장으로 1
                gameStarted: false,
                roundNumber: 0,
                title: roomTitle,
                gameMode: mode
            }
        });

        return new Response(JSON.stringify({ roomId }), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
            }
        });
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
