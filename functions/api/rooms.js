import { getRoomList } from './kv-fallback.js';

export async function onRequest(context) {
    const ROOM_LIST = getRoomList(context.env);

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 최대 100개 가져오기
        const rooms = await ROOM_LIST.list({ limit: 100 });
        console.log(`전체 방 개수: ${rooms.keys.length}`);
        
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;

        const activeRooms = [];
        const seenIds = new Set();

        // 1) KV 읽기를 병렬로 수행
        const roomPromises = rooms.keys.map(key => ROOM_LIST.get(key.name, 'json'));
        const roomDataArray = await Promise.all(roomPromises);
        
        // 2) 필터링 및 roomNumber 포함해서 응답 구성
        for (let i = 0; i < rooms.keys.length; i++) {
            const key = rooms.keys[i];
            try {
                const roomData = roomDataArray[i];

                if (!roomData) {
                    console.log(`roomData 없음, 키 제거 대상: ${key.name}`);
                    continue;
                }

                const createdAt = roomData.createdAt || now;
                const playerCount = Array.isArray(roomData.players) ? roomData.players.length : 0;
                const roomId = roomData.id || key.name;

                // 1시간 지난 방은 목록에서 제외
                if ((now - createdAt) >= ONE_HOUR) {
                    continue;
                }

                // 플레이어 0명이면 목록에서 제외
                if (playerCount <= 0) {
                    continue;
                }

                if (seenIds.has(roomId)) continue;
                seenIds.add(roomId);

                activeRooms.push({
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

        // 최신순 정렬
        activeRooms.sort((a, b) => b.createdAt - a.createdAt);
        
        console.log(`활성 방 개수: ${activeRooms.length}`);

        return new Response(JSON.stringify(activeRooms), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
            }
        });
    } catch (error) {
        console.error('rooms.js 에러:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
            }
        });
    }
}
