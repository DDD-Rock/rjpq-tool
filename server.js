/**
 * RJPQ Tool - 云服务器版本 (WebSocket)
 * Redis KV 存储 + WebSocket 实时同步
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createClient } = require('redis');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const ROOM_TTL = parseInt(process.env.ROOM_TTL) || 1800;

// ===== Redis =====
const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('❌ Redis 错误:', err.message));
redis.on('connect', () => console.log('✅ Redis 已连接'));

function roomKey(code) { return 'room:' + code; }

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePassword() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function getRoom(code) {
  const raw = await redis.get(roomKey(code));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setRoom(code, roomObj) {
  await redis.set(roomKey(code), JSON.stringify(roomObj), { EX: ROOM_TTL });
}

// ===== 房间连接管理 =====
// roomCode -> Set<WebSocket>
const roomClients = new Map();

function addClient(code, ws) {
  if (!roomClients.has(code)) roomClients.set(code, new Set());
  roomClients.get(code).add(ws);
}

function removeClient(code, ws) {
  const clients = roomClients.get(code);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) roomClients.delete(code);
  }
}

function broadcastToRoom(code, data, excludeWs = null) {
  const clients = roomClients.get(code);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(msg);
    }
  }
}

function getRoomCount(code) {
  const clients = roomClients.get(code);
  return clients ? clients.size : 0;
}

function broadcastRoomCount(code) {
  broadcastToRoom(code, { type: 'count', count: getRoomCount(code) });
}

function getTotalOnline() {
  return wss ? wss.clients.size : 0;
}

// ===== WebSocket 消息处理 =====
async function handleWsMessage(ws, message) {
  let msg;
  try {
    msg = JSON.parse(message);
  } catch {
    ws.send(JSON.stringify({ type: 'error', error: '无效消息' }));
    return;
  }

  const { type, code, index, color } = msg;

  // 加入房间
  if (type === 'join') {
    const { password } = msg;
    if (!code || !/^\d{6}$/.test(code)) {
      ws.send(JSON.stringify({ type: 'error', error: '无效房间代码' }));
      return;
    }
    const room = await getRoom(code);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', error: '房间不存在' }));
      return;
    }
    // 验证密码
    if (room.password && room.password !== password) {
      ws.send(JSON.stringify({ type: 'error', error: '密码错误' }));
      return;
    }
    // 离开旧房间
    if (ws._roomCode) removeClient(ws._roomCode, ws);
    ws._roomCode = code;
    addClient(code, ws);
    // 刷新 TTL
    await setRoom(code, room);

    ws.send(JSON.stringify({ type: 'sync', data: room.data }));
    // 广播房间人数更新
    broadcastRoomCount(code);
    return;
  }

  // 以下操作需要先 join
  const roomCode = ws._roomCode;
  if (!roomCode) {
    ws.send(JSON.stringify({ type: 'error', error: '请先加入房间' }));
    return;
  }

  let room = await getRoom(roomCode);
  if (!room) room = { data: Array(40).fill(4), password: '' };
  let data = room.data;

  if (type === 'mark' && index >= 0 && index < 40 && color >= 0 && color <= 3) {
    // 已被其他颜色占用
    if (data[index] !== 4 && data[index] !== color) {
      ws.send(JSON.stringify({ type: 'sync', data }));
      return;
    }
    // 同行同色互斥
    const rowStart = Math.floor(index / 4) * 4;
    for (let i = rowStart; i < rowStart + 4; i++) {
      if (i !== index && data[i] === color) data[i] = 4;
    }
    data[index] = color;

  } else if (type === 'unmark' && index >= 0 && index < 40) {
    if (color !== undefined && data[index] !== color) {
      ws.send(JSON.stringify({ type: 'sync', data }));
      return;
    }
    data[index] = 4;

  } else if (type === 'reset') {
    data = Array(40).fill(4);

  } else {
    ws.send(JSON.stringify({ type: 'error', error: '未知操作' }));
    return;
  }

  room.data = data;
  await setRoom(roomCode, room);
  // 广播给房间内所有人（包括发送者，确保数据一致）
  broadcastToRoom(roomCode, { type: 'sync', data });
}

// ===== HTTP: 创建房间 + 静态文件 =====
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 在线人数查询（首页轮询用）
  if (url.pathname === '/api/stats') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ online: getTotalOnline() }));
    return;
  }

  // 创建房间仍用 HTTP（首页调用一次即可）
  if (url.pathname === '/api/room' && url.searchParams.get('action') === 'create') {
    (async () => {
      try {
        const customPwd = url.searchParams.get('pwd');
        const password = customPwd || generatePassword();
        let newCode;
        do { newCode = generateCode(); } while (await getRoom(newCode));
        await setRoom(newCode, { data: Array(40).fill(4), password });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ code: newCode, password }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  // 静态文件
  let filePath = url.pathname;
  if (filePath === '/') filePath = '/index.html';
  const fullPath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, fileData) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(fileData);
  });
});

// ===== WebSocket 服务器 =====
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws._roomCode = null;

  ws.on('message', (message) => {
    handleWsMessage(ws, message.toString());
  });

  ws.on('close', () => {
    const code = ws._roomCode;
    if (code) {
      removeClient(code, ws);
      broadcastRoomCount(code);
    }
  });

  ws.on('error', () => {
    const code = ws._roomCode;
    if (code) {
      removeClient(code, ws);
      broadcastRoomCount(code);
    }
  });
});

// ===== 启动 =====
async function start() {
  await redis.connect();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🎮 RJPQ Tool 已启动 (WebSocket)`);
    console.log(`  📍 http://0.0.0.0:${PORT}`);
    console.log(`  🔗 Redis: ${REDIS_URL}\n`);
  });
}

start().catch((err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
