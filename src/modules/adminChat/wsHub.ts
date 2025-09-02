import { verify } from 'hono/jwt';
import { websocket } from 'hono/websocket';
import type { WSContext } from 'hono/ws';

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

export const chatWebSocketHandler = websocket(async (ws, c: WSContext) => {
  try {
    // Accept token via Authorization header or ?token=
    const auth = c.req.raw.headers.get('Authorization');
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) {
      const urlToken = new URL(c.req.url).searchParams.get('token');
      if (urlToken) token = urlToken;
    }
    if (!token) {
      ws.close();
      return;
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded: any = await verify(token, secret);
    const adminId = decoded?.adminId;
    if (!adminId) {
      ws.close();
      return;
    }

    register(String(adminId), ws);

    ws.addEventListener('message', (evt) => {
      // Optional: allow clients to send messages via WS in future
      // Expect JSON with { type: 'ping' } or similar
      try {
        const data = JSON.parse(String(evt.data || '{}'));
        if (data?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });
  } catch {
    try { ws.close(); } catch {}
  }
});

