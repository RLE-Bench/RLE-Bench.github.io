import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { createWorker, hash } from '../src/worker.mjs';
import { validateZip } from '../src/zip.mjs';

const migrationNames = (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort();
const migration = (await Promise.all(migrationNames.map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')))).join('\n');
const template = new Uint8Array(await readFile(new URL('../../assets/contrib/rlebench-harbor-template.zip', import.meta.url)));
const origin = 'https://rlebench-submissions.example.workers.dev';
const seconds = () => Math.floor(Date.now() / 1000);
class Database {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec('PRAGMA foreign_keys = ON;'); this.sqlite.exec(migration); }
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return db.sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: db.sqlite.prepare(sql).all(...values) }; },
      async run() { const result = db.sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } }; }
    };
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const result = []; for (const statement of statements) result.push(await statement.run()); this.sqlite.exec('COMMIT'); return result; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
function setup(t, githubFetch) {
  const DB = new Database(), objects = new Map();
  t.after(() => DB.sqlite.close());
  const env = {
    APP_ORIGIN: origin, GITHUB_CLIENT_ID: 'test-client-id', GITHUB_CLIENT_SECRET: 'test-secret', REVIEWER_IDS: '44082254,41679605,87316432', MAX_UPLOAD_BYTES: '26214400', DB,
    SUBMISSIONS_BUCKET: {
      async head(key) { return objects.has(key) ? { size: objects.get(key).length } : null; },
      async put(key, bytes) { objects.set(key, new Uint8Array(bytes)); return {}; },
      async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }
    },
    ASSETS: { async fetch() { return new Response('<!doctype html><title>Task submissions</title>', { headers: { 'Content-Type': 'text/html' } }); } }
  };
  const worker = createWorker(githubFetch || (() => { throw new Error('Unexpected GitHub request'); }));
  async function login(id = '123', name = 'contributor') {
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'), csrf = 'test-csrf-' + id;
    await DB.prepare('INSERT INTO users (github_id, login, created_at) VALUES (?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login').bind(id, name, seconds()).run();
    await DB.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').bind(await hash(token), id, csrf, seconds() + 3600).run();
    return { id, csrf, token };
  }
  async function request(path, { user, method = 'GET', data, bytes, headers = {} } = {}) {
    const h = new Headers(headers);
    if (user) { h.set('Cookie', `__Host-rle_session=${user.token}`); if (!h.has('X-CSRF-Token')) h.set('X-CSRF-Token', user.csrf); }
    if (method !== 'GET' && !h.has('Origin')) h.set('Origin', origin);
    if (data !== undefined) h.set('Content-Type', 'application/json');
    return worker.fetch(new Request(origin + path, { method, headers: h, body: data !== undefined ? JSON.stringify(data) : bytes }), env);
  }
  async function metadata(bytes = template, overrides = {}) {
    return { id: crypto.randomUUID(), title: 'Robust robot manipulation', version: '1.0.0', workflow: 'Interactive control', summary: 'Develop a controller and measure task completion across held-out physics settings.', contact: 'author@example.org', filename: 'task.zip', byte_size: bytes.length, sha256: await hash(bytes), ...overrides };
  }
  async function create(user, bytes = template, overrides = {}) {
    const data = await metadata(bytes, overrides);
    const response = await request('/api/submissions', { user, method: 'POST', data });
    assert.equal(response.status, 201, await response.text());
    return data;
  }
  return { env, objects, worker, login, request, metadata, create };
}

