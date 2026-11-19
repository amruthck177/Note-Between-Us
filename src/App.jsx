import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpDown, BarChart3, BookOpen, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Download, Eye, FileSpreadsheet,
  FileUp, Filter, GraduationCap, LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Pencil,
  Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sun, Trash2, Upload, Users, X,
} from 'lucide-react';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'records', label: 'All Student Records', icon: Users },
  { id: '2023', label: '2023 Batch', icon: GraduationCap },
  { id: '2024', label: '2024 Batch', icon: GraduationCap },
  { id: '2025', label: '2025 Batch', icon: GraduationCap },
  { id: 'files', label: 'Excel Files', icon: FileSpreadsheet },
  { id: 'exports', label: 'Export Data', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const emptyStats = { total: 0, batches: { 2023: 0, 2024: 0, 2025: 0 } };
const batchInfo = (usn) => {
  const match = /^4DM(23|24|25)AI\d{3}$/i.exec(String(usn || '').replace(/\s/g, ''));
  if (!match) return null;
  const year = `20${match[1]}`;
  return { batch: year, semester: ({ 2023: 7, 2024: 5, 2025: 3 })[year] };
};
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const latestValidDob = () => { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); };
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S';

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw Object.assign(new Error(result?.error || `Request failed (${response.status})`), { status: response.status, fields: result?.fields });
  return result;
}
function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('inu-theme') === 'dark');
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('inu-theme', dark ? 'dark' : 'light'); }, [dark]);
  return [dark, () => setDark((value) => !value)];
}
function useRoute() {
  const read = () => ({ path: location.pathname, view: new URLSearchParams(location.search).get('view') || 'overview' });
  const [route, setRoute] = useState(read);
  useEffect(() => { const pop = () => setRoute(read()); addEventListener('popstate', pop); return () => removeEventListener('popstate', pop); }, []);
  const navigate = (path, view) => {
    const url = view ? `${path}?view=${encodeURIComponent(view)}` : path;
    history.pushState({}, '', url); setRoute(read()); window.scrollTo(0, 0);
  };
  return [route, navigate];
}

function Logo({ small = false, onClick, active = false }) {
  const symbol = <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 6.5h12a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-5l-4 3v-3.2a4 4 0 0 1-3-3.8v-7a4 4 0 0 1 4-4Z" /><path d="M13.5 11.5h9a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-5l-4 2v-6" /></svg>;
  return <div className={`brand ${small ? 'brand-small' : ''}`}>{onClick ? <button type="button" className={`brand-symbol brand-symbol-trigger ${active ? 'brand-symbol-active' : ''}`} onClick={onClick} aria-label="Toggle administrator portal link" aria-expanded={active}>{symbol}</button> : <div className="brand-symbol">{symbol}</div>}<span>Notes Between Us</span></div>;
}
function StudentHeader({ dark, toggleTheme, navigate, secure = false }) {
  const [adminVisible, setAdminVisible] = useState(false);
  return <header className="student-header"><div className="student-brand-group"><Logo onClick={() => setAdminVisible((visible) => !visible)} active={adminVisible} />{adminVisible && <button className="text-link admin-reveal" onClick={() => navigate('/admin/login')}>Admin sign in <ArrowRight size={14} /></button>}</div><div className="header-actions">{secure && <span className="secure-label"><ShieldCheck size={15} /> Secure student entry</span>}<ThemeButton dark={dark} toggle={toggleTheme} /></div></header>;
}
function ThemeButton({ dark, toggle }) {
  return <button className="icon-btn" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={toggle}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>;
}
function BatchPill({ batch }) { return batch ? <span className={`batch-pill batch-${batch}`}>{batch}</span> : <span>—</span>; }
function Field({ label, error, optional, children, hint }) {
  return <label className="field"><span className="field-label">{label}{optional && <em>Optional</em>}</span>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error">{error}</small>}</label>;
}

