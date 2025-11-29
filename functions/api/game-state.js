const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(context.request.url);
    const roomId = url.searchParams.get('roomId');

    if (!roomId) {
        return new Response(JSON.stringify({ error: 'roomId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    if (!context.env.GAME_STATE) {
        return new Response(JSON.stringify({ error: 'Durable Object binding GAME_STATE missing' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    const id = context.env.GAME_STATE.idFromName(roomId);
    const stub = context.env.GAME_STATE.get(id);

    return stub.fetch(context.request);
}
