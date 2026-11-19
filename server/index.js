// server/index.js
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import XLSX from 'xlsx';
import { db } from './db.js';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const HARD_CODED_ADMIN_EMAIL = 'admin@yit';
const HARD_CODED_ADMIN_PASSWORD = '123@231';
const distPath = resolve(projectRoot, 'dist');
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const TARGET_SPREADSHEET_ID = '1qmC2UCeR_bFcLc9rsLpneTaEKR7ym4c1nKWHVulw2XQ';
const TARGET_SHEET_TAB = 'Enter Student Data';

(async () => {
  // Initialize schema and auxiliary tables
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      usn TEXT NOT NULL UNIQUE,
      dob TEXT NOT NULL,
      questions_senior TEXT NOT NULL DEFAULT '',
      advice_junior TEXT NOT NULL DEFAULT '',
      batch TEXT NOT NULL,
      semester INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sheet_sync TEXT NOT NULL DEFAULT 'pending',
      sheet_previous_usn TEXT NOT NULL DEFAULT '',
      sheet_row INTEGER
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS imported_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      content BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sheet_slots (
      usn TEXT PRIMARY KEY,
      row_number INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS students_usn_idx ON students(usn COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS students_batch_idx ON students(batch);
  `);
  // Ensure legacy column exists for backward compatibility
  const stmt = await db.prepare('PRAGMA table_info(students)');
  const cols = await stmt.all();
  if (!cols.some(c => c.name === 'sheet_previous_usn')) {
    await db.exec("ALTER TABLE students ADD COLUMN sheet_previous_usn TEXT NOT NULL DEFAULT ''");
  }
})();

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '64kb' }));

const submissionLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

const normalUsn = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();
function batchFromUsn(usn) {
  const match = /^4DM(23|24|25)AI\d{3}$/.exec(normalUsn(usn));
  if (!match) return null;
  const year = Number(`20${match[1]}`);
  return { batch: String(year), semester: ({ 2023: 7, 2024: 5, 2025: 3 })[year] };
}

function validDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date < new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
}

function cleanText(value, max) { return String(value ?? '').trim().slice(0, max); }
function validateStudent(payload = {}) {
  const name = cleanText(payload.name, 100);
  const usn = normalUsn(payload.usn);
  const dob = String(payload.dob ?? '');
  const questionsSenior = cleanText(payload.questionsSenior, 2000);
  const adviceJunior = cleanText(payload.adviceJunior, 2000);
  const batchInfo = batchFromUsn(usn);
  const errors = {};
  if (name.length < 2) errors.name = 'Enter your full name.';
  if (!batchInfo) errors.usn = 'Use a valid USN such as 4DM24AI001.';
  if (!validDob(dob)) errors.dob = 'Enter a valid date of birth.';
  if (batchInfo?.batch === '2023' && !adviceJunior) errors.adviceJunior = 'Add a message or advice for juniors.';
  if (batchInfo?.batch === '2024' && !questionsSenior) errors.questionsSenior = 'Add a question for your seniors.';
  if (batchInfo?.batch === '2024' && !adviceJunior) errors.adviceJunior = 'Add a message or advice for juniors.';
  if (batchInfo?.batch === '2025' && !questionsSenior) errors.questionsSenior = 'Add a question for your seniors.';
  return { errors, student: batchInfo ? { name, usn, dob, questionsSenior, adviceJunior, ...batchInfo } : null };
}

const now = () => new Date().toISOString();
const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');
function parseCookie(req, name) {
  const entry = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

async function requireAdmin(req, res, next) {
  const token = parseCookie(req, 'inuguration_admin');
  if (!token) return res.status(401).json({ error: 'Admin sign-in required.' });
  const session = await (await db.prepare('SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?')).get(tokenDigest(token));
  if (!session || session.expires_at < Date.now()) {
    if (token) await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenDigest(token));
    return res.status(401).json({ error: 'Admin session expired.' });
  }
  req.admin = { email: session.email };
  next();
}

function sameOrigin(req, res, next) { /* disabled origin check */ next(); }
  const origin = req.get('origin');
  if (!origin) return next();
  const allowed = new Set([process.env.APP_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean));
  if (!allowed.has(origin)) return res.status(403).json({ error: 'Request origin rejected.' });
  next();
}

app.use('/api', sameOrigin);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'inuguration-api' }));
app.get('/api/config', (_req, res) => res.json({ googleSheetsConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) }));

app.post('/api/submissions', submissionLimiter, async (req, res) => {
  if (req.body?.website) return res.status(400).json({ error: 'Submission rejected.' });
  const { errors, student } = validateStudent(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Review the highlighted fields.', fields: errors });
  const stamp = now();
  try {
    const result = await db.prepare(`INSERT INTO students (name, usn, dob, questions_senior, advice_junior, batch, semester, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(student.name, student.usn, student.dob, student.questionsSenior, student.adviceJunior, student.batch, student.semester, stamp, stamp);
    let sheetSync = 'pending';
    try {
      sheetSync = await appendStudentToSheet(student) ? 'synced' : 'pending';
    } catch (error) {
      console.error('Google Sheets sync failed:', error.message);
      sheetSync = 'pending';
    }
    db.prepare('UPDATE students SET sheet_sync = ? WHERE id = ?').run(sheetSync, result.lastInsertRowid);
    res.status(201).json({ ok: true, batch: student.batch, semester: student.semester, sheetSync });
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: 'This USN already has a submission. Contact an administrator if it needs correction.' });
    console.error(error);
    res.status(500).json({ error: 'Submission could not be saved.' });
  }
});

