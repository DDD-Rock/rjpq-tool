/**
 * RJPQ Tool - EdgeOne Node Function
 * 房间管理 REST API（单 key 存储）
 * 路由: /api/room
 *
 * 数据模型：单个 KV key 存储完整 40 格数组
 *   room_{code} = [c0, c1, ..., c39]  (每格值 0-3 表示颜色，4 表示空)
 */

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getRoom(code) {
  const raw = await ROOMS_KV.get('room_' + code);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setRoom(code, data) {
  await ROOMS_KV.put('room_' + code, JSON.stringify(data));
}

export async function onRequest({ request, params, env }) {
  const url = new URL(request.url);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // GET: 创建或获取房间
  if (request.method === 'GET') {
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');

    if (action === 'create') {
      const newCode = generateCode();
      await setRoom(newCode, Array(40).fill(4));
      return new Response(JSON.stringify({ code: newCode }), { headers });
    }

    if (code) {
      let data = await getRoom(code);
      if (!data) data = Array(40).fill(4);
      return new Response(JSON.stringify({ data }), { headers });
    }

    return new Response(JSON.stringify({ error: '缺少参数' }), { status: 400, headers });
  }

  // POST: 更新房间状态
  if (request.method === 'POST') {
    try {
      const { code, action, index, color } = await request.json();

      let data = await getRoom(code);
      if (!data) data = Array(40).fill(4);

      if (action === 'mark' && index >= 0 && index < 40 && color >= 0 && color <= 3) {
        // 已被其他颜色占用，拒绝
        if (data[index] !== 4 && data[index] !== color) {
          return new Response(JSON.stringify({ ok: false, data }), { headers });
        }
        // 同行同色互斥
        const rowStart = Math.floor(index / 4) * 4;
        for (let i = rowStart; i < rowStart + 4; i++) {
          if (i !== index && data[i] === color) {
            data[i] = 4;
          }
        }
        data[index] = color;

      } else if (action === 'unmark' && index >= 0 && index < 40) {
        if (color !== undefined && data[index] !== color) {
          return new Response(JSON.stringify({ ok: false, data }), { headers });
        }
        data[index] = 4;

      } else if (action === 'reset') {
        data = Array(40).fill(4);
      }

      await setRoom(code, data);
      return new Response(JSON.stringify({ ok: true, data }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: '无效请求: ' + e.message }), { status: 400, headers });
    }
  }

  return new Response(JSON.stringify({ error: '不支持的方法' }), { status: 405, headers });
}
