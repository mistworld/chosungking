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
        const { roomId, playerId } = await context.request.json();

        if (!roomId || !playerId) {
            return new Response(JSON.stringify({ error: 'Missing parameters' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const roomData = await ROOM_LIST.get(roomId, 'json');

        if (!roomData) {
            return new Response(JSON.stringify({ error: 'Room not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 방장인지 확인 (첫 번째 플레이어가 방장)
        const wasHost = roomData.players.length > 0 && roomData.players[0].id === playerId;
        let newHostId = null;

        // 플레이어 제거
        roomData.players = roomData.players.filter(p => p.id !== playerId);
        
        // 점수 데이터도 제거
        if (roomData.scores && roomData.scores[playerId]) {
            delete roomData.scores[playerId];
        }
        if (roomData.playerWords && roomData.playerWords[playerId]) {
            delete roomData.playerWords[playerId];
        }

        // 방장이 나갔다면 새 방장 지정 (남은 플레이어 중 첫 번째)
        if (wasHost && roomData.players.length > 0) {
            newHostId = roomData.players[0].id;
            // 방장 정보를 명시적으로 저장 (선택사항)
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
                title: roomData.title || '초성 배틀방',
                gameMode: roomData.gameMode || 'time'
            }
        });

        return new Response(JSON.stringify({ 
            success: true,
            remainingPlayers: roomData.players.length,
            newHostId: newHostId
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
