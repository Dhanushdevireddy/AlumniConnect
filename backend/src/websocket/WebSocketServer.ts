import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { authService } from '../services/auth/AuthService';
import { chatService } from '../services/chat/ChatService';
import { redisSub, redisPub } from '../db/redisClient';
import redis from '../db/redisClient';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  connectionId?: string;
  isAlive?: boolean;
}

// Map: connectionId  Set of connected WS clients (on this instance)
const localClients = new Map<string, Set<AuthenticatedWebSocket>>();

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // ── Redis pub/sub fan-out ──────────────────────────────────────────────────
  redisSub.on('message', (channel: string, msgStr: string) => {
    const connectionId = channel.replace('chat:', '');
    const clients = localClients.get(connectionId);
    if (!clients) return;
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msgStr);
      }
    });
  });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    // Extract connectionId from URL /ws/connections/:id?token=...
    const url = new URL(req.url || '', 'ws://localhost');
    const pathParts = url.pathname.split('/');
    const connectionId = pathParts[pathParts.length - 1];
    const token = url.searchParams.get('token') || (req.headers.authorization || '').replace('Bearer ', '');

    // Authenticate
    if (!token) { ws.close(4001, 'Missing token'); return; }
    let userId: string;
    try {
      const payload = authService.verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      ws.close(4001, 'Invalid token'); return;
    }

    ws.userId = userId;
    ws.connectionId = connectionId;
    ws.isAlive = true;

    // Register presence
    await redis.set(`presence:${userId}`, 'online', 'EX', 300);
    await broadcastPresence(connectionId, userId, 'online');

    // Register local client
    if (!localClients.has(connectionId)) localClients.set(connectionId, new Set());
    localClients.get(connectionId)!.add(ws);

    // Subscribe this instance to the Redis channel for this connection
    redisSub.subscribe(`chat:${connectionId}`);

    // Send pending messages (those delivered while disconnected)
    const pending = await redis.lrange(`pending:${connectionId}:${userId}`, 0, -1);
    if (pending.length > 0) {
      pending.forEach((msg) => ws.send(msg));
      await redis.del(`pending:${connectionId}:${userId}`);
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (parsed.type === 'message' && parsed.content) {
          // Persist to DB first — then fan out
          const message = await chatService.sendTextMessage(connectionId, userId, parsed.content);
          const outgoing = JSON.stringify({ type: 'message', data: message });

          // Publish to Redis so all instances receive it
          await redisPub.publish(`chat:${connectionId}`, outgoing);
        }
      } catch (err) {
        console.error('[WS] Message handling error:', err);
      }
    });

    ws.on('close', async () => {
      localClients.get(connectionId)?.delete(ws);
      // Update presence
      await redis.del(`presence:${userId}`);
      await broadcastPresence(connectionId, userId, 'offline');
    });

    ws.on('error', (err) => console.error('[WS] Client error:', err));
  });

  // ── Heartbeat to detect broken connections ────────────────────────────────
  setInterval(() => {
    wss.clients.forEach((ws) => {
      const aws = ws as AuthenticatedWebSocket;
      if (!aws.isAlive) { ws.terminate(); return; }
      aws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // ── Presence TTL refresh ──────────────────────────────────────────────────
  setInterval(async () => {
    for (const clients of localClients.values()) {
      for (const ws of clients) {
        if (ws.userId && ws.readyState === WebSocket.OPEN) {
          await redis.set(`presence:${ws.userId}`, 'online', 'EX', 300);
        }
      }
    }
  }, 60000);

  console.log('[WebSocket] Server configured');
  return wss;
}

async function broadcastPresence(connectionId: string, userId: string, status: 'online' | 'offline') {
  const presenceMsg = JSON.stringify({ type: 'presence', userId, status });
  await redisPub.publish(`chat:${connectionId}`, presenceMsg);
}