function StudentPanel({ navigate, dark, toggleTheme }) {
  const [data, setData] = useState({ name: '', usn: '', dob: '', questionsSenior: '', adviceJunior: '', website: '' });
  const [step, setStep] = useState('form');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const info = batchInfo(data.usn);
  const update = (key, value) => { setData((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: '' })); };
  const submit = async () => {
    setBusy(true); setErrors({});
    try { await api('/api/submissions', { method: 'POST', body: JSON.stringify(data) }); setStep('success'); }
    catch (error) { if (error.fields) { setErrors(error.fields); setStep('form'); } else setErrors({ submit: error.message }); }
    finally { setBusy(false); }
  };
  if (step === 'success') return <div className="student-shell"><StudentHeader dark={dark} toggleTheme={toggleTheme} navigate={navigate} /><main className="success-wrap"><div className="success-card"><div className="success-icon"><Check size={28} /></div><p className="eyebrow">Submission received</p><h1>Thank you, {data.name.split(' ')[0]}.</h1><p>Your information has been saved. Your batch and semester are recorded as <b>{info?.batch} · {info?.semester}{info?.semester === 3 ? 'rd' : 'th'} semester</b>.</p><div className="success-ref"><span>USN</span><strong>{data.usn.toUpperCase()}</strong></div><button className="btn btn-outline btn-wide" onClick={() => { setData({ name: '', usn: '', dob: '', questionsSenior: '', adviceJunior: '', website: '' }); setStep('form'); }}>Return to student form <ArrowRight size={16} /></button></div></main><Footer /></div>;
  return <div className="student-shell">
    <StudentHeader dark={dark} toggleTheme={toggleTheme} navigate={navigate} secure />
    <main className="student-main"><div className="student-intro"><span className="eyebrow"><span className="eyebrow-dot" /> Student portal</span><h1>Welcome to<br /><span>Notes Between Us</span></h1><p>Every question starts a conversation. Every piece of advice makes a difference.</p><div className="semester-note"><BookOpen size={17} /><span>Your batch and semester are automatically identified from your USN.</span></div></div>
      <section className="form-card"><div className="form-head"><div><span className="step-label">YOUR DETAILS</span><h2>Student information</h2></div><span className="step-count">01 <i>/</i> 02</span></div>
        <div className="form-grid"><Field label="Full name" error={errors.name}><input value={data.name} onChange={(e) => update('name', e.target.value)} placeholder="Enter your name" autoComplete="name" maxLength={100} /></Field>
          <Field label="USN" error={errors.usn} hint="Example: 4DM24AI001"><input className="usn-input" value={data.usn} onChange={(e) => update('usn', e.target.value.toUpperCase())} placeholder="4DM24AI001" autoCapitalize="characters" maxLength={11} /></Field>
          <Field label="Date of birth" error={errors.dob}><input type="date" value={data.dob} max={latestValidDob()} onChange={(e) => update('dob', e.target.value)} /></Field>
          <div className={`batch-detect ${info ? 'detected' : ''}`}><div className="detect-icon"><GraduationCap size={19} /></div><div><span>YOUR BATCH &amp; SEMESTER</span><strong>{info ? `${info.batch} Batch · ${info.semester}${info.semester === 3 ? 'rd' : 'th'} Semester` : 'Enter a valid USN to detect'}</strong></div><span className="detect-check">{info && <Check size={15} />}</span></div>
        </div>
        {info?.batch === '2023' && <div className="conversation-fields"><div className="interaction-note"><span>For the next batch</span><p>Leave a helpful message or advice for 2024 and 2025 students.</p></div><Field label="Advice / Messages to Juniors" error={errors.adviceJunior}><textarea rows="4" maxLength={2000} value={data.adviceJunior} onChange={(e) => update('adviceJunior', e.target.value)} placeholder="What do you wish you had known?" /></Field></div>}
        {info?.batch === '2024' && <div className="conversation-fields"><Field label="Questions / Messages to Seniors" error={errors.questionsSenior}><textarea rows="3" maxLength={2000} value={data.questionsSenior} onChange={(e) => update('questionsSenior', e.target.value)} placeholder="What would you like to ask your seniors?" /></Field><Field label="Advice / Messages to Juniors" error={errors.adviceJunior}><textarea rows="3" maxLength={2000} value={data.adviceJunior} onChange={(e) => update('adviceJunior', e.target.value)} placeholder="Share a tip with the students coming after you." /></Field></div>}
        {info?.batch === '2025' && <div className="conversation-fields"><Field label="Questions / Messages to Seniors" error={errors.questionsSenior}><textarea rows="4" maxLength={2000} value={data.questionsSenior} onChange={(e) => update('questionsSenior', e.target.value)} placeholder="What would you like to ask your seniors?" /></Field><p className="form-footnote"><CircleHelp size={15} /> Your question will be shared with the senior batches.</p></div>}
        <input className="honeypot" tabIndex="-1" autoComplete="off" aria-hidden="true" value={data.website} onChange={(e) => update('website', e.target.value)} />
        {errors.submit && <div className="error-banner">{errors.submit}</div>}
        <div className="form-actions"><span><ShieldCheck size={15} /> Your details are only used for this student interaction.</span><button className="btn btn-primary" disabled={!info || busy} onClick={() => { const e = {}; if (data.name.trim().length < 2) e.name = 'Enter your full name.'; if (!info) e.usn = 'Enter a valid USN to continue.'; if (!data.dob || data.dob > latestValidDob()) e.dob = 'Enter a valid date of birth.'; if (info?.batch === '2023' && !data.adviceJunior.trim()) e.adviceJunior = 'Add a message for juniors.'; if (info?.batch === '2024' && !data.questionsSenior.trim()) e.questionsSenior = 'Add a question for your seniors.'; if (info?.batch === '2024' && !data.adviceJunior.trim()) e.adviceJunior = 'Add a message for juniors.'; if (info?.batch === '2025' && !data.questionsSenior.trim()) e.questionsSenior = 'Add a question for your seniors.'; setErrors(e); if (!Object.keys(e).length) setStep('review'); }}>Review details <ArrowRight size={16} /></button></div>
      </section>
      <p className="student-privacy"><span><ShieldCheck size={14} /></span> Your submission is saved securely and cannot be changed after submitting. If you need a correction, contact an administrator.</p>
    </main><Footer />
    {step === 'review' && <Modal title="Review your submission" close={() => setStep('form')}><div className="review-card"><div className="review-row"><span>Full name</span><b>{data.name}</b></div><div className="review-row"><span>USN</span><b>{data.usn.toUpperCase()}</b></div><div className="review-row"><span>Date of birth</span><b>{dateLabel(data.dob)}</b></div><div className="review-row"><span>Batch / semester</span><b>{info.batch} · {info.semester}{info.semester === 3 ? 'rd' : 'th'}</b></div>{data.questionsSenior && <div className="review-row stacked"><span>Questions / Messages to Seniors</span><b>{data.questionsSenior}</b></div>}{data.adviceJunior && <div className="review-row stacked"><span>Advice / Messages to Juniors</span><b>{data.adviceJunior}</b></div>}</div><p className="modal-hint">Once submitted, you won't be able to edit these details.</p><div className="modal-actions"><button className="btn btn-outline" onClick={() => setStep('form')}><ArrowLeft size={15} /> Make changes</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit information'} {!busy && <ArrowRight size={15} />}</button></div></Modal>}
  </div>;
}
function Footer() { return <footer className="app-footer"><span>© {new Date().getFullYear()} Notes Between Us</span><span>Ask a little. Share a little. Learn together.</span></footer>; }