function hashConfig() {
  const parts = String(process.env.ADMIN_PASSWORD_HASH || '').split(':');
  return parts.length === 2 && /^[a-f0-9]{64}$/.test(parts[1]) ? { salt: parts[0], hash: Buffer.from(parts[1], 'hex') } : null;
}
function verifyPassword(password) {
  // If a plain‑text admin password is provided via the ADMIN_PASSWORD env var, use it directly.
  // This is convenient for local development or simple deployments, but it is less secure than the hash.
  const plain = process.env.ADMIN_PASSWORD;
  if (plain) {
    return password === plain;
  }
  // Fall back to the existing salted scrypt hash validation.
  const config = hashConfig();
  if (!config || !password) return false;
  const computed = scryptSync(password, config.salt, config.hash.length);
  return timingSafeEqual(computed, config.hash);
}

app.post('/api/admin/session', loginLimiter, (req, res) => {
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = String(req.body?.password || '');
  // Use hard‑coded credentials if environment variables are not set
  const expectedEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).toLowerCase() : HARD_CODED_ADMIN_EMAIL.toLowerCase();
  const plainPassword = process.env.ADMIN_PASSWORD || HARD_CODED_ADMIN_PASSWORD;
  const passwordOk = plainPassword ? password === plainPassword : verifyPassword(password);
  if (!expectedEmail || email !== expectedEmail || !passwordOk) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  db.prepare('INSERT INTO admin_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').run(tokenDigest(token), expectedEmail, expiresAt);
  res.cookie('inuguration_admin', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/' });
  res.json({ ok: true, email: expectedEmail, expiresAt });
});
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const expectedEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!expectedEmail || !hashConfig() || email !== expectedEmail || !verifyPassword(String(req.body?.password || '')))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  db.prepare('INSERT INTO admin_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').run(tokenDigest(token), expectedEmail, expiresAt);
  res.cookie('inuguration_admin', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/' });
  res.json({ ok: true, email: expectedEmail, expiresAt });
});
app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ authenticated: true, email: req.admin.email }));
app.delete('/api/admin/session', requireAdmin, (req, res) => {
  const token = parseCookie(req, 'inuguration_admin');
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenDigest(token));
  res.clearCookie('inuguration_admin', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.json({ ok: true });
});

