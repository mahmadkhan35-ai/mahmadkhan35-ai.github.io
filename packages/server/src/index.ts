import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage } from './protocol.js';
import { RoomHub } from './rooms.js';

const PORT = Number(process.env.PORT ?? 8787);
const hub = new RoomHub();

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Chessforge room server\n');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Некорректное сообщение' }));
      return;
    }

    if (msg.type === 'create') {
      hub.create(ws, msg.placements);
      return;
    }
    if (msg.type === 'join') {
      hub.join(ws, msg.roomId, msg.placements);
      return;
    }
    if (msg.type === 'command') {
      hub.command(ws, msg.command);
      return;
    }
    ws.send(JSON.stringify({ type: 'error', message: 'Неизвестная команда' }));
  });

  ws.on('close', () => {
    hub.leave(ws);
  });
});

server.listen(PORT, () => {
  console.log(`[chessforge-server] ws://localhost:${PORT}/ws`);
});
