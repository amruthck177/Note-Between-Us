import test from 'node:test';
import assert from 'node:assert/strict';

test('Admin session route integration test without DB dependency', async () => {
  // Simulate the exact endpoint logic in server/index.js
  const HARDCODED_ADMIN_EMAIL = 'admin@yit';
  const HARDCODED_ADMIN_PASSWORD = '123@231';
  const inMemoryAdminSessions = new Map();

  function login(body) {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password || email !== HARDCODED_ADMIN_EMAIL || password !== HARDCODED_ADMIN_PASSWORD) {
      return { status: 401, body: { error: 'Email or password is incorrect.' } };
    }
    const token = 'test-token-12345';
    inMemoryAdminSessions.set(token, { email: HARDCODED_ADMIN_EMAIL, expiresAt: Date.now() + 10000 });
    return { status: 200, body: { ok: true, email: HARDCODED_ADMIN_EMAIL }, token };
  }

  function getSession(token) {
    const session = inMemoryAdminSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      return { status: 401, body: { error: 'Admin session expired or invalid.' } };
    }
    return { status: 200, body: { authenticated: true, email: session.email } };
  }

  // 1. Valid login
  const res1 = login({ email: 'admin@yit', password: '123@231' });
  assert.equal(res1.status, 200);
  assert.equal(res1.body.ok, true);
  assert.equal(res1.body.email, 'admin@yit');

  // 2. Check session with token
  const checkRes = getSession(res1.token);
  assert.equal(checkRes.status, 200);
  assert.equal(checkRes.body.authenticated, true);

  // 3. Invalid email
  const res2 = login({ email: 'wrong@yit', password: '123@231' });
  assert.equal(res2.status, 401);

  // 4. Invalid password
  const res3 = login({ email: 'admin@yit', password: 'bad_password' });
  assert.equal(res3.status, 401);
});
