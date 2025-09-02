import { verify } from 'hono/jwt';
import { upgradeWebSocket } from 'hono/bun';

const connections = new Map<string, Set<WebSocket>>();

export const register = (adminId: string, ws: WebSocket) => {
  let set = connections.get(adminId);
  if (!set) {
    set = new Set();
    connections.set(adminId, set);
  }
  set.add(ws);
  ws.addEventListener('close', () => {
    set?.delete(ws);
    if (set && set.size === 0) connections.delete(adminId);
  });
};

export const sendToAdmins = async (adminIds: (string | undefined | null)[], payload: any) => {
  for (const id of adminIds) {
    if (!id) continue;
    const set = connections.get(id);
    if (!set) continue;
    for (const ws of set) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {}
    }
  }
};

export const chatWebSocketHandler = upgradeWebSocket((c) => {
  // Accept token via Authorization header or ?token=
  const auth = c.req.header('Authorization');
  let token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) {
    const urlToken = new URL(c.req.url).searchParams.get('token');
    if (urlToken) token = urlToken;
  }
  const secret = process.env.JWT_SECRET || 'your-secret-key';

  return {
    onOpen: async (evt, ws) => {
      try {
        if (!token) {
          ws.close();
          return;
        }
        const decoded: any = await verify(token!, secret);
        const adminId = decoded?.adminId;
        if (!adminId) {
          ws.close();
          return;
        }
        register(String(adminId), ws);
      } catch {
        try { ws.close(); } catch {}
      }
    },
    onMessage: (evt, ws) => {
      try {
        const data = JSON.parse(String(evt.data || '{}'));
        if (data?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    },
  };
});