function Modal({ title, children, close, wide = false }) {
  useEffect(() => { const esc = (e) => e.key === 'Escape' && close(); addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [close]);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={close}><X size={17} /></button></header><div className="modal-body">{children}</div></section></div>;
}

function AdminLogin({ navigate, dark, toggleTheme }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const signIn = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ email, password }) }); navigate('/admin', 'overview'); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="login-page"><header className="student-header"><button className="bare-brand" onClick={() => navigate('/student')}><Logo /></button><div className="header-actions"><ThemeButton dark={dark} toggle={toggleTheme} /><button className="text-link" onClick={() => navigate('/student')}>Student portal <ArrowRight size={14} /></button></div></header><main className="login-wrap"><div className="login-aside"><span className="eyebrow"><ShieldCheck size={14} /> ADMIN ACCESS</span><h1>Notes Between<br /><span>Us</span></h1><p>Notes Between Us is a space where juniors can ask questions and share messages with seniors, while seniors can offer advice, experiences, and guidance to juniors.</p><div className="login-proof"><div className="proof-icon"><Check size={15} /></div><span>Private administrator workspace</span></div></div><form className="login-card" onSubmit={signIn}><div className="login-emblem"><ShieldCheck size={23} /></div><span className="eyebrow">WELCOME BACK</span><h2>Admin sign in</h2><p>Use your administrator credentials to continue.</p><Field label="Admin email"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@college.edu" /></Field><Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" /></Field>{error && <div className="error-banner">{error}</div>}<button className="btn btn-primary btn-wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={16} /></button><div className="login-secure"><ShieldCheck size={14} /> Protected admin session</div></form></main><Footer /></div>;
}

