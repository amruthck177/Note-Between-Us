import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { scryptSync } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const port = 43871 + (process.pid % 1000);
const origin = `http://127.0.0.1:${port}`;
const dbFile = `data/test-${process.pid}.sqlite`;
const password = 'TestOnly!AdminPassword92';

test('student submission and protected admin workflows', async (t) => {
  mkdirSync(resolve(root, 'data'), { recursive: true });
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), APP_ORIGIN: origin, DB_PATH: dbFile, ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: password, GOOGLE_SHEET_ID: '', GOOGLE_SERVICE_ACCOUNT_JSON: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk; });
  server.stderr.on('data', (chunk) => { serverOutput += chunk; });
  t.after(async () => {
    if (server.exitCode === null) {
      const exited = new Promise((resolveExit) => server.once('exit', resolveExit));
      server.kill('SIGTERM');
      await exited;
    }
    for (const suffix of ['', '-shm', '-wal']) rmSync(resolve(root, `${dbFile}${suffix}`), { force: true });
  });

  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${origin}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  assert.equal(ready, true, `server failed to start: ${serverOutput}`);

  const request = (path, options = {}) => fetch(`${origin}${path}`, { ...options, headers: { Origin: origin, ...(options.headers || {}) } });
  const submit = (usn, name) => request('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, usn, dob: '2004-03-12', questionsSenior: 'How do you prepare?', adviceJunior: 'Keep practicing.' }) });

  assert.equal((await request('/api/admin/records')).status, 401, 'student/public requests cannot read admin records');
  assert.equal((await request('/api/admin/export.xlsx')).status, 401, 'student/public requests cannot download exports');
  assert.equal((await request('/api/admin/stats')).status, 401, 'student/public requests cannot read admin dashboard statistics');
  assert.equal((await request('/api/admin/sheets/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'student/public requests cannot export to Google Sheets');
  const invalid = await submit('4DM29AI001', 'Invalid Student');
  assert.equal(invalid.status, 400, 'invalid batch/USN is rejected');

  const submitted = await Promise.all([
    submit('4DM25AI001', 'Test Student C'),
    submit('4DM23AI001', 'Test Student A'),
    submit('4DM24AI002', 'Test Student B'),
  ]);
  assert.deepEqual(submitted.map((response) => response.status), [201, 201, 201]);
  assert.deepEqual((await submitted[0].json()).batch, '2025');
  const duplicate = await submit('4DM24AI002', 'Second Test Student');
  assert.equal(duplicate.status, 409, 'duplicate USNs are rejected');

  const loginResponse = await request('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.local', password }) });
  assert.equal(loginResponse.status, 200, 'valid administrator can authenticate');
  const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'admin session cookie is issued');
  const adminRequest = (path, options = {}) => request(path, { ...options, headers: { Cookie: cookie, Origin: origin, ...(options.headers || {}) } });

  let result = await (await adminRequest('/api/admin/records')).json();
  assert.deepEqual(result.rows.map((row) => row.usn), ['4DM23AI001', '4DM24AI002', '4DM25AI001'], 'default USN order is ascending, independent of insertion order');
  assert.deepEqual(result.rows.map((row) => row.semester), [7, 5, 3], 'batch semester is derived from USN');
  assert.deepEqual(await (await adminRequest('/api/admin/stats')).json(), { total: 3, batches: { 2023: 1, 2024: 1, 2025: 1 } });
  result = await (await adminRequest('/api/admin/records?search=Student%20B&batch=2024&semester=5')).json();
  assert.equal(result.total, 1, 'search and batch/semester filtering work');
  result = await (await adminRequest('/api/admin/records?direction=desc')).json();
  assert.deepEqual(result.rows.map((row) => row.usn), ['4DM25AI001', '4DM24AI002', '4DM23AI001'], 'administrator can sort descending');

  const xlsxResponse = await adminRequest('/api/admin/export.xlsx');
  assert.equal(xlsxResponse.status, 200);
  assert.match(xlsxResponse.headers.get('content-type'), /spreadsheetml/);
  assert.ok((await xlsxResponse.arrayBuffer()).byteLength > 100, 'Excel export contains a workbook');

  const form = new FormData();
  form.append('file', new Blob([
    'Name,USN,DOB,Questions to Senior,Message / Advice to Junior\n' +
    'Import Student,4DM24AI004,2004-02-11,How do I get started?,Make a steady plan.\n' +
    'Duplicate Student,4DM24AI002,2004-02-11,Existing record?,Existing record.\n' +
    'Bad Student,4DM29AI001,2004-02-11,Invalid batch?,Invalid batch.\n',
  ], { type: 'text/csv' }), 'students.csv');
  const previewResponse = await adminRequest('/api/admin/imports/preview', { method: 'POST', body: form });
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.equal(preview.validCount, 1, `import preview accepts one new valid row and flags duplicate/invalid rows: ${JSON.stringify(preview)}`);
  const imported = await adminRequest(`/api/admin/imports/${preview.token}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const importResult = await imported.json();
  assert.equal(imported.status, 200, `import confirmation failed: ${JSON.stringify(importResult)}\n${serverOutput}`);
  assert.equal(importResult.imported, 1);
  assert.equal(importResult.skipped, 2);

  result = await (await adminRequest('/api/admin/records?page=1&pageSize=10')).json();
  assert.equal(result.total, 4, 'imported records persist');
  assert.deepEqual(result.rows.map((row) => row.usn), ['4DM23AI001', '4DM24AI002', '4DM24AI004', '4DM25AI001']);
  const target = result.rows.find((row) => row.usn === '4DM24AI002');
  const edited = await adminRequest(`/api/admin/records/${target.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...target, name: 'Updated Test Student' }) });
  assert.equal((await edited.json()).name, 'Updated Test Student', 'authorized administrator can edit a student record');
  const nextRecord = result.rows.find((row) => row.usn === '4DM25AI001');
  assert.equal((await adminRequest(`/api/admin/records/${nextRecord.id}`, { method: 'DELETE' })).status, 200, 'authorized administrator can delete a record');
  assert.equal((await request('/api/admin/records')).status, 401, 'admin records remain inaccessible without the admin cookie');
  assert.equal((await adminRequest('/api/admin/sheets/status')).status, 200, 'sheet status is protected and readable by admins');
  assert.equal((await adminRequest('/api/admin/sheets/import-existing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503, 'sheet import fails safely when private credentials are absent');
  assert.equal((await adminRequest('/api/admin/sheets/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503, 'sheet export fails safely when private credentials are absent');
  const sheetStatus = await (await adminRequest('/api/admin/sheets/status')).json();
  assert.equal(sheetStatus.spreadsheetId, '1qmC2UCeR_bFcLc9rsLpneTaEKR7ym4c1nKWHVulw2XQ', 'Sheets integration is pinned to the requested spreadsheet');
  assert.equal((await adminRequest('/api/admin/session', { method: 'DELETE' })).status, 200);
  assert.equal((await adminRequest('/api/admin/stats')).status, 401, 'sign-out revokes the admin session');
});