test('auth endpoints reject anonymous access and do not trust client-supplied identities', async t => {
  const s = setup(t), id = crypto.randomUUID();
  for (const [path, method] of [['/api/submissions', 'GET'], ['/api/submissions', 'POST'], [`/api/submissions/${id}/archive`, 'PUT'], [`/api/submissions/${id}/archive`, 'GET'], [`/api/submissions/${id}/review`, 'POST'], ['/api/logout', 'POST']]) {
    const response = await s.request(path, { method, headers: { 'X-GitHub-User': 'mahaitongdae' } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const session = await (await s.request('/api/session')).json();
  assert.equal(session.user, null);
  assert.equal(session.authReady, true);
});

test('OAuth binds state to the browser, uses PKCE, rotates sessions, and rejects replay', async t => {
  const calls = [];
  const s = setup(t, async (url, options) => {
    calls.push([url, options]);
    return url.endsWith('/access_token') ? Response.json({ access_token: 'github-token-only-on-server' }) : Response.json({ id: 44082254, login: 'renamed-reviewer' });
  });
  const start = await s.request('/auth/github');
  assert.equal(start.status, 303);
  const authorize = new URL(start.headers.get('Location'));
  assert.equal(authorize.origin, 'https://github.com');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorize.searchParams.get('redirect_uri'), origin + '/auth/github/callback');
  assert.equal(authorize.searchParams.has('scope'), false);
  const cookie = start.headers.get('Set-Cookie').split(';')[0];
  assert.match(start.headers.get('Set-Cookie'), /HttpOnly.*SameSite=Lax.*Secure/);
  const callback = `/auth/github/callback?state=${authorize.searchParams.get('state')}&code=example-code`;
  assert.equal((await s.request(callback)).status, 400);
  assert.equal(calls.length, 0);
  const old = await s.login();
  const result = await s.request(callback, { headers: { Cookie: `${cookie}; __Host-rle_session=${old.token}` } });
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('Location'), '/submit');
  const verifier = calls[0][1].body.get('code_verifier');
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  assert.equal(challenge, authorize.searchParams.get('code_challenge'));
  assert.equal(calls[0][1].body.get('client_secret'), 'test-secret');
  assert.equal(calls[1][1].headers.Authorization, 'Bearer github-token-only-on-server');
  const sessionCookie = result.headers.getSetCookie().find(value => value.startsWith('__Host-rle_session=')).split(';')[0];
  const session = await (await s.request('/api/session', { headers: { Cookie: sessionCookie } })).json();
  assert.equal(session.user.id, '44082254');
  assert.equal(session.user.reviewer, true); // Stable ID, even after a username change.
  assert.equal(JSON.stringify(session).includes('github-token'), false);
  assert.equal((await (await s.request('/api/session', { user: old })).json()).user, null);
  assert.equal((await s.request(callback, { headers: { Cookie: cookie } })).status, 400);
});

test('expired OAuth state, cancelled sign-in and upstream auth failures do not create sessions', async t => {
  const s = setup(t, async () => Response.json({ error: 'bad_verification_code' }));
  async function flow() {
    const start = await s.request('/auth/github');
    return { state: new URL(start.headers.get('Location')).searchParams.get('state'), Cookie: start.headers.get('Set-Cookie').split(';')[0] };
  }
  const expired = await flow();
  s.env.DB.sqlite.exec('UPDATE oauth_states SET expires_at=0');
  assert.equal((await s.request(`/auth/github/callback?state=${expired.state}&code=x`, { headers: { Cookie: expired.Cookie } })).status, 400);
  const cancelled = await flow();
  assert.equal((await s.request(`/auth/github/callback?state=${cancelled.state}&error=access_denied`, { headers: { Cookie: cancelled.Cookie } })).headers.get('Location'), '/submit?auth=cancelled');
  const failed = await flow();
  assert.equal((await s.request(`/auth/github/callback?state=${failed.state}&code=x`, { headers: { Cookie: failed.Cookie } })).headers.get('Location'), '/submit?auth=failed');
  assert.equal(s.env.DB.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0);
});

test('writes require both a same-origin request and a session CSRF token; logout invalidates session', async t => {
  const s = setup(t), user = await s.login();
  for (const headers of [{ Origin: 'https://evil.example' }, { 'X-CSRF-Token': '' }, { Origin: 'null' }]) {
    assert.equal((await s.request('/api/submissions', { user, method: 'POST', data: await s.metadata(), headers })).status, 403);
    assert.equal((await s.request('/api/logout', { user, method: 'POST', headers })).status, 403);
  }
  assert.equal((await s.request('/api/logout', { user, method: 'POST' })).status, 200);
  assert.equal((await s.request('/api/submissions', { user })).status, 401);
});

test('submission lifecycle enforces ownership, reviewer access and private download headers', async t => {
  const s = setup(t), owner = await s.login(), other = await s.login('456', 'other'), reviewer = await s.login('41679605', 'typoverflow');
  const data = await s.create(owner);
  const base = `/api/submissions/${data.id}`;
  assert.equal((await s.request(base + '/archive', { user: owner })).status, 404);
  assert.equal((await s.request(base + '/archive', { user: reviewer, method: 'PUT', bytes: template })).status, 403);
  assert.equal((await s.request(base + '/archive', { user: owner, method: 'PUT', bytes: template })).status, 200);
  assert.equal(s.objects.size, 1);
  for (const path of [base, base + '/archive']) assert.equal((await s.request(path, { user: other })).status, 404);
  assert.equal((await s.request('/api/submissions?scope=review', { user: owner })).status, 403);
  assert.equal((await (await s.request('/api/submissions', { user: other })).json()).submissions.length, 0);
  const queue = await (await s.request('/api/submissions?scope=review', { user: reviewer })).json();
  assert.equal(queue.submissions.length, 1);
  assert.equal('object_key' in queue.submissions[0], false);
  const archive = await s.request(base + '/archive', { user: reviewer });
  assert.match(archive.headers.get('Content-Disposition'), /^attachment;/);
  assert.equal(archive.headers.get('Content-Type'), 'application/zip');
  assert.equal(archive.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(new Uint8Array(await archive.arrayBuffer()), template);
  assert.equal((await s.request(base + '/review', { user: owner, method: 'POST', data: { status: 'accepted', note: '' } })).status, 403);
  assert.equal((await s.request(base + '/review', { user: reviewer, method: 'POST', data: { status: 'changes_requested', note: '' } })).status, 400);
  assert.equal((await s.request(base + '/review', { user: reviewer, method: 'POST', data: { status: 'changes_requested', note: 'Please include calibration evidence.' } })).status, 200);
  const result = await (await s.request(base, { user: owner })).json();
  assert.equal(result.submission.status, 'changes_requested');
  assert.equal(result.reviews[0].note, 'Please include calibration evidence.');
  assert.equal(result.reviews[0].login, 'typoverflow');
});

test('metadata validation, byte limits and checksums reject invalid uploads before storage', async t => {
  const s = setup(t), user = await s.login();
  for (const overrides of [{ workflow: 'unknown' }, { filename: '../task.zip' }, { sha256: 'x'.repeat(64) }, { contact: 'not-an-email' }, { byte_size: 26214401 }, { summary: 'short' }]) {
    assert.ok((await s.request('/api/submissions', { user, method: 'POST', data: await s.metadata(template, overrides) })).status >= 400);
  }
  const data = await s.create(user), base = `/api/submissions/${data.id}/archive`;
  assert.equal((await s.request(base, { user, method: 'PUT', bytes: new Uint8Array(template.length + 1) })).status, 413);
  const tampered = template.slice(); tampered[100] ^= 1;
  assert.equal((await s.request(base, { user, method: 'PUT', bytes: tampered })).status, 400);
  const invalid = new Uint8Array(100), bad = await s.create(user, invalid);
  assert.equal((await s.request(`/api/submissions/${bad.id}/archive`, { user, method: 'PUT', bytes: invalid })).status, 400);
  assert.equal(s.objects.size, 0);
});

test('retrying an upload is idempotent, immutable after submission and recovers from storage failure', async t => {
  const s = setup(t), user = await s.login(), data = await s.create(user), base = `/api/submissions/${data.id}/archive`;
  assert.equal((await s.request('/api/submissions', { user, method: 'POST', data })).status, 200);
  assert.equal((await s.request('/api/submissions', { user, method: 'POST', data: { ...data, title: 'A different task' } })).status, 409);
  const put = s.env.SUBMISSIONS_BUCKET.put;
  s.env.SUBMISSIONS_BUCKET.put = async () => { throw new Error('Simulated R2 outage'); };
  assert.equal((await s.request(base, { user, method: 'PUT', bytes: template })).status, 503);
  s.env.SUBMISSIONS_BUCKET.put = put;
  assert.equal((await s.request(base, { user, method: 'PUT', bytes: template })).status, 200);
  assert.equal((await s.request(base, { user, method: 'PUT', bytes: template })).status, 200);
  assert.equal(s.objects.size, 1);
  const retry = await (await s.request('/api/submissions', { user, method: 'POST', data })).json();
  assert.equal(retry.status, 'submitted');
  assert.equal(s.env.DB.sqlite.prepare('SELECT count(*) n FROM submissions').get().n, 1);
});

test('daily submission limits apply to new records and do not block retries', async t => {
  const s = setup(t), user = await s.login();
  let first;
  for (let i = 0; i < 10; i++) { const data = await s.create(user); first ||= data; }
  assert.equal((await s.request('/api/submissions', { user, method: 'POST', data: await s.metadata() })).status, 429);
  assert.equal((await s.request('/api/submissions', { user, method: 'POST', data: first })).status, 200);
});

test('an archive stored before a database outage can be finalized by retry without duplication', async t => {
  const s = setup(t), user = await s.login(), data = await s.create(user), path = `/api/submissions/${data.id}/archive`;
  const prepare = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = sql => {
    if (sql.startsWith("UPDATE submissions SET status = 'submitted'")) return { bind() { return this; }, async run() { throw new Error('Simulated D1 outage'); } };
    return prepare(sql);
  };
  assert.equal((await s.request(path, { user, method: 'PUT', bytes: template })).status, 503);
  assert.equal(s.objects.size, 1);
  assert.equal((await s.request(path, { user })).status, 404);
  s.env.DB.prepare = prepare;
  assert.equal((await s.request(path, { user, method: 'PUT', bytes: template })).status, 200);
  assert.equal(s.objects.size, 1);
  assert.equal((await (await s.request(`/api/submissions/${data.id}`, { user })).json()).submission.status, 'submitted');
});

test('keyset pagination preserves records with tied timestamps and review filtering excludes incomplete uploads', async t => {
  const s = setup(t), owner = await s.login(), reviewer = await s.login('87316432', 'rushi-Q');
  const data = await s.create(owner);
  const seed = s.env.DB.sqlite.prepare('SELECT * FROM submissions WHERE id=?').get(data.id);
  for (let i = 0; i < 34; i++) {
    const row = { ...seed, id: crypto.randomUUID(), object_key: 'key-' + i, status: 'submitted' };
    await s.env.DB.prepare(`INSERT INTO submissions (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).bind(...Object.values(row)).run();
  }
  const first = await (await s.request('/api/submissions?scope=review', { user: reviewer })).json();
  assert.equal(first.submissions.length, 30);
  const second = await (await s.request('/api/submissions?scope=review&before=' + first.next, { user: reviewer })).json();
  assert.equal(second.submissions.length, 4);
  assert.equal(second.next, null);
  assert.equal(new Set([...first.submissions, ...second.submissions].map(row => row.id)).size, 34);
  assert.equal((await (await s.request('/api/submissions?scope=review&status=accepted', { user: reviewer })).json()).submissions.length, 0);
});

test('scheduled cleanup expires sessions and OAuth state without deleting submissions', async t => {
  const s = setup(t), user = await s.login();
  await s.create(user);
  await s.request('/auth/github');
  s.env.DB.sqlite.exec('UPDATE sessions SET expires_at=0; UPDATE oauth_states SET expires_at=0; UPDATE rate_limits SET expires_at=0;');
  await s.worker.scheduled({}, s.env);
  for (const table of ['sessions', 'oauth_states', 'rate_limits']) assert.equal(s.env.DB.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0);
  assert.equal(s.env.DB.sqlite.prepare('SELECT count(*) n FROM submissions').get().n, 1);
});

function proposalFields(overrides = {}) {
  return { title: 'Tactile slip recovery', domain: 'Robot manipulation', software: 'MuJoCo and Python', operating_system: 'Linux', licensing: 'Free / open source', description: 'Develop a tactile controller that can recover from slip with held-out friction settings.', evaluation: 'Measure successful recovery in at least 90 percent of 100 held-out simulation episodes.', contact: 'author@example.org', ...overrides };
}

test('proposals support private drafts, independent submission, requested revisions and reviewer history', async t => {
  const s = setup(t), owner = await s.login(), other = await s.login('456', 'other'), reviewer = await s.login('44082254', 'mahaitongdae');
  const id = crypto.randomUUID(), base = `/api/proposals/${id}`;
  const draft = { id, status: 'draft', fields: { title: 'Tactile slip recovery' } };
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: draft })).status, 201);
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: draft })).status, 200);
  for (const user of [other, reviewer]) assert.equal((await s.request(base, { user })).status, 404);
  assert.equal((await (await s.request('/api/proposals?scope=review', { user: reviewer })).json()).submissions.length, 0);
  const fields = proposalFields({ materials_url: 'https://example.org/materials' });
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: { revision: 1, status: 'submitted', fields: draft.fields } })).status, 400);
  const submit = { revision: 1, status: 'submitted', fields };
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: submit })).status, 200);
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: submit })).status, 200); // Lost response retry.
  assert.equal((await s.request(base, { user: other })).status, 404);
  assert.equal((await s.request(base + '/archive', { user: owner })).status, 404);
  assert.equal((await (await s.request('/api/submissions', { user: owner })).json()).submissions.length, 0);
  assert.equal(s.objects.size, 0); // A proposal never needs an R2 archive.
  const queue = await (await s.request('/api/proposals?scope=review', { user: reviewer })).json();
  assert.equal(queue.submissions.length, 1);
  assert.equal('fields' in queue.submissions[0], false);
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: { ...submit, revision: 2 } })).status, 409);
  assert.equal((await s.request(base, { user: reviewer, method: 'PUT', data: submit })).status, 403);
  assert.equal((await s.request(base + '/review', { user: owner, method: 'POST', data: { status: 'accepted', note: '', revision: 2 } })).status, 403);
  assert.equal((await s.request(base + '/review', { user: reviewer, method: 'POST', data: { status: 'changes_requested', note: '', revision: 2 } })).status, 400);
  assert.equal((await s.request(base + '/review', { user: reviewer, method: 'POST', data: { status: 'changes_requested', note: 'Add held-out mass settings.', revision: 2 } })).status, 200);
  const updated = proposalFields({ evaluation: 'Evaluate 100 held-out episodes with unseen masses as well as friction coefficients.' });
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: { revision: 3, status: 'draft', fields: updated } })).status, 200);
  let record = await (await s.request(base, { user: owner })).json();
  assert.equal(record.submission.status, 'changes_requested');
  assert.equal(record.reviews[0].note, 'Add held-out mass settings.');
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: { revision: 3, status: 'submitted', fields: updated } })).status, 409);
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: { revision: 4, status: 'submitted', fields: updated } })).status, 200);
  assert.equal((await s.request(base + '/review', { user: reviewer, method: 'POST', data: { status: 'accepted', note: 'Ready to build.', revision: 5 } })).status, 200);
  record = await (await s.request(base, { user: owner })).json();
  assert.equal(record.submission.status, 'accepted');
  assert.equal(record.reviews.length, 2);
  assert.equal(record.submission.fields.evaluation, updated.evaluation);
  assert.equal((await s.request(base, { user: owner, method: 'PUT', data: { revision: 6, status: 'submitted', fields: updated } })).status, 409);
});

test('proposal writes enforce authentication, CSRF, validation, quota and duplicate protection', async t => {
  const s = setup(t), owner = await s.login(), other = await s.login('456', 'other'), id = crypto.randomUUID();
  for (const [path, method] of [['/api/proposals', 'GET'], ['/api/proposals', 'POST'], [`/api/proposals/${id}`, 'PUT'], [`/api/proposals/${id}/review`, 'POST']]) assert.equal((await s.request(path, { method })).status, 401);
  const data = { id, status: 'submitted', fields: proposalFields() };
  for (const headers of [{ Origin: 'https://evil.example' }, { 'X-CSRF-Token': '' }]) assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data, headers })).status, 403);
  for (const overrides of [{ description: 'Too short' }, { evaluation: 'Too short' }, { operating_system: 'unknown' }, { contact: 'invalid' }, { evidence_url: 'javascript:alert(1)' }, { reference_url: 'https://user:password@example.org' }, { materials_url: 'not-a-url' }, { title: 'x'.repeat(121) }]) {
    assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: { ...data, fields: proposalFields(overrides) } })).status, 400);
  }
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: { ...data, status: 'accepted' } })).status, 400);
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data })).status, 201);
  assert.equal((await s.request('/api/proposals', { user: other, method: 'POST', data })).status, 409);
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: { ...data, fields: proposalFields({ title: 'Conflicting task title' }) } })).status, 409);
  for (let i = 0; i < 9; i++) assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: { id: crypto.randomUUID(), status: 'draft', fields: { title: `Draft number ${i}` } } })).status, 201);
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data: { ...data, id: crypto.randomUUID() } })).status, 429);
  assert.equal((await s.request('/api/proposals', { user: owner, method: 'POST', data })).status, 200);
  assert.equal((await s.request('/api/proposals?scope=review', { user: owner })).status, 403);
});

test('proposal review races do not overwrite newer revisions or append misleading history', async t => {
  const s = setup(t), owner = await s.login(), reviewer = await s.login('41679605', 'typoverflow'), id = crypto.randomUUID();
  await s.request('/api/proposals', { user: owner, method: 'POST', data: { id, status: 'submitted', fields: proposalFields() } });
  const originalBatch = s.env.DB.batch.bind(s.env.DB);
  s.env.DB.batch = async statements => {
    s.env.DB.sqlite.prepare('UPDATE proposals SET revision = revision + 1 WHERE id = ?').run(id);
    return originalBatch(statements);
  };
  assert.equal((await s.request(`/api/proposals/${id}/review`, { user: reviewer, method: 'POST', data: { revision: 1, status: 'accepted', note: '' } })).status, 409);
  const record = await (await s.request(`/api/proposals/${id}`, { user: owner })).json();
  assert.equal(record.submission.status, 'submitted');
  assert.equal(record.reviews.length, 0);
});

test('proposal pagination keeps queues separate and excludes other contributors and drafts', async t => {
  const s = setup(t), owner = await s.login(), other = await s.login('456', 'other'), reviewer = await s.login('41679605', 'typoverflow');
  const timestamp = Date.now();
  for (let i = 0; i < 35; i++) await s.env.DB.prepare('INSERT INTO proposals (id, github_id, title, payload_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), owner.id, `Proposal ${i}`, JSON.stringify(proposalFields()), i < 3 ? 'draft' : 'submitted', timestamp, timestamp).run();
  const first = await (await s.request('/api/proposals?scope=review', { user: reviewer })).json();
  const second = await (await s.request(`/api/proposals?scope=review&before=${first.next}`, { user: reviewer })).json();
  assert.equal(first.submissions.length, 30); assert.equal(second.submissions.length, 2);
  assert.equal(new Set([...first.submissions, ...second.submissions].map(row => row.id)).size, 32);
  assert.equal(second.next, null);
  assert.equal((await (await s.request('/api/proposals?status=draft', { user: owner })).json()).submissions.length, 3);
  assert.equal((await (await s.request('/api/proposals', { user: other })).json()).submissions.length, 0);
  assert.equal((await (await s.request('/api/proposals?scope=review&status=draft', { user: reviewer })).json()).submissions.length, 0);
  assert.equal((await s.request('/api/proposals?before=invalid', { user: owner })).status, 400);
});

test('OAuth returns to the selected flow and rejects external redirect destinations', async t => {
  const s = setup(t, async url => url.endsWith('/access_token') ? Response.json({ access_token: 'test-access-token' }) : Response.json({ id: 123, login: 'contributor' }));
  for (const destination of ['/propose', '/review/proposals', 'https://evil.example', '//evil.example', '/propose?next=https://evil.example']) {
    const start = await s.request(`/auth/github?return=${encodeURIComponent(destination)}`);
    const state = new URL(start.headers.get('Location')).searchParams.get('state');
    const Cookie = start.headers.get('Set-Cookie').split(';')[0];
    const result = await s.request(`/auth/github/callback?state=${state}&code=test`, { headers: { Cookie } });
    assert.equal(result.headers.get('Location'), ['/propose', '/review/proposals'].includes(destination) ? destination : '/submit');
  }
  const start = await s.request('/auth/github?return=/propose');
  const state = new URL(start.headers.get('Location')).searchParams.get('state');
  assert.equal((await s.request(`/auth/github/callback?state=${state}&error=access_denied`, { headers: { Cookie: start.headers.get('Set-Cookie').split(';')[0] } })).headers.get('Location'), '/propose?auth=cancelled');
});

// ZIP fixtures use ordinary stored entries. The upload check deliberately does
// not extract, execute, or certify contributor code or its reported results.
function zip(names) {
  const chunks = [], directory = [];
  let offset = 0;
  for (const name of names) {
    const encoded = Buffer.from(name), local = Buffer.alloc(30 + encoded.length), central = Buffer.alloc(46 + encoded.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(encoded.length, 26); encoded.copy(local, 30);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(encoded.length, 28); central.writeUInt32LE(offset, 42); encoded.copy(central, 46);
    chunks.push(local); directory.push(central); offset += local.length;
  }
  const end = Buffer.alloc(22), central = Buffer.concat(directory);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, central, end]));
}
const files = ['README.md', 'AUTHOR_GUIDE.md', 'SUBMISSION.md', 'task/task.toml', 'task/instruction.md', 'task/environment/Dockerfile', 'task/tests/Dockerfile', 'task/tests/test.sh', 'author_checks/check.py'];
test('ZIP structure checker accepts the supplied template and rejects hostile paths and malformed headers', () => {
  assert.equal(validateZip(template).entries, 13);
  assert.equal(validateZip(zip(files)).entries, files.length);
  for (const name of ['../escape', '/absolute', 'task/../escape', 'task\\escape', 'C:/escape', './task/file', 'task//file', 'bad\0name']) assert.throws(() => validateZip(zip([...files, name])), /relative paths/);
  assert.throws(() => validateZip(zip([...files, 'README.md'])), /duplicate/);
  assert.throws(() => validateZip(zip(['outer/README.md'])), /Missing required files/);
  assert.throws(() => validateZip(template.subarray(0, template.length - 1)), /directory/);
  const altered = zip(files); altered[30] ^= 1;
  assert.throws(() => validateZip(altered), /paths do not match/);
  const link = zip(files), end = link.length - 22, view = new DataView(link.buffer), central = view.getUint32(end + 16, true);
  view.setUint32(central + 38, (0xa000 << 16) >>> 0, true);
  assert.throws(() => validateZip(link), /links are not allowed/);
  const bomb = zip(files), bombView = new DataView(bomb.buffer), bombCentral = bombView.getUint32(bomb.length - 6, true);
  bombView.setUint32(bombCentral + 24, 501 * 1024 * 1024, true);
  assert.throws(() => validateZip(bomb), /500 MiB/);
});