function AdminApp({ route, navigate, dark, toggleTheme }) {
  const [admin, setAdmin] = useState(null); const [authLoading, setAuthLoading] = useState(true); const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(emptyStats); const [records, setRecords] = useState([]); const [listLoading, setListLoading] = useState(false); const [total, setTotal] = useState(0); const [pages, setPages] = useState(1); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(''); const [batch, setBatch] = useState(['2023', '2024', '2025'].includes(route.view) ? route.view : ''); const [semester, setSemester] = useState(''); const [sort, setSort] = useState('usn'); const [direction, setDirection] = useState('asc'); const [sheetStatus, setSheetStatus] = useState(null); const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null); const [editing, setEditing] = useState(false); const [editData, setEditData] = useState({}); const [confirmDelete, setConfirmDelete] = useState(null); const pageSize = 20;
  const view = route.view || 'overview';
  useEffect(() => {
    const focusSearch = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (!['records', '2023', '2024', '2025'].includes(view)) return;
      const input = document.querySelector('.records-panel .searchbox input');
      if (input) { event.preventDefault(); input.focus(); input.select(); }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [view]);
  useEffect(() => { api('/api/admin/session').then(setAdmin).catch(() => setAdmin(null)).finally(() => setAuthLoading(false)); }, []);
  const loadStats = useCallback(() => api('/api/admin/stats').then(setStats).catch(() => {}), []);
  const loadSheet = useCallback(() => api('/api/admin/sheets/status').then(setSheetStatus).catch(() => {}), []);
  const loadRecords = useCallback(async () => {
    if (!admin) return;
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, direction });
    if (search.trim()) params.set('search', search.trim()); if (batch) params.set('batch', batch); if (semester) params.set('semester', semester);
    try { const result = await api(`/api/admin/records?${params}`); setRecords(result.rows); setTotal(result.total); setPages(Math.max(1, result.pages)); }
    catch (error) { setNotice(error.message); } finally { setListLoading(false); }
  }, [admin, page, search, batch, semester, sort, direction]);
  useEffect(() => { if (admin) { loadStats(); loadSheet(); } }, [admin, loadStats, loadSheet]);
  useEffect(() => { const timer = setTimeout(loadRecords, 220); return () => clearTimeout(timer); }, [loadRecords]);
  useEffect(() => { if (['2023', '2024', '2025'].includes(view)) setBatch(view); else if (view === 'records' || view === 'overview') setBatch(''); }, [view]);
  useEffect(() => { setPage(1); }, [search, batch, semester, sort, direction]);
  const selectView = (id) => { setSidebarOpen(false); if (id === 'exports') { navigate('/admin', 'exports'); setBatch(''); } else { navigate('/admin', id); setBatch(['2023', '2024', '2025'].includes(id) ? id : ''); } };
  const refresh = async () => { await Promise.all([loadStats(), loadSheet(), loadRecords()]); };
  const logout = async () => { try { await api('/api/admin/session', { method: 'DELETE' }); } finally { setAdmin(null); navigate('/admin/login'); } };
  const exportFile = async (type) => {
    const params = new URLSearchParams(); if (search) params.set('search', search); if (batch) params.set('batch', batch); if (semester) params.set('semester', semester);
    try { const response = await fetch(`/api/admin/export.${type}?${params}`, { credentials: 'same-origin' }); if (!response.ok) throw new Error('Export could not be created.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `notes-between-us-students.${type}`; link.click(); URL.revokeObjectURL(url); setNotice(`Your ${type.toUpperCase()} export is ready.`); }
    catch (error) { setNotice(error.message); }
  };
  const openRecord = async (row, edit = false) => { try { const full = await api(`/api/admin/records/${row.id}`); setSelected(full); setEditData({ ...full }); setEditing(edit); } catch (error) { setNotice(error.message); } };
  const saveRecord = async () => { try { const result = await api(`/api/admin/records/${selected.id}`, { method: 'PATCH', body: JSON.stringify(editData) }); setNotice(result.sheetSync === 'synced' ? 'Student record updated in the dashboard and Google Sheet.' : 'Student record updated in the dashboard, but Google Sheets did not sync. Check Settings or export again after connecting.'); setEditing(false); setSelected(null); refresh(); } catch (error) { setNotice(error.message); } };
  const deleteRecord = async () => { try { const result = await api(`/api/admin/records/${confirmDelete.id}`, { method: 'DELETE' }); setConfirmDelete(null); setSelected(null); setNotice(result.sheetSync === 'synced' ? 'Student record deleted from the dashboard and Google Sheet.' : 'Student record deleted from the dashboard. Google Sheets is not connected.'); refresh(); } catch (error) { setNotice(error.message); } };

  if (authLoading) return <div className="loading-screen"><Logo /><span>Checking admin session…</span></div>;
  if (!admin) return <AdminLogin navigate={navigate} dark={dark} toggleTheme={toggleTheme} />;
  const heading = NAV.find((item) => item.id === view)?.label || 'Overview';
  return <div className="admin-layout">
    <aside className={`admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Logo /><button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={17} /></button></div><div className="nav-caption">WORKSPACE</div><nav className="admin-nav">{NAV.map((item) => { const Icon = item.icon; const active = item.id === view || (item.id === 'records' && ['2023', '2024', '2025'].includes(view)); return <button key={item.id} className={`nav-item ${active ? 'active' : ''}`} aria-label={item.label} title={item.label} onClick={() => selectView(item.id)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'records' && <ChevronRight className="nav-chevron" size={15} />}</button>; })}</nav><div className="sidebar-bottom"><div className="sidebar-support"><div className="support-icon"><CircleHelp size={16} /></div><div><b>Need a hand?</b><span>Contact your workspace admin</span></div><ArrowRight size={14} /></div><button className="student-shortcut" onClick={() => navigate('/student')}><GraduationCap size={17} /><span>Student portal</span><ArrowRight size={14} /></button><div className="side-user"><div className="user-avatar">{initials(admin.email)}</div><div className="user-meta"><b>{admin.email.split('@')[0]}</b><span>Administrator</span></div><button className="icon-btn logout-btn" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div></div></aside>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <div className="admin-main"><header className="admin-topbar"><div className="topbar-left"><button className="icon-btn menu-toggle" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumb"><span>Notes Between Us</span><ChevronRight size={14} /><b>{heading}</b></div></div><div className="topbar-right"><span className="topbar-date">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span><ThemeButton dark={dark} toggleTheme={toggleTheme} /><span className="topbar-divider" /><div className="top-user"><div className="user-avatar">{initials(admin.email)}</div><span>{admin.email.split('@')[0]}</span></div></div></header>
      <main className="admin-content">
        {notice && <div className="toast" role="status"><CheckCircle2 size={17} />{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {view === 'overview' && <Overview stats={stats} records={records} sheetStatus={sheetStatus} navigate={selectView} openRecord={openRecord} />}
        {(view === 'records' || ['2023', '2024', '2025'].includes(view)) && <RecordsView title={heading} batch={batch} setBatch={setBatch} semester={semester} setSemester={setSemester} search={search} setSearch={setSearch} records={records} loading={listLoading} total={total} pages={pages} page={page} setPage={setPage} sort={sort} direction={direction} setSort={setSort} setDirection={setDirection} openRecord={openRecord} exportFile={exportFile} refresh={refresh} />}
        {view === 'files' && <FilesView refresh={refresh} />}
        {view === 'exports' && <ExportsView batch={batch} setBatch={setBatch} semester={semester} setSemester={setSemester} search={search} setSearch={setSearch} exportFile={exportFile} total={total} sheetStatus={sheetStatus} refreshSheet={loadSheet} setNotice={setNotice} />}
        {view === 'settings' && <SettingsView sheetStatus={sheetStatus} loadSheet={loadSheet} />}
      </main>
    </div>
    {selected && <RecordModal record={selected} editing={editing} data={editData} setData={setEditData} close={() => { setSelected(null); setEditing(false); }} save={saveRecord} edit={() => setEditing(true)} remove={() => setConfirmDelete(selected)} />}
    {confirmDelete && <Modal title="Delete student record?" close={() => setConfirmDelete(null)}><p className="delete-copy">This removes <b>{confirmDelete.name}</b> ({confirmDelete.usn}) from the application database. This action cannot be undone.</p><div className="modal-actions"><button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="btn btn-danger" onClick={deleteRecord}><Trash2 size={15} /> Delete record</button></div></Modal>}
  </div>;
}

function PageTitle({ eyebrow = 'STUDENT DATA', title, description, action }) { return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function StatCard({ label, value, accent, icon: Icon, note }) { return <article className={`stat-card ${accent || ''}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={17} /></div></div><strong>{value.toLocaleString()}</strong><small>{note}</small></article>; }
function Overview({ stats, records, sheetStatus, navigate, openRecord }) {
  const max = Math.max(1, stats.batches[2023], stats.batches[2024], stats.batches[2025]);
  return <><PageTitle eyebrow="ADMIN WORKSPACE" title="Overview" description="A live snapshot of student submissions across every batch." action={<button className="btn btn-primary" onClick={() => navigate('records')}><Users size={16} /> View all records <ArrowRight size={16} /></button>} />
    <div className="stats-grid"><StatCard label="Total submissions" value={stats.total} icon={ClipboardList} note="All student records" /><StatCard label="2023 batch" value={stats.batches[2023]} accent="stat-blue" icon={GraduationCap} note="7th semester" /><StatCard label="2024 batch" value={stats.batches[2024]} accent="stat-green" icon={GraduationCap} note="5th semester" /><StatCard label="2025 batch" value={stats.batches[2025]} accent="stat-purple" icon={GraduationCap} note="3rd semester" /></div>
    <div className="overview-grid"><section className="panel batch-panel"><div className="panel-heading"><div><h2>Submissions by batch</h2><p>Distribution from saved student records</p></div><button className="icon-btn" aria-label="View batch records" onClick={() => navigate('records')}><MoreHorizontal size={18} /></button></div><div className="batch-chart">{[['2023', stats.batches[2023], 'chart-blue'], ['2024', stats.batches[2024], 'chart-green'], ['2025', stats.batches[2025], 'chart-purple']].map(([year, value, cls]) => <div className="chart-row" key={year}><div className="chart-caption"><BatchPill batch={year} /><b>{value}</b></div><div className="chart-track"><div className={cls} style={{ width: `${Math.max(value ? 4 : 0, value / max * 100)}%` }} /></div></div>)}</div><div className="chart-foot"><span><span className="legend-dot" /> Stored submissions</span><span>{stats.total} total</span></div></section>
      <section className="panel source-panel"><div className="panel-heading"><div><h2>Google Sheets sync</h2><p>Server-side connection status</p></div><span className={`sync-state ${sheetStatus?.configured ? 'sync-on' : ''}`}><i />{sheetStatus?.configured ? 'Connected' : 'Setup needed'}</span></div><div className="source-detail"><div className="sheet-badge"><FileSpreadsheet size={21} /></div><div><b>INUGURATION spreadsheet</b><span>{sheetStatus?.tab || 'Enter Student Data'}</span></div></div><div className="sync-metrics"><div><span>Synced</span><b>{sheetStatus?.synced ?? 0}</b></div><div><span>Pending</span><b>{sheetStatus?.pending ?? stats.total}</b></div></div><button className="subtle-link" onClick={() => navigate('settings')}>Configure connection <ArrowRight size={14} /></button></section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Student submissions</h2><p>First five records in ascending USN order.</p></div><button className="subtle-link" onClick={() => navigate('records')}>All records <ArrowRight size={14} /></button></div><RecordTable rows={records.slice(0, 5)} loading={false} openRecord={openRecord} compact /><div className="recent-foot">Rows follow ascending USN order <span>·</span> {stats.total} students</div></section>
  </>;
}

function RecordsView({ title, batch, setBatch, semester, setSemester, search, setSearch, records, loading, total, pages, page, setPage, sort, direction, setSort, setDirection, openRecord, exportFile, refresh }) {
  const chooseSort = (key) => { if (sort === key) setDirection(direction === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDirection('asc'); } };
  return <><PageTitle eyebrow={batch ? `${batch} BATCH` : 'ADMIN WORKSPACE'} title={batch ? `${batch} batch` : title} description="Search, filter, and manage student details. Default order is ascending by complete USN." action={<><button className="btn btn-outline" onClick={refresh}><SlidersHorizontal size={15} /> Refresh</button><button className="btn btn-primary" onClick={() => exportFile('xlsx')}><Download size={15} /> Export</button></>} />
    <section className="panel records-panel"><div className="records-toolbar"><label className="searchbox"><Search size={16} /><input placeholder="Search name or USN…" value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'}</kbd></label><div className="toolbar-filters"><label className="select-wrap"><Filter size={14} /><select aria-label="Filter by batch" value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">All batches</option><option value="2023">2023 batch</option><option value="2024">2024 batch</option><option value="2025">2025 batch</option></select><ChevronDown size={14} /></label><label className="select-wrap"><select aria-label="Filter by semester" value={semester} onChange={(e) => setSemester(e.target.value)}><option value="">All semesters</option><option value="7">7th semester</option><option value="5">5th semester</option><option value="3">3rd semester</option></select><ChevronDown size={14} /></label><button className="icon-btn mobile-filter" onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')} aria-label="Toggle sort order"><ArrowUpDown size={16} /></button></div></div>
      <div className="table-meta"><span><b>{total}</b> records</span><span>Sorted by <button onClick={() => chooseSort('usn')}>USN {sort === 'usn' ? direction === 'asc' ? '↑' : '↓' : '↑'}</button></span></div>
      <div className="table-scroll"><RecordTable rows={records} loading={loading} openRecord={openRecord} sort={sort} direction={direction} chooseSort={chooseSort} serialStart={(page - 1) * 20} /></div>
      <div className="pagination"><span>Showing <b>{total ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)}</b> of <b>{total}</b> records</span><div><button className="icon-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span className="page-indicator">Page <b>{page}</b> of {pages}</span><button className="icon-btn" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></div>
    </section>
  </>;
}
function RecordTable({ rows, loading, openRecord, sort, direction, chooseSort, compact = false, serialStart = 0 }) {
  const headers = [['usn', 'USN'], ['name', 'Student'], ['dob', 'Date of birth'], ['questionsSenior', 'Questions / Messages to Seniors'], ['adviceJunior', 'Advice / Messages to Juniors'], ['batch', 'Batch'], ['semester', 'Semester']];
  if (loading) return <div className="table-state"><span className="spinner" /> Loading student records…</div>;
  if (!rows.length) return <div className="table-empty"><div className="empty-icon"><Users size={20} /></div><b>No student records yet</b><span>New student submissions will appear here.</span></div>;
  return <table className={`records-table ${compact ? 'compact-table' : ''}`}><thead><tr><th className="serial-col">Sl No</th>{headers.map(([key, label]) => <th key={key}><button className="th-sort" onClick={() => chooseSort?.(key)}>{label}{key === sort && (direction === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />)}</button></th>)}<th aria-label="Actions" /></tr></thead><tbody>{rows.map((row, i) => <tr key={row.id} onDoubleClick={() => openRecord(row)}><td className="serial-col">{serialStart + i + 1}</td><td className="usn-cell"><button onClick={() => openRecord(row)}>{row.usn}</button></td><td><button className="name-cell" onClick={() => openRecord(row)}><span className="student-avatar">{initials(row.name)}</span><span><b>{row.name}</b><small>{row.usn}</small></span></button></td><td>{dateLabel(row.dob)}</td><td className="message-cell" title={row.questionsSenior}>{row.questionsSenior || <span className="no-value">—</span>}</td><td className="message-cell" title={row.adviceJunior}>{row.adviceJunior || <span className="no-value">—</span>}</td><td><BatchPill batch={row.batch} /></td><td>{row.semester}<sup>{row.semester === 3 ? 'rd' : 'th'}</sup></td><td><button className="row-action" aria-label={`View ${row.name}`} onClick={() => openRecord(row)}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>;
}

function RecordModal({ record, editing, data, setData, close, save, edit, remove }) {
  const info = batchInfo(data.usn || record.usn);
  return <Modal title={editing ? 'Edit student details' : 'Student details'} close={close} wide><div className="detail-banner"><span className="student-avatar big">{initials(record.name)}</span><div><span className="eyebrow">{record.batch} BATCH</span><h3>{record.name}</h3><span>{record.usn}</span></div><BatchPill batch={record.batch} /></div>
    {editing ? <div className="edit-grid"><Field label="Full name"><input value={data.name || ''} onChange={(e) => setData({ ...data, name: e.target.value })} /></Field><Field label="USN"><input value={data.usn || ''} onChange={(e) => setData({ ...data, usn: e.target.value.toUpperCase() })} /></Field><Field label="Date of birth"><input type="date" value={data.dob || ''} onChange={(e) => setData({ ...data, dob: e.target.value })} /></Field><div className="edit-derived"><GraduationCap size={16} /> {info ? `${info.batch} batch · semester ${info.semester}` : 'Invalid USN'}</div><Field label="Questions / Messages to Seniors" optional><textarea rows="3" value={data.questionsSenior || ''} onChange={(e) => setData({ ...data, questionsSenior: e.target.value })} /></Field><Field label="Advice / Messages to Juniors" optional><textarea rows="3" value={data.adviceJunior || ''} onChange={(e) => setData({ ...data, adviceJunior: e.target.value })} /></Field></div> : <div className="detail-grid"><Detail label="Date of birth" value={dateLabel(record.dob)} /><Detail label="Batch" value={<BatchPill batch={record.batch} />} /><Detail label="Semester" value={`${record.semester}${record.semester === 3 ? 'rd' : 'th'} semester`} /><Detail label="Submitted" value={new Date(record.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} /><Detail label="Questions / Messages to Seniors" value={record.questionsSenior || 'No response'} wide /><Detail label="Advice / Messages to Juniors" value={record.adviceJunior || 'No response'} wide /><Detail label="Google Sheets sync" value={<span className={`sync-state compact-sync ${record.sheetSync === 'synced' ? 'sync-on' : ''}`}><i />{record.sheetSync || 'pending'}</span>} /></div>}
    <div className="modal-actions">{editing ? <><button className="btn btn-outline" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={save}><Check size={15} /> Save changes</button></> : <><button className="btn btn-danger-outline" onClick={remove}><Trash2 size={15} /> Delete</button><button className="btn btn-outline" onClick={edit}><Pencil size={15} /> Edit record</button><button className="btn btn-primary" onClick={close}>Done</button></>}</div>
  </Modal>;
}
function Detail({ label, value, wide }) { return <div className={`detail-item ${wide ? 'detail-wide' : ''}`}><span>{label}</span><b>{value}</b></div>; }

function FilesView({ refresh }) {
  const [file, setFile] = useState(null); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [query, setQuery] = useState(''); const [batchFilter, setBatchFilter] = useState(''); const [ascending, setAscending] = useState(true); const [files, setFiles] = useState([]); const [filesLoading, setFilesLoading] = useState(true); const [filesError, setFilesError] = useState('');
  const loadFiles = useCallback(async () => { setFilesLoading(true); setFilesError(''); try { setFiles(await api('/api/admin/imports')); } catch (err) { setFilesError(err.message); } finally { setFilesLoading(false); } }, []);
  useEffect(() => { loadFiles(); }, [loadFiles]);
  const choose = async (event) => { const selected = event.target.files?.[0]; if (!selected) return; setFile(selected); setError(''); setBusy(true); const body = new FormData(); body.append('file', selected); try { setPreview(await api('/api/admin/imports/preview', { method: 'POST', body })); } catch (err) { setError(err.message); setPreview(null); } finally { setBusy(false); event.target.value = ''; } };
  const confirm = async () => { setBusy(true); try { const result = await api(`/api/admin/imports/${preview.token}/confirm`, { method: 'POST', body: '{}' }); setError(`${result.imported} records imported. ${result.skipped} skipped. Original file saved for administrators.`); setPreview(null); setFile(null); refresh(); loadFiles(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const visibleRows = useMemo(() => (preview?.rows || []).filter(({ student }) => (!query || `${student?.name || ''} ${student?.usn || ''}`.toLowerCase().includes(query.toLowerCase())) && (!batchFilter || student?.batch === batchFilter)).sort((a, b) => { const result = (a.student?.usn || '').localeCompare(b.student?.usn || ''); return ascending ? result : -result; }), [preview, query, batchFilter, ascending]);
  const exportPreview = () => { const cols = ['Name', 'USN', 'DOB', 'Questions to Senior', 'Message / Advice to Junior', 'Batch', 'Semester']; const quote = (value) => { const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""'); return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`; }; const body = [cols.join(','), ...visibleRows.filter((r) => r.student).map(({ student }) => [student.name, student.usn, student.dob, student.questionsSenior, student.adviceJunior, student.batch, student.semester].map(quote).join(','))].join('\r\n'); const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'notes-between-us-import-preview.csv'; link.click(); URL.revokeObjectURL(url); };
  const fmtSize = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return <><PageTitle eyebrow="DATA MANAGEMENT" title="Excel files" description="Preview, validate, and import .xlsx or .csv student records." action={<label className="btn btn-primary upload-trigger"><Upload size={15} /> Choose a file<input type="file" accept=".xlsx,.csv" onChange={choose} hidden /></label>} />
    <section className="panel upload-panel"><div className="upload-drop"><div className="upload-art"><FileUp size={22} /></div><div><h2>Import a student spreadsheet</h2><p>We check required headers, USN format, duplicate rows, and batch rules before saving anything.</p><div className="upload-meta"><span>.XLSX or .CSV</span><i /> Up to 8 MB <i /> Preview before import</div></div><label className="btn btn-outline">Browse files<input type="file" accept=".xlsx,.csv" onChange={choose} hidden /></label></div>{error && <div className={`import-message ${preview ? '' : 'import-error'}`}><CheckCircle2 size={16} />{error}<button onClick={() => setError('')}><X size={14} /></button></div>}</section>
    {busy && !preview && <div className="panel table-state"><span className="spinner" /> Reading spreadsheet…</div>}
    {preview && <section className="panel import-preview"><div className="panel-heading"><div><h2>Import preview</h2><p>{file?.name || 'Selected spreadsheet'} · {preview.worksheet} worksheet · {preview.validCount} ready to import</p></div><div className="preview-actions"><button className="btn btn-outline" onClick={exportPreview}><Download size={14} /> Export filtered</button><button className="btn btn-primary" onClick={confirm} disabled={!preview.validCount || busy}><Check size={15} /> Import {preview.validCount} valid rows</button></div></div><div className="records-toolbar"><label className="searchbox"><Search size={15} /><input placeholder="Search this file…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="toolbar-filters"><label className="select-wrap"><select aria-label="Filter imported rows by batch" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}><option value="">All batches</option><option value="2023">2023 batch</option><option value="2024">2024 batch</option><option value="2025">2025 batch</option></select><ChevronDown size={14} /></label><button className="btn btn-outline" onClick={() => setAscending(!ascending)}><ArrowUpDown size={14} /> USN {ascending ? '↑' : '↓'}</button></div></div><div className="table-scroll"><table className="records-table"><thead><tr><th>File row</th><th>Name</th><th>USN</th><th>DOB</th><th>Batch</th><th>Semester</th><th>Validation</th></tr></thead><tbody>{visibleRows.map((item) => <tr key={item.row}><td>{item.row}</td><td>{item.student?.name || '—'}</td><td className="usn-cell">{item.student?.usn || '—'}</td><td>{dateLabel(item.student?.dob)}</td><td>{item.student?.batch ? <BatchPill batch={item.student.batch} /> : '—'}</td><td>{item.student?.semester || '—'}</td><td>{Object.keys(item.errors || {}).length ? <span className="validation-bad" title={Object.values(item.errors).join(' ')}><X size={13} /> Needs review</span> : <span className="validation-good"><Check size={13} /> Ready</span>}</td></tr>)}</tbody></table></div></section>}
    <section className="panel saved-files"><div className="panel-heading"><div><h2>Available Excel files</h2><p>Imported source files are stored privately for administrator access.</p></div><span className="preview-count">{files.length} files</span></div>{filesLoading ? <div className="table-state"><span className="spinner" /> Loading imported files…</div> : filesError ? <div className="import-message import-error" role="alert"><span>{filesError}</span><button className="text-link" onClick={loadFiles}>Retry</button></div> : !files.length ? <div className="files-empty"><FileSpreadsheet size={19} /><span>No spreadsheets imported yet.</span></div> : <div className="saved-file-list">{files.map((item) => <div className="saved-file-row" key={item.id}><div className="saved-file-icon"><FileSpreadsheet size={17} /></div><div className="saved-file-name"><b>{item.name}</b><span>{new Date(item.uploadedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} <i>·</i> {fmtSize(item.size)}</span></div><a className="icon-btn" aria-label={`Download ${item.name}`} href={`/api/admin/imports/${item.id}/download`}><Download size={16} /></a></div>)}</div>}</section>
    <section className="panel import-notes"><div className="note-icon"><ShieldCheck size={17} /></div><div><b>Safe import behavior</b><p>Existing USNs are skipped. The preview marks any row with an invalid or duplicate USN, missing required fields, or an existing record. No existing student data is overwritten.</p></div></section>
  </>;
}
function ExportsView({ batch, setBatch, semester, setSemester, search, setSearch, exportFile, total, sheetStatus, refreshSheet, setNotice }) {
  const [sheetBusy, setSheetBusy] = useState(false);
  const exportToGoogleSheet = async () => {
    setSheetBusy(true);
    const params = new URLSearchParams(); if (search.trim()) params.set('search', search.trim()); if (batch) params.set('batch', batch); if (semester) params.set('semester', semester);
    try { const result = await api(`/api/admin/sheets/export?${params}`, { method: 'POST', body: '{}' }); setNotice(result.message); await refreshSheet(); }
    catch (error) { setNotice(error.message); }
    finally { setSheetBusy(false); }
  };
  return <><PageTitle eyebrow="DATA MANAGEMENT" title="Export data" description="Create filtered reports from the application’s stored records." />
    <div className="export-grid"><section className="panel export-filter-panel"><div className="panel-heading"><div><h2>Choose your dataset</h2><p>Only records matching the selected filters are included.</p></div><SlidersHorizontal size={18} /></div><div className="export-filters"><Field label="Search name or USN"><div className="input-icon"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student records" /></div></Field><Field label="Batch"><select value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">All batches</option><option value="2023">2023 batch</option><option value="2024">2024 batch</option><option value="2025">2025 batch</option></select></Field><Field label="Semester"><select value={semester} onChange={(e) => setSemester(e.target.value)}><option value="">All semesters</option><option value="7">7th semester</option><option value="5">5th semester</option><option value="3">3rd semester</option></select></Field></div><div className="export-selection"><span>Matching records</span><b>{total}</b></div></section><section className="panel export-format-panel"><div className="panel-heading"><div><h2>Export destination</h2><p>Download a copy or add rows to your connected Google Sheet.</p></div></div><button className="export-option" onClick={() => exportFile('xlsx')}><span className="file-type xlsx">XLS</span><span><b>Excel workbook</b><small>Formatted .xlsx spreadsheet</small></span><Download size={17} /></button><button className="export-option" onClick={() => exportFile('csv')}><span className="file-type csv">CSV</span><span><b>CSV file</b><small>Comma-separated values</small></span><Download size={17} /></button><button className="export-option" disabled={!sheetStatus?.configured || sheetBusy} onClick={exportToGoogleSheet}><span className="file-type xlsx"><FileSpreadsheet size={16} /></span><span><b>{sheetBusy ? 'Exporting…' : 'Export to Google Sheet'}</b><small>{sheetStatus?.configured ? 'Append new USNs to Enter Student Data' : 'Add server credentials in Settings to enable'}</small></span><ArrowRight size={17} /></button><div className="export-security"><ShieldCheck size={15} /> This action and all export data are restricted to authenticated administrators. Existing USNs are skipped.</div></section></div>
  </>;
}
function SettingsView({ sheetStatus, loadSheet }) {
  const [config, setConfig] = useState(null); const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { api('/api/config').then(setConfig).catch(() => setConfig({ googleSheetsConfigured: false })); }, []);
  const check = async () => { setLoading(true); await loadSheet(); setLoading(false); };
  const runSheetAction = async (path) => { setLoading(true); setMessage(''); try { const result = await api(path, { method: 'POST', body: '{}' }); setMessage(result.message || `${result.synced ?? result.imported ?? 0} rows processed. ${result.remaining ?? result.skipped ?? 0} skipped or still pending.`); await loadSheet(); } catch (error) { setMessage(error.message); } finally { setLoading(false); } };
  return <><PageTitle eyebrow="WORKSPACE" title="Settings" description="Connection status and administrator workspace details." />
    <section className="panel settings-section"><div className="settings-title"><div className="settings-symbol"><FileSpreadsheet size={19} /></div><div><h2>Google Sheets integration</h2><p>Server-side sync with the existing INUGURATION spreadsheet.</p></div><span className={`sync-state ${sheetStatus?.configured ? 'sync-on' : ''}`}><i />{sheetStatus?.configured ? 'Connected' : 'Not configured'}</span></div>
      <div className="settings-rows"><div><span>Spreadsheet ID</span><b>{sheetStatus?.spreadsheetId || '1qmC2UCeR_bFcLc9rsLpneTaEKR7ym4c1nKWHVulw2XQ'}</b></div><div><span>Target tab</span><b>{sheetStatus?.tab || 'Enter Student Data'}</b></div><div><span>Service account credentials</span><b>{config?.googleSheetsConfigured ? 'Available on server' : 'Not provided'}</b></div><div><span>Database sync</span><b>Application database is primary; sheet sync is append-only</b></div></div>
      <div className="settings-callout"><ShieldCheck size={16} /><p>Credentials must be set in the server’s private <code>.env</code> file. New submissions append to the fixed tab. Dashboard edits update the row matched by USN, and deletes clear its row contents. If a sync fails, check the connection and use Export data to retry pending edits.</p></div>
      <div className="settings-actions"><button className="btn btn-outline" onClick={check} disabled={loading}>{loading ? 'Checking…' : 'Refresh status'}</button><button className="btn btn-outline" disabled={loading || !sheetStatus?.configured} onClick={() => runSheetAction('/api/admin/sheets/import-existing')}>Import existing sheet rows</button><button className="btn btn-primary" disabled={loading || !sheetStatus?.configured || !sheetStatus.pending} onClick={() => runSheetAction('/api/admin/sheets/sync-pending')}>{loading ? 'Working…' : 'Retry pending sync'}</button></div>{message && <div className="import-message"><CheckCircle2 size={16} />{message}</div>}
    </section><section className="panel settings-section"><div className="settings-title"><div className="settings-symbol theme-symbol"><Sun size={18} /></div><div><h2>Appearance</h2><p>Choose a comfortable display theme.</p></div></div><p className="settings-body">Use the theme switch in the top bar. Your preference is saved in this browser.</p></section>
  </>;
}

export default function App() {
  const [route, navigate] = useRoute(); const [dark, toggleTheme] = useTheme();
  if (route.path === '/admin/login') return <AdminLogin navigate={navigate} dark={dark} toggleTheme={toggleTheme} />;
  if (route.path.startsWith('/admin')) return <AdminApp route={route} navigate={navigate} dark={dark} toggleTheme={toggleTheme} />;
  return <StudentPanel navigate={navigate} dark={dark} toggleTheme={toggleTheme} />;
}