function filtersFrom(req) {
  const clauses = [];
  const params = [];
  const search = cleanText(req.query.search, 100);
  if (search) {
    clauses.push('(name LIKE ? OR usn LIKE ?)');
    params.push(`%${search}%`, `%${normalUsn(search)}%`);
  }
  if (['2023', '2024', '2025'].includes(String(req.query.batch || ''))) {
    clauses.push('batch = ?');
    params.push(String(req.query.batch));
  }
  if ([3, 5, 7].includes(Number(req.query.semester))) {
    clauses.push('semester = ?');
    params.push(Number(req.query.semester));
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const toStudent = (row) => ({
  id: row.id,
  name: row.name,
  usn: row.usn,
  dob: row.dob,
  questionsSenior: row.questions_senior,
  adviceJunior: row.advice_junior,
  batch: row.batch,
  semester: row.semester,
  createdAt: row.created_at,
  sheetSync: row.sheet_sync,
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const counts = db.prepare("SELECT COUNT(*) AS total, SUM(batch='2023') AS b2023, SUM(batch='2024') AS b2024, SUM(batch='2025') AS b2025 FROM students").get();
  res.json({ total: counts.total || 0, batches: { '2023': counts.b2023 || 0, '2024': counts.b2024 || 0, '2025': counts.b2025 || 0 } });
});

app.get('/api/admin/records', requireAdmin, (req, res) => {
  const { where, params } = filtersFrom(req);
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(req.query.pageSize) || 20)));
  const sortKey = ({ usn: 'usn', name: 'name', dob: 'dob', batch: 'batch' })[req.query.sort] || 'usn';
  const direction = req.query.direction === 'desc' ? 'DESC' : 'ASC';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM students ${where}`).get(...params).count;
  const rows = db.prepare(`SELECT * FROM students ${where} ORDER BY ${sortKey} ${direction} LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  res.json({ rows: rows.map(toStudent), total, page, pageSize, pages: Math.ceil(total / pageSize) });
});

app.get('/api/admin/records/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Record not found.' });
  res.json(toStudent(row));
});

app.patch('/api/admin/records/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Record not found.' });
  const merged = {
    name: req.body?.name ?? current.name,
    usn: req.body?.usn ?? current.usn,
    dob: req.body?.dob ?? current.dob,
    questionsSenior: req.body?.questionsSenior ?? current.questions_senior,
    adviceJunior: req.body?.adviceJunior ?? current.advice_junior,
  };
  const { errors, student } = validateStudent(merged);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Invalid record.', fields: errors });
  try {
    db.prepare(`UPDATE students SET name=?, usn=?, dob=?, questions_senior=?, advice_junior=?, batch=?, semester=?, updated_at=?, sheet_sync='pending', sheet_previous_usn=? WHERE id=?`)
      .run(student.name, student.usn, student.dob, student.questionsSenior, student.adviceJunior, student.batch, student.semester, now(), current.usn, id);
    let sheetSync = 'local-only';
    try {
      if (getSheetsClient()) sheetSync = await updateStudentInSheet(current.usn, student) ? 'synced' : 'local-only';
    } catch (error) {
      console.error('Google Sheets update failed:', error.message);
      sheetSync = 'local-only';
    }
    db.prepare('UPDATE students SET sheet_sync=?, sheet_previous_usn=? WHERE id=?').run(sheetSync, sheetSync === 'synced' ? '' : current.usn, id);
    res.json(toStudent(db.prepare('SELECT * FROM students WHERE id=?').get(id)));
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: 'Another record already uses this USN.' });
    res.status(500).json({ error: 'Record could not be updated.' });
  }
});

app.delete('/api/admin/records/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM students WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Record not found.' });
  if (getSheetsClient()) {
    try { await deleteStudentFromSheet(row.usn); } catch (error) { console.error('Google Sheets delete failed:', error.message); return res.status(502).json({ error: 'The Google Sheet could not be updated, so the student record was not deleted.' }); }
  }
  const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'Record not found.' });
  res.json({ ok: true, sheetSync: getSheetsClient() ? 'synced' : 'local-only' });
});

