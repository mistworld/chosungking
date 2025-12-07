// 최소한의 테스트 Worker - 이게 작동하는지 확인
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // API 라우트 테스트
        if (url.pathname === '/test') {
            return new Response(JSON.stringify({ 
                message: 'Worker is working!',
                pathname: url.pathname,
                hasAssets: !!env.ASSETS
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Assets 테스트
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }
        
        return new Response('No Assets binding found', { status: 500 });
    }
};



