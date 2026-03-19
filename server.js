/**
 * RJPQ Tool - 本地开发服务器
 * 提供与 EdgeOne Node Functions 相同的 API，用于本地调试
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// ===== 房间状态管理 =====
const rooms = new Map();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 每分钟清理超过30分钟无活动的房间
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActive > 30 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 60 * 1000);

// ===== API 处理 =====
function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');

    if (action === 'create') {
      let newCode;
      do { newCode = generateCode(); } while (rooms.has(newCode));
      rooms.set(newCode, { data: Array(40).fill(4), lastActive: Date.now() });
      res.writeHead(200, headers);
      res.end(JSON.stringify({ code: newCode }));
      return;
    }

    if (code) {
      if (!rooms.has(code)) {
        rooms.set(code, { data: Array(40).fill(4), lastActive: Date.now() });
      }
      const room = rooms.get(code);
      room.lastActive = Date.now();
      res.writeHead(200, headers);
      res.end(JSON.stringify({ data: room.data }));
      return;
    }

    res.writeHead(400, headers);
    res.end(JSON.stringify({ error: '缺少参数' }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { code, action, index, color } = JSON.parse(body);

        if (!rooms.has(code)) {
          rooms.set(code, { data: Array(40).fill(4), lastActive: Date.now() });
        }
        const room = rooms.get(code);
        room.lastActive = Date.now();

        if (action === 'mark' && index >= 0 && index < 40 && color >= 0 && color <= 3) {
          // 标记平台，同时清除该角色在同行的其他标记
          room.data[index] = color;
          const rowStart = Math.floor(index / 4) * 4;
          for (let i = rowStart; i < rowStart + 4; i++) {
            if (i !== index && room.data[i] === color) {
              room.data[i] = 4;
            }
          }
        } else if (action === 'unmark' && index >= 0 && index < 40) {
          room.data[index] = 4;
        } else if (action === 'reset') {
          room.data = Array(40).fill(4);
        }

        res.writeHead(200, headers);
        res.end(JSON.stringify({ ok: true, data: room.data }));
      } catch (e) {
        res.writeHead(400, headers);
        res.end(JSON.stringify({ error: '无效请求' }));
      }
    });
    return;
  }

  res.writeHead(405, headers);
  res.end(JSON.stringify({ error: '不支持的方法' }));
}

// ===== 静态文件服务 =====
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

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = url.pathname;
  if (filePath === '/') filePath = '/index.html';

  const fullPath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ===== 服务器入口 =====
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/room')) {
    handleAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n  🎮 RJPQ Tool 已启动`);
  console.log(`  📍 http://localhost:${PORT}\n`);
});
