import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomHandler } from '../api/room-core.js';

function makeHarness() {
  const entries = new Map();
  const cache = {
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) { entries.delete(key); return null; }
      return entry.value;
    },
    async set(key, value, options = {}) {
      entries.set(key, { value, expiresAt: Date.now() + (options.ttl || 60) * 1000 });
    },
    async delete(key) { entries.delete(key); },
  };
  const handler = createRoomHandler(() => cache);
  async function call(body, method = 'POST') {
    const headers = {};
    let result;
    const res = {
      setHeader(name, value) { headers[name] = value; },
      end(value) { result = JSON.parse(value); },
      statusCode: 200,
    };
    await handler({ method, body }, res);
    return { status: res.statusCode, headers, body: result };
  }
  return { call };
}

const code = 'ABCDEFGH';
const hostId = '11111111111111111111111111111111';
const guestId = '22222222222222222222222222222222';

test('two Discord players create, join, and exchange shared game messages', async () => {
  const { call } = makeHarness();
  assert.equal((await call({ action: 'create', code, clientId: hostId, name: 'Host' })).status, 200);
  assert.equal((await call({ action: 'join', code, clientId: guestId, name: 'Guest' })).status, 200);

  const join = await call({ action: 'send', code, clientId: guestId, sequence: 1, message: { type: 'join', name: 'Guest' } });
  assert.equal(join.status, 200);
  const hostInbox = await call({ action: 'poll', code, clientId: hostId, cursor: 0 });
  assert.equal(hostInbox.body.guest.id, guestId);
  assert.equal(hostInbox.body.messages[0].message.type, 'join');

  assert.equal((await call({ action: 'send', code, clientId: hostId, sequence: 1, message: { type: 'start', answer: 'PLANT' } })).status, 200);
  const guestInbox = await call({ action: 'poll', code, clientId: guestId, cursor: 0 });
  assert.equal(guestInbox.body.hostOnline, true);
  assert.equal(guestInbox.body.messages[0].message.answer, 'PLANT');
});

test('room only admits one guest and rejects outsiders sending events', async () => {
  const { call } = makeHarness();
  const thirdId = '33333333333333333333333333333333';
  await call({ action: 'create', code, clientId: hostId, name: 'Host' });
  await call({ action: 'join', code, clientId: guestId, name: 'Guest' });
  assert.equal((await call({ action: 'join', code, clientId: thirdId, name: 'Other' })).body.error, 'room_full');
  assert.equal((await call({ action: 'send', code, clientId: thirdId, sequence: 1, message: { type: 'guess', word: 'PLANT' } })).status, 403);
});

test('leaving as host closes the room for new joins', async () => {
  const { call } = makeHarness();
  const nextId = '33333333333333333333333333333333';
  await call({ action: 'create', code, clientId: hostId, name: 'Host' });
  await call({ action: 'leave', code, clientId: hostId });
  assert.equal((await call({ action: 'join', code, clientId: nextId, name: 'Guest' })).body.error, 'room_missing');
});

test('validates requests and never caches room responses', async () => {
  const { call } = makeHarness();
  const invalid = await call({ action: 'create', code: 'bad', clientId: hostId, name: 'Host' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal((await call({}, 'GET')).status, 405);
});
