import test from 'node:test';
import assert from 'node:assert/strict';

test('Hardcoded admin credentials authentication logic', () => {
  const HARDCODED_ADMIN_EMAIL = 'admin@yit';
  const HARDCODED_ADMIN_PASSWORD = '123@231';

  function authenticate(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    if (!cleanEmail || !cleanPass) return false;
    return cleanEmail === HARDCODED_ADMIN_EMAIL && cleanPass === HARDCODED_ADMIN_PASSWORD;
  }

  // Valid credentials
  assert.equal(authenticate('admin@yit', '123@231'), true, 'admin@yit with 123@231 must authenticate');
  assert.equal(authenticate('ADMIN@YIT', '123@231'), true, 'email should be case-insensitive');
  assert.equal(authenticate('  admin@yit  ', '123@231'), true, 'whitespace in email should be trimmed');

  // Invalid credentials
  assert.equal(authenticate('admin@yit', 'wrong_pass'), false, 'wrong password must fail');
  assert.equal(authenticate('other@yit', '123@231'), false, 'wrong email must fail');
  assert.equal(authenticate('', ''), false, 'empty credentials must fail');
  assert.equal(authenticate(null, null), false, 'null credentials must fail');
});