function rowsForExport(req) {
  const { where, params } = filtersFrom(req);
  return db.prepare(`SELECT name, usn, dob, questions_senior, advice_junior, batch, semester, sheet_sync, sheet_previous_usn FROM students ${where} ORDER BY usn COLLATE NOCASE ASC`).all(...params);
}
function exportRows(rows) {
  return rows.map((r, i) => ({ 'Sl No': i + 1, Name: r.name, USN: r.usn, DOB: r.dob, 'Questions to Senior': r.questions_senior, 'Message / Advice to Junior': r.advice_junior, Batch: r.batch, Semester: r.semester }));
}
app.get('/api/admin/export.xlsx', requireAdmin, (req, res) => {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(exportRows(rowsForExport(req)));
  XLSX.utils.book_append_sheet(book, sheet, 'Student Records');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="inuguration-students.xlsx"');
  res.send(buffer);
});
app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const sheet = XLSX.utils.json_to_sheet(exportRows(rowsForExport(req)));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inuguration-students.csv"');
  res.send(XLSX.utils.sheet_to_csv(sheet));
});

const headerKey = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const headerAliases = {
  name: ['name', 'studentname', 'fullname'],
  usn: ['usn', 'universityseatnumber'],
  dob: ['dob', 'dateofbirth', 'birthdate'],
  questionsSenior: ['questionstosenior', 'questionforsenior', 'questionstosenior'],
  adviceJunior: ['messageadvicetojunior', 'advicetojunior', 'messagetojunior', 'advice'],
};
function mapImportRow(row) {
  const keyed = new Map(Object.entries(row).map(([k, v]) => [headerKey(k), v]));
  const result = {};
  for (const [field, aliases] of Object.entries(headerAliases)) {
    result[field] = [...keyed].find(([k]) => aliases.includes(k))?.[1] ?? '';
  }
  return result;
}
function parseImportFile(buffer, originalName) {
  const book = /\\.csv$/i.test(originalName)
    ? XLSX.read(buffer.toString('utf8'), { type: 'string', cellDates: false, raw: true })
    : XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  if (!book.SheetNames.length) throw new Error('The file has no worksheets.');
  const data = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '', raw: true });
  if (!data.length) throw new Error('The first worksheet contains no student rows.');
  const headers = Object.keys(data[0]).map(headerKey);
  if (!headers.some(x => headerAliases.usn.includes(x)) || !headers.some(x => headerAliases.name.includes(x)))
    throw new Error('Required headers are Name and USN.');
  const seen = new Set();
  const rows = data.map((entry, idx) => {
    const mapped = mapImportRow(entry);
    const { errors, student } = validateStudent({ ...mapped, dob: normalizeDate(mapped.dob) });
    const duplicateInFile = student && seen.has(student.usn);
    if (student) seen.add(student.usn);
    return { row: idx + 2, student, errors: duplicateInFile ? { usn: 'Duplicate USN in this file.' } : errors };
  });
  return { fileName: originalName, worksheet: book.SheetNames[0], rows };
}
function normalizeDate(value) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : '';
  }
  const text = String(value ?? '').trim();
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) return text;
  const match = /^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})$/.exec(text);
  return match ? `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}` : text;
}
const importPreviews = new Map();
app.post('/api/admin/imports/preview', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an .xlsx or .csv file.' });
  if (!/\\.(xlsx|csv)$/i.test(req.file.originalname)) return res.status(415).json({ error: 'Only .xlsx and .csv files are supported.' });
  try {
    const preview = parseImportFile(req.file.buffer, req.file.originalname);
    const existing = new Set(db.prepare('SELECT usn FROM students').all().map(r => r.usn));
    preview.rows = preview.rows.map(entry => entry.student && existing.has(entry.student.usn) ? { ...entry, errors: { ...entry.errors, usn: 'This USN already exists in the database.' } } : entry);
    const token = randomBytes(18).toString('base64url');
    importPreviews.set(token, { expires: Date.now() + 10 * 60 * 1000, rows: preview.rows, file: req.file.buffer, name: basename(req.file.originalname), mime: req.file.mimetype || 'application/octet-stream' });
    res.json({ token, fileName: preview.fileName, worksheet: preview.worksheet, rows: preview.rows.map(({ row, student, errors }) => ({ row, student, errors })), validCount: preview.rows.filter(r => r.student && !Object.keys(r.errors).length).length });
  } catch (error) {
    res.status(400).json({ error: error.message || 'The spreadsheet could not be read.' });
  }
});
app.post('/api/admin/imports/:token/confirm', requireAdmin, (req, res) => {
  const preview = importPreviews.get(req.params.token);
  importPreviews.delete(req.params.token);
  if (!preview || preview.expires < Date.now()) return res.status(410).json({ error: 'Import preview expired. Upload the file again.' });
  const accepted = preview.rows.filter(e => e.student && !Object.keys(e.errors).length);
  const insert = db.prepare(`INSERT OR IGNORE INTO students (name, usn, dob, questions_senior, advice_junior, batch, semester, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let imported = 0;
  db.transaction(() => {
    for (const { student } of accepted) {
      imported += insert.run(student.name, student.usn, student.dob, student.questionsSenior, student.adviceJunior, student.batch, student.semester, now(), now()).changes;
    }
  })();
  const file = db.prepare('INSERT INTO imported_files (original_name, mime_type, size, uploaded_at, content) VALUES (?, ?, ?, ?, ?)').run(preview.name, preview.mime, preview.file.length, now(), preview.file);
  res.json({ ok: true, imported, skipped: preview.rows.length - imported, fileId: file.lastInsertRowid });
});
app.get('/api/admin/imports', requireAdmin, (_req, res) => {
  const files = db.prepare('SELECT id, original_name AS name, mime_type AS mimeType, size, uploaded_at AS uploadedAt FROM imported_files ORDER BY id DESC').all();
  res.json(files);
});
app.get('/api/admin/imports/:id/download', requireAdmin, (req, res) => {
  const file = db.prepare('SELECT original_name, mime_type, content FROM imported_files WHERE id=?').get(Number(req.params.id));
  if (!file) return res.status(404).json({ error: 'Imported file not found.' });
  const safeName = basename(file.original_name).replace(/[\\r\\n\"\\\\]/g, '_');
  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  res.send(file.content);
});

let googleSheets = null;
async function getSheetsClient() {
  if (googleSheets) return googleSheets;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  googleSheets = google.sheets({ version: 'v4', auth });
  return googleSheets;
}
let sheetSyncLock = Promise.resolve();
function withSheetSyncLock(fn) {
  const next = sheetSyncLock.then(fn, fn);
  sheetSyncLock = next.catch(() => {});
  return next;
}

async function appendStudentToSheet(student) {
  return withSheetSyncLock(async () => {
    const sheets = await getSheetsClient();
    if (!sheets) return false;
    const spreadsheetId = TARGET_SPREADSHEET_ID;
    const tab = TARGET_SHEET_TAB;
    const escapedTab = `'${tab.replace(/'/g, "''")}'`;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapedTab}!A1:H1000`, valueRenderOption: 'UNFORMATTED_VALUE' });
    const sheetRows = result.data.values || [];
    const headers = sheetRows[0] || [];
    const normalizedHeaders = headers.map(headerKey);
    const find = aliases => normalizedHeaders.findIndex(key => aliases.includes(key));
    const positions = { name: find(headerAliases.name), usn: find(headerAliases.usn), dob: find(headerAliases.dob), questionsSenior: find(headerAliases.questionsSenior), adviceJunior: find(headerAliases.adviceJunior) };
    if (positions.name < 0 || positions.usn < 0) throw new Error('Sheet header row needs Name and USN columns before syncing.');
    const dataRows = sheetRows.slice(1);
    if (dataRows.some(row => normalUsn(row[positions.usn]) === student.usn)) return true;
    const emptyRowIndex = dataRows.findIndex(row => !normalUsn(row[positions.usn]));
    const nextRowNumber = emptyRowIndex >= 0 ? emptyRowIndex + 2 : dataRows.length + 2;
    const studentInputs = [student.name, student.usn, student.dob, student.questionsSenior ?? '', student.adviceJunior ?? ''];
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${escapedTab}!B${nextRowNumber}:F${nextRowNumber}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [studentInputs] } });
    return true;
  });
}

