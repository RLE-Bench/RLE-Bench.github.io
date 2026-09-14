import { validateZip } from './zip.mjs';
import { proposalRoutes } from './proposals.mjs';

const encoder = new TextEncoder();
const MAX_BYTES = 25 * 1024 * 1024;
const SESSION_SECONDS = 8 * 60 * 60;
const WORKFLOWS = ['Interactive control', 'Policy development', 'Perception and estimation', 'Mechanical design', 'Other robotics engineering'];
const STATUSES = ['submitted', 'in_review', 'changes_requested', 'accepted', 'declined'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const now = () => Math.floor(Date.now() / 1000);
const json = (data, status = 200) => Response.json(data, { status });
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const reject = (status, message) => { throw new HttpError(status, message); };
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value));
export const hash = async value => Array.from(await digest(value), byte => byte.toString(16).padStart(2, '0')).join('');
const maxUpload = env => Math.min(MAX_BYTES, Number(env.MAX_UPLOAD_BYTES) || MAX_BYTES);
const ready = env => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const reviewer = (env, id) => String(env.REVIEWER_IDS || '').split(',').map(s => s.trim()).includes(String(id));
function origin(env) {
  const url = new URL(env.APP_ORIGIN);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Invalid APP_ORIGIN');
  return url.origin;
}
function cookieName(env, name) { return `${origin(env).startsWith('https:') ? '__Host-' : ''}rle_${name}`; }
function cookie(env, name, value, seconds) {
  return `${cookieName(env, name)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin(env).startsWith('https:') ? '; Secure' : ''}`;
}
function readCookie(request, env, name) {
  const prefix = cookieName(env, name) + '=';
  return (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(prefix))?.slice(prefix.length) || '';
}
function redirect(path, cookies = []) {
  const headers = new Headers({ Location: path });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}
