let memoryStore = new Map();

/**
 * ROOM_LIST KV가 없는 로컬 Pages dev 환경에서만
 * 메모리 기반으로 대신 동작하게 해주는 헬퍼.
 * 실제 배포 환경에서는 env.ROOM_LIST를 그대로 사용한다.
 */
export function getRoomList(env) {
    if (env && env.ROOM_LIST) {
        return env.ROOM_LIST;
    }

    console.log('[KV Fallback] Using in-memory ROOM_LIST (local dev only)');

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
            if (type === 'json') return value;
            return JSON.stringify(value);
        },
        async put(name, value, options = {}) {
            const json = typeof value === 'string' ? JSON.parse(value) : value;
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