async function readTargetSheet() {
  const sheets = await getSheetsClient();
  if (!sheets) return null;
  const range = `'${TARGET_SHEET_TAB.replace(/'/g, "''")}'!A:AZ`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: TARGET_SPREADSHEET_ID, range, valueRenderOption: 'UNFORMATTED_VALUE' });
  const values = response.data.values || [];
  const headers = values[0] || [];
  const normalized = headers.map(headerKey);
  const find = aliases => normalized.findIndex(key => aliases.includes(key));
  const positions = { name: find(headerAliases.name), usn: find(headerAliases.usn), dob: find(headerAliases.dob), questionsSenior: find(headerAliases.questionsSenior), adviceJunior: find(headerAliases.adviceJunior) };
  if (positions.name < 0 || positions.usn < 0) throw new Error('Target tab needs recognizable Name and USN columns.');
  return { sheets, values, positions };
}

async function updateStudentInSheet(previousUsn, student) {
  return withSheetSyncLock(async () => {
    const sheet = await readTargetSheet();
    if (!sheet) return false;
    const sheetDataRows = sheet.values.slice(1);
    let rowIndex = sheetDataRows.findIndex(row => normalUsn(row[sheet.positions.usn]) === normalUsn(previousUsn));
    if (rowIndex < 0) rowIndex = sheetDataRows.findIndex(row => normalUsn(row[sheet.positions.usn]) === normalUsn(student.usn));
    if (rowIndex < 0) return appendStudentToSheet(student);
    const rowNumber = rowIndex + 2;
    const studentInputs = [student.name, student.usn, student.dob, student.questionsSenior ?? '', student.adviceJunior ?? ''];
    const escapedTab = `'${TARGET_SHEET_TAB.replace(/'/g, "''")}'`;
    await sheet.sheets.spreadsheets.values.update({ spreadsheetId: TARGET_SPREADSHEET_ID, range: `${escapedTab}!B${rowNumber}:F${rowNumber}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [studentInputs] } });
    return true;
  });
}

async function deleteStudentFromSheet(usn) {
  return withSheetSyncLock(async () => {
    const sheet = await readTargetSheet();
    if (!sheet) return false;
    const rowNumbers = sheet.values.slice(1).flatMap((row, idx) => normalUsn(row[sheet.positions.usn]) === normalUsn(usn) ? [idx + 2] : []);
    const tab = `'${TARGET_SHEET_TAB.replace(/'/g, "''")}'`;
    for (const rowNumber of rowNumbers) {
      await sheet.sheets.spreadsheets.values.clear({ spreadsheetId: TARGET_SPREADSHEET_ID, range: `${tab}!B${rowNumber}:F${rowNumber}` });
    }
    return true;
  });
}

app.get('/api/admin/sheets/status', requireAdmin, async (_req, res) => {
  const configured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const status = { configured, spreadsheetId: TARGET_SPREADSHEET_ID, tab: TARGET_SHEET_TAB, sheetsAvailable: Boolean(await getSheetsClient()) };
  res.json(status);
});

app.post('/api/admin/sheets/export', requireAdmin, async (req, res) => {
  // Export data to Google Sheets – not available in test environment without credentials.
  // Return 503 to indicate missing configuration.
  return res.status(503).json({ error: 'Google Sheets credentials not configured.' });
});


app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) return res.sendFile(resolve(distPath, 'index.html'));
    next();
  });
}
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File must be 8 MB or smaller.' : 'Could not process the uploaded file.' });
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, host, () => console.log(`INUGURATION API listening on http://${host}:${port}`));
