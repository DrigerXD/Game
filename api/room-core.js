const ROOM_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const CLIENT_ID = /^[a-f0-9]{32}$/;
const PLAYER_NAME = /[<>\u0000-\u001f]/g;
const ROOM_TTL = 6 * 60 * 60;
const HEARTBEAT_TTL = 25;
const MESSAGE_TYPES = new Set(['join', 'guess', 'start', 'state', 'reject', 'leave']);
const HOST_MESSAGES = new Set(['start', 'state', 'reject', 'leave']);
const GUEST_MESSAGES = new Set(['join', 'guess', 'leave']);

const key = (code, suffix) => `room:${code}:${suffix}`;
const heartbeatKey = (code, clientId) => key(code, `heartbeat:${clientId}`);
const sequenceKey = (code, clientId) => key(code, `sequence:${clientId}`);
const messageKey = (code, clientId, sequence) => key(code, `message:${clientId}:${sequence}`);

function cleanName(value) {
  const name = String(value || '').replace(PLAYER_NAME, '').trim().replace(/\s+/g, ' ').slice(0, 18);
  return name || 'Detective';
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export function createRoomHandler(getCache) {
  return async function roomHandler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });
    const body = readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { ok: false, error: 'invalid_request' });

    const { action, code, clientId } = body;
    if (typeof action !== 'string' || !['create', 'join', 'poll', 'send', 'leave'].includes(action)) {
      return send(res, 400, { ok: false, error: 'invalid_action' });
    }
    if (typeof code !== 'string' || !ROOM_CODE.test(code)) return send(res, 400, { ok: false, error: 'invalid_code' });
    if (typeof clientId !== 'string' || !CLIENT_ID.test(clientId)) return send(res, 400, { ok: false, error: 'invalid_client' });

    try {
      const cache = await getCache();
      const metaKey = key(code, 'meta');
      const guestKey = key(code, 'guest');

      if (action === 'create') {
        if (typeof body.name !== 'string') return send(res, 400, { ok: false, error: 'invalid_name' });
        const existing = await cache.get(metaKey);
        if (existing && !existing.closed && await cache.get(heartbeatKey(code, existing.hostId))) {
          return send(res, 409, { ok: false, error: 'room_exists' });
        }
        const meta = { hostId: clientId, hostName: cleanName(body.name), createdAt: Date.now(), closed: false };
        await cache.set(metaKey, meta, { ttl: ROOM_TTL });
        await cache.set(sequenceKey(code, clientId), 0, { ttl: ROOM_TTL });
        await cache.set(heartbeatKey(code, clientId), Date.now(), { ttl: HEARTBEAT_TTL });
        await cache.delete(guestKey);
        return send(res, 200, { ok: true, hostId: clientId, hostName: meta.hostName });
      }

      const meta = await cache.get(metaKey);
      if (!meta || meta.closed) return send(res, 404, { ok: false, error: 'room_missing' });

      if (action === 'join') {
        if (clientId === meta.hostId) return send(res, 409, { ok: false, error: 'cannot_join_own_room' });
        if (!await cache.get(heartbeatKey(code, meta.hostId))) return send(res, 404, { ok: false, error: 'host_offline' });
        const currentGuest = await cache.get(guestKey);
        if (currentGuest && currentGuest.id !== clientId && await cache.get(heartbeatKey(code, currentGuest.id))) {
          return send(res, 409, { ok: false, error: 'room_full' });
        }
        const guest = { id: clientId, name: cleanName(body.name) };
        await cache.set(guestKey, guest, { ttl: ROOM_TTL });
        await cache.set(sequenceKey(code, clientId), 0, { ttl: ROOM_TTL });
        await cache.set(heartbeatKey(code, clientId), Date.now(), { ttl: HEARTBEAT_TTL });
        return send(res, 200, { ok: true, hostId: meta.hostId, hostName: meta.hostName, guest });
      }

      const guest = await cache.get(guestKey);
      const isHost = clientId === meta.hostId;
      const isGuest = !!guest && clientId === guest.id;
      if (!isHost && !isGuest) return send(res, 403, { ok: false, error: 'not_a_room_member' });

      if (action === 'leave') {
        if (isHost) {
          meta.closed = true;
          await cache.set(metaKey, meta, { ttl: 60 });
          await cache.delete(heartbeatKey(code, clientId));
        } else {
          await cache.delete(guestKey);
          await cache.delete(heartbeatKey(code, clientId));
        }
        return send(res, 200, { ok: true });
      }

      if (action === 'send') {
        if (!guest || !await cache.get(heartbeatKey(code, guest.id))) return send(res, 409, { ok: false, error: 'other_player_offline' });
        const message = body.message;
        if (!message || typeof message !== 'object' || Array.isArray(message) || !MESSAGE_TYPES.has(message.type)) {
          return send(res, 400, { ok: false, error: 'invalid_message' });
        }
        if ((isHost && !HOST_MESSAGES.has(message.type)) || (isGuest && !GUEST_MESSAGES.has(message.type))) {
          return send(res, 403, { ok: false, error: 'message_not_allowed' });
        }
        if (Buffer.byteLength(JSON.stringify(message), 'utf8') > 4096) return send(res, 413, { ok: false, error: 'message_too_large' });
        if (!Number.isSafeInteger(body.sequence) || body.sequence < 1) return send(res, 400, { ok: false, error: 'invalid_sequence' });

        const previous = Number(await cache.get(sequenceKey(code, clientId)) || 0);
        if (body.sequence <= previous) return send(res, 200, { ok: true, duplicate: true });
        if (body.sequence !== previous + 1) return send(res, 409, { ok: false, error: 'sequence_gap', expected: previous + 1 });
        await cache.set(messageKey(code, clientId, body.sequence), message, { ttl: ROOM_TTL });
        await cache.set(sequenceKey(code, clientId), body.sequence, { ttl: ROOM_TTL });
        return send(res, 200, { ok: true });
      }

      if (action === 'poll') {
        await cache.set(metaKey, meta, { ttl: ROOM_TTL });
        await cache.set(heartbeatKey(code, clientId), Date.now(), { ttl: HEARTBEAT_TTL });
        let liveGuest = guest;
        if (guest && !await cache.get(heartbeatKey(code, guest.id))) {
          await cache.delete(guestKey);
          liveGuest = null;
        } else if (guest) {
          await cache.set(guestKey, guest, { ttl: ROOM_TTL });
        }

        const otherId = isHost ? liveGuest?.id : meta.hostId;
        const otherOnline = !!otherId && !!await cache.get(heartbeatKey(code, otherId));
        const latest = otherOnline ? Number(await cache.get(sequenceKey(code, otherId)) || 0) : 0;
        const requestedCursor = Number.isSafeInteger(body.cursor) && body.cursor >= 0 ? body.cursor : 0;
        const first = Math.max(requestedCursor + 1, latest - 49);
        const messages = [];
        for (let sequence = first; otherOnline && sequence <= latest; sequence++) {
          const message = await cache.get(messageKey(code, otherId, sequence));
          if (message) messages.push({ sequence, from: otherId, message });
        }
        const common = { ok: true, messages, cursor: latest };
        if (isHost) {
          return send(res, 200, { ...common, guest: liveGuest && otherOnline ? liveGuest : null });
        }
        return send(res, 200, { ...common, hostOnline: otherOnline, hostId: meta.hostId, hostName: meta.hostName, closed: meta.closed === true });
      }

      return send(res, 400, { ok: false, error: 'invalid_action' });
    } catch (error) {
      console.error('Discord multiplayer relay error:', error);
      return send(res, 503, { ok: false, error: 'relay_unavailable' });
    }
  };
}