async function session(request, env) {
  const token = readCookie(request, env, 'session');
  if (!TOKEN.test(token)) return null;
  return env.DB.prepare(`SELECT s.github_id, s.csrf_token, s.token_hash, u.login
    FROM sessions s JOIN users u ON u.github_id = s.github_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await hash(token), now()).first();
}
async function authenticate(request, env, write = false) {
  const user = await session(request, env);
  if (!user) reject(401, 'Sign in with GitHub to continue.');
  if (write && (request.headers.get('Origin') !== origin(env) || request.headers.get('X-CSRF-Token') !== user.csrf_token)) reject(403, 'This request could not be verified. Refresh the page and try again.');
  return user;
}
async function limit(env, key, ceiling, seconds) {
  const timestamp = now(), bucket = Math.floor(timestamp / seconds);
  const row = await env.DB.prepare(`INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`)
    .bind(`${key}:${bucket}`, (bucket + 1) * seconds).first();
  if (row.count > ceiling) reject(429, 'Too many attempts. Please try again later.');
}
async function bodyBytes(request, maximum) {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > maximum) reject(413, 'The upload is larger than the allowed size.');
  if (!request.body) reject(400, 'The request body is empty.');
  const reader = request.body.getReader(), bytes = new Uint8Array(maximum);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > maximum) { await reader.cancel(); reject(413, 'The upload is larger than the allowed size.'); }
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally { reader.releaseLock(); }
  return bytes.subarray(0, size);
}
async function bodyJson(request, maximum = 16384) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) reject(415, 'Use a JSON request.');
  const bytes = await bodyBytes(request, maximum);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { reject(400, 'The request contains invalid JSON.'); }
}
function field(data, name, minimum, maximum) {
  const value = data?.[name];
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) reject(400, `Check the ${name} field (${minimum}–${maximum} characters).`);
  return value.trim();
}
function metadata(data, env) {
  const record = {
    id: field(data, 'id', 36, 36), title: field(data, 'title', 3, 120), version: field(data, 'version', 1, 40),
    workflow: field(data, 'workflow', 1, 80), summary: field(data, 'summary', 30, 4000), contact: field(data, 'contact', 3, 320),
    filename: field(data, 'filename', 5, 180), sha256: field(data, 'sha256', 64, 64), byte_size: data.byte_size
  };
  if (!UUID.test(record.id) || !/^[0-9a-f]{64}$/.test(record.sha256)) reject(400, 'The submission identifier or file checksum is invalid.');
  if (!WORKFLOWS.includes(record.workflow)) reject(400, 'Select a supported workflow.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.contact)) reject(400, 'Enter a contact email address.');
  if (!/\.zip$/i.test(record.filename) || /[\\/\x00-\x1f\x7f]/.test(record.filename)) reject(400, 'Choose a ZIP file with an ordinary filename.');
  if (!Number.isSafeInteger(record.byte_size) || record.byte_size < 22 || record.byte_size > maxUpload(env)) reject(413, `ZIP files must be between 22 bytes and ${maxUpload(env) / 1048576} MiB.`);
  return record;
}
async function getSubmission(env, id, user) {
  const row = await env.DB.prepare(`SELECT s.*, u.login FROM submissions s JOIN users u ON u.github_id = s.github_id WHERE s.id = ?`).bind(id).first();
  if (!row || (row.github_id !== user.github_id && !reviewer(env, user.github_id))) reject(404, 'Submission not found.');
  return row;
}
function publicSubmission(row) {
  const { object_key, ...record } = row;
  return record;
}

export function createWorker(githubFetch = (...args) => fetch(...args)) {
  const proposals = proposalRoutes({ authenticate, reviewer, bodyJson, field, limit, reject });
  async function route(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (url.origin !== origin(env)) reject(400, 'Use the configured submission portal address.');
    if (path === '/api/health' && method === 'GET') {
      await env.DB.prepare('SELECT id FROM submissions LIMIT 1').first();
      await env.DB.prepare('SELECT id FROM proposals LIMIT 1').first();
      await env.SUBMISSIONS_BUCKET.head('health-check');
      return json({ ok: true, authConfigured: ready(env) });
    }
    if (path === '/auth/github' && method === 'GET') {
      if (!ready(env)) reject(503, 'GitHub sign-in is being configured. Please try again later.');
      await limit(env, `oauth:${await hash(request.headers.get('CF-Connecting-IP') || 'local')}`, 30, 3600);
      const state = randomToken(), browser = randomToken(), verifier = randomToken();
      const returnPath = ['/submit', '/propose', '/review', '/review/proposals'].includes(url.searchParams.get('return')) ? url.searchParams.get('return') : '/submit';
      await env.DB.prepare('INSERT INTO oauth_states (state_hash, browser_hash, verifier, expires_at, return_path) VALUES (?, ?, ?, ?, ?)')
        .bind(await hash(state), await hash(browser), verifier, now() + 600, returnPath).run();
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${origin(env)}/auth/github/callback`, state, code_challenge: base64url(await digest(verifier)), code_challenge_method: 'S256' });
      return redirect(authorize.href, [cookie(env, 'oauth', browser, 600)]);
    }
    if (path === '/auth/github/callback' && method === 'GET') {
      const state = url.searchParams.get('state') || '', browser = readCookie(request, env, 'oauth');
      if (!TOKEN.test(state) || !TOKEN.test(browser)) reject(400, 'Sign-in expired or could not be verified. Start again from the submission page.');
      const flow = await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING verifier, return_path')
        .bind(await hash(state), await hash(browser), now()).first();
      if (!flow) reject(400, 'Sign-in expired or was already used. Start again from the submission page.');
      const clear = cookie(env, 'oauth', '', 0);
      if (url.searchParams.has('error')) return redirect(`${flow.return_path}?auth=cancelled`, [clear]);
      const code = url.searchParams.get('code');
      if (!code || code.length > 512 || !ready(env)) return redirect(`${flow.return_path}?auth=failed`, [clear]);
      let profile;
      try {
        const response = await githubFetch('https://github.com/login/oauth/access_token', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${origin(env)}/auth/github/callback`, code_verifier: flow.verifier }),
          signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error('GitHub exchange failed');
        const token = await response.json();
        if (typeof token.access_token !== 'string' || !token.access_token || token.error) throw new Error('Invalid GitHub token');
        const identity = await githubFetch('https://api.github.com/user', {
          headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'RLE-Bench-Submissions', 'X-GitHub-Api-Version': '2026-03-10' },
          signal: AbortSignal.timeout(15000)
        });
        if (!identity.ok) throw new Error('GitHub identity failed');
        profile = await identity.json();
        if (!Number.isSafeInteger(profile.id) || profile.id <= 0 || !/^[A-Za-z0-9-]{1,39}$/.test(profile.login)) throw new Error('Invalid GitHub identity');
      } catch { return redirect(`${flow.return_path}?auth=failed`, [clear]); }
      const token = randomToken(), old = readCookie(request, env, 'session');
      await env.DB.batch([
        env.DB.prepare('INSERT INTO users (github_id, login, created_at) VALUES (?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET login = excluded.login').bind(String(profile.id), profile.login, now()),
        env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(old)),
        env.DB.prepare('INSERT INTO sessions (token_hash, github_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)').bind(await hash(token), String(profile.id), randomToken(), now() + SESSION_SECONDS)
      ]);
      return redirect(flow.return_path, [clear, cookie(env, 'session', token, SESSION_SECONDS)]);
    }
    if (path === '/api/session' && method === 'GET') {
      const user = await session(request, env);
      return json({ user: user ? { id: user.github_id, login: user.login, reviewer: reviewer(env, user.github_id) } : null, csrfToken: user?.csrf_token || null, authReady: ready(env), maxUploadBytes: maxUpload(env) });
    }
    if (path === '/api/logout' && method === 'POST') {
      const user = await authenticate(request, env, true);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.token_hash).run();
      const response = json({ ok: true });
      response.headers.append('Set-Cookie', cookie(env, 'session', '', 0));
      return response;
    }
    if (path === '/api/proposals' || path.startsWith('/api/proposals/')) return proposals(request, env);
    if (path === '/api/submissions' && method === 'POST') {
      const user = await authenticate(request, env, true), data = metadata(await bodyJson(request), env);
      const previous = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(data.id).first();
      if (previous) {
        if (previous.github_id !== user.github_id || Object.entries(data).some(([key, value]) => previous[key] !== value)) reject(409, 'This submission identifier is already in use. Start a new submission.');
        return json({ id: previous.id, status: previous.status });
      }
      await limit(env, `submit:${user.github_id}`, 10, 86400);
      const timestamp = Date.now();
      await env.DB.prepare(`INSERT INTO submissions (id, github_id, title, version, workflow, summary, contact, filename, byte_size, sha256, object_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(data.id, user.github_id, data.title, data.version, data.workflow, data.summary, data.contact, data.filename, data.byte_size, data.sha256, `${user.github_id}/${data.id}/${data.sha256}.zip`, timestamp, timestamp).run();
      return json({ id: data.id, status: 'uploading' }, 201);
    }
    if (path === '/api/submissions' && method === 'GET') {
      const user = await authenticate(request, env), review = url.searchParams.get('scope') === 'review';
      if (review && !reviewer(env, user.github_id)) reject(403, 'Reviewer access is required.');
      const conditions = [], bindings = [];
      if (review) conditions.push("s.status != 'uploading'");
      else { conditions.push('s.github_id = ?'); bindings.push(user.github_id); }
      const status = url.searchParams.get('status');
      if (status) { if (!STATUSES.includes(status)) reject(400, 'Invalid status.'); conditions.push('s.status = ?'); bindings.push(status); }
      const before = url.searchParams.get('before');
      if (before) {
        const match = /^(\d{13})_([0-9a-f-]{36})$/i.exec(before);
        if (!match || !UUID.test(match[2])) reject(400, 'Invalid pagination cursor.');
        conditions.push('(s.created_at < ? OR (s.created_at = ? AND s.id < ?))'); bindings.push(Number(match[1]), Number(match[1]), match[2]);
      }
      const { results } = await env.DB.prepare(`SELECT s.*, u.login FROM submissions s JOIN users u ON u.github_id = s.github_id WHERE ${conditions.join(' AND ')} ORDER BY s.created_at DESC, s.id DESC LIMIT 31`).bind(...bindings).all();
      const rows = results.slice(0, 30), last = rows.at(-1);
      return json({ submissions: rows.map(publicSubmission), next: results.length > 30 ? `${last.created_at}_${last.id}` : null });
    }
    const match = /^\/api\/submissions\/([0-9a-f-]{36})(?:\/(archive|review))?$/i.exec(path);
    if (match && UUID.test(match[1])) {
      const user = await authenticate(request, env, ['POST', 'PUT'].includes(method));
      const row = await getSubmission(env, match[1], user);
      if (!match[2] && method === 'GET') {
        const { results: reviews } = await env.DB.prepare('SELECT r.id, r.status, r.note, r.created_at, u.login FROM reviews r JOIN users u ON u.github_id = r.reviewer_id WHERE r.submission_id = ? ORDER BY r.created_at, r.id').bind(row.id).all();
        return json({ submission: publicSubmission(row), reviews });
      }
      if (match[2] === 'archive' && method === 'PUT') {
        if (row.github_id !== user.github_id) reject(403, 'Only the contributor can upload this archive.');
        if (row.status !== 'uploading') return json({ id: row.id, status: row.status });
        await limit(env, `upload:${user.github_id}`, 30, 3600);
        const bytes = await bodyBytes(request, Math.min(row.byte_size, maxUpload(env)));
        if (bytes.length !== row.byte_size || await hash(bytes) !== row.sha256) reject(400, 'The uploaded file does not match the selected ZIP. Retry with the original file.');
        try { validateZip(bytes); } catch (error) { reject(400, error.message); }
        await env.SUBMISSIONS_BUCKET.put(row.object_key, bytes, { httpMetadata: { contentType: 'application/zip' }, customMetadata: { sha256: row.sha256 } });
        const timestamp = Date.now();
        await env.DB.prepare("UPDATE submissions SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ? AND status = 'uploading'").bind(timestamp, timestamp, row.id).run();
        return json({ id: row.id, status: 'submitted' });
      }
      if (match[2] === 'archive' && method === 'GET') {
        if (row.status === 'uploading') reject(404, 'The archive upload has not completed.');
        const object = await env.SUBMISSIONS_BUCKET.get(row.object_key);
        if (!object) reject(503, 'The archive is temporarily unavailable. Please try again later.');
        return new Response(object.body, { headers: { 'Content-Type': 'application/zip', 'Content-Length': String(row.byte_size), 'Content-Disposition': `attachment; filename="rlebench-${row.id}.zip"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}` } });
      }
      if (match[2] === 'review' && method === 'POST') {
        if (!reviewer(env, user.github_id)) reject(403, 'Reviewer access is required.');
        if (row.status === 'uploading') reject(409, 'The archive upload has not completed.');
        const data = await bodyJson(request), status = field(data, 'status', 1, 30), note = field(data, 'note', 0, 4000);
        if (!STATUSES.includes(status)) reject(400, 'Select a supported review status.');
        if (['changes_requested', 'declined'].includes(status) && !note) reject(400, 'Include feedback explaining this decision.');
        await limit(env, `review:${user.github_id}`, 120, 3600);
        const timestamp = Date.now();
        await env.DB.batch([
          env.DB.prepare('UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?').bind(status, timestamp, row.id),
          env.DB.prepare('INSERT INTO reviews (id, submission_id, reviewer_id, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), row.id, user.github_id, status, note, timestamp)
        ]);
        return json({ ok: true, status });
      }
    }
    if (path.startsWith('/api/') || path.startsWith('/auth/')) reject(404, 'This endpoint does not exist.');
    if (method !== 'GET' && method !== 'HEAD') reject(405, 'Method not allowed.');
    if (path === '/') return redirect('/submit');
    if (['/submit', '/propose', '/review', '/review/proposals'].includes(path)) return env.ASSETS.fetch(new Request(`${origin(env)}/`, { method }));
    return env.ASSETS.fetch(request);
  }
  return {
    async fetch(request, env) {
      let response;
      try { response = await route(request, env); }
      catch (error) {
        if (!(error instanceof HttpError)) console.error('Submission service request failed', new URL(request.url).pathname, error.name);
        response = json({ error: error instanceof HttpError ? error.message : 'The submission service is temporarily unavailable. Your form has not been cleared; please try again.' }, error instanceof HttpError ? error.status : 503);
      }
      const result = new Response(response.body, response);
      result.headers.set('Cache-Control', 'no-store');
      result.headers.set('X-Content-Type-Options', 'nosniff');
      result.headers.set('Referrer-Policy', 'no-referrer');
      result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
      if (new URL(request.url).protocol === 'https:') result.headers.set('Strict-Transport-Security', 'max-age=31536000');
      if (result.status === 429) result.headers.set('Retry-After', '3600');
      return result;
    },
    async scheduled(controller, env) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now()),
        env.DB.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').bind(now()),
        env.DB.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now())
      ]);
      // Incomplete uploads remain visible to their author and can be retried;
      // completed submissions and archives are never removed by this cleanup.
    }
  };
}
export default createWorker();
