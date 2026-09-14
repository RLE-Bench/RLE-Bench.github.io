const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ['submitted', 'in_review', 'changes_requested', 'accepted', 'declined'];
const FIELDS = { title: 120, domain: 160, software: 500, description: 4000, input_materials: 2000, materials_url: 2048, reference_output: 2000, reference_url: 2048, evaluation: 4000, contact: 320, self_test_model: 120, self_test_harness: 120, self_test_score: 120, evidence_url: 2048 };

export function proposalRoutes({ authenticate, reviewer, bodyJson, field, limit, reject }) {
  const json = data => Response.json(data);
  function payload(data, submitted) {
    const result = {};
    for (const [key, maximum] of Object.entries(FIELDS)) result[key] = field({ [key]: data?.[key] ?? '' }, key, key === 'title' ? 3 : 0, maximum);
    if (submitted) {
      for (const key of ['domain', 'software', 'contact']) if (!result[key]) reject(400, `Complete the ${key.replaceAll('_', ' ')} field before submitting.`);
      for (const key of ['description', 'evaluation']) if (result[key].length < 30) reject(400, `Provide at least 30 characters for ${key}.`);
    }
    if (result.contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contact)) reject(400, 'Enter a contact email address.');
    for (const key of ['materials_url', 'reference_url', 'evidence_url']) {
      if (!result[key]) continue;
      let url;
      try { url = new URL(result[key]); } catch { reject(400, `Enter a full HTTPS link for ${key.replaceAll('_', ' ')}.`); }
      if (url.protocol !== 'https:' || url.username || url.password) reject(400, 'Supporting links must use HTTPS and must not contain a username or password.');
    }
    return result;
  }
  function publicProposal(row) {
    const { payload_json, ...record } = row;
    return { ...record, fields: JSON.parse(payload_json) };
  }
  async function get(env, id, user) {
    const row = await env.DB.prepare('SELECT p.*, u.login FROM proposals p JOIN users u ON u.github_id = p.github_id WHERE p.id = ?').bind(id).first();
    if (!row || (row.github_id !== user.github_id && (row.status === 'draft' || !reviewer(env, user.github_id)))) reject(404, 'Proposal not found.');
    return row;
  }
  function writeStatus(data) {
    if (!['draft', 'submitted'].includes(data?.status)) reject(400, 'Save a draft or submit the proposal for review.');
    return data.status;
  }
  return async function route(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    const user = await authenticate(request, env, method !== 'GET');
    if (path === '/api/proposals' && method === 'POST') {
      const data = await bodyJson(request, 65536), status = writeStatus(data);
      if (!UUID.test(data.id)) reject(400, 'Invalid proposal identifier.');
      const fields = payload(data.fields, status === 'submitted'), serialized = JSON.stringify(fields);
      const previous = await env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(data.id).first();
      if (previous) {
        if (previous.github_id !== user.github_id || previous.payload_json !== serialized) reject(409, 'This proposal identifier is already in use. Refresh your proposal list before retrying.');
        return json({ id: previous.id, status: previous.status, revision: previous.revision });
      }
      await limit(env, `proposal-create:${user.github_id}`, 10, 86400);
      const timestamp = Date.now();
      await env.DB.prepare('INSERT INTO proposals (id, github_id, title, payload_json, status, created_at, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(data.id, user.github_id, fields.title, serialized, status, timestamp, status === 'submitted' ? timestamp : null, timestamp).run();
      return Response.json({ id: data.id, status, revision: 1 }, { status: 201 });
    }
    if (path === '/api/proposals' && method === 'GET') {
      const review = url.searchParams.get('scope') === 'review';
      if (review && !reviewer(env, user.github_id)) reject(403, 'Reviewer access is required.');
      const conditions = [], bindings = [];
      if (review) conditions.push("p.status != 'draft'");
      else { conditions.push('p.github_id = ?'); bindings.push(user.github_id); }
      const status = url.searchParams.get('status');
      if (status) {
        if (!['draft', ...STATUSES].includes(status)) reject(400, 'Invalid status.');
        conditions.push('p.status = ?'); bindings.push(status);
      }
      const before = url.searchParams.get('before');
      if (before) {
        const match = /^(\d{13})_([0-9a-f-]{36})$/i.exec(before);
        if (!match || !UUID.test(match[2])) reject(400, 'Invalid pagination cursor.');
        conditions.push('(p.created_at < ? OR (p.created_at = ? AND p.id < ?))'); bindings.push(Number(match[1]), Number(match[1]), match[2]);
      }
      const { results } = await env.DB.prepare(`SELECT p.id, p.github_id, p.title, p.status, p.revision, p.created_at, p.updated_at, u.login FROM proposals p JOIN users u ON u.github_id = p.github_id WHERE ${conditions.join(' AND ')} ORDER BY p.created_at DESC, p.id DESC LIMIT 31`).bind(...bindings).all();
      const rows = results.slice(0, 30), last = rows.at(-1);
      return json({ submissions: rows, next: results.length > 30 ? `${last.created_at}_${last.id}` : null });
    }
    const match = /^\/api\/proposals\/([0-9a-f-]{36})(?:\/(review))?$/i.exec(path);
    if (!match || !UUID.test(match[1])) reject(404, 'This proposal endpoint does not exist.');
    const row = await get(env, match[1], user);
    if (!match[2] && method === 'GET') {
      const { results: reviews } = await env.DB.prepare('SELECT r.id, r.revision, r.status, r.note, r.created_at, u.login FROM proposal_reviews r JOIN users u ON u.github_id = r.reviewer_id WHERE r.proposal_id = ? ORDER BY r.created_at, r.id').bind(row.id).all();
      return json({ submission: publicProposal(row), reviews });
    }
    if (!match[2] && method === 'PUT') {
      if (row.github_id !== user.github_id) reject(403, 'Only the contributor can edit this proposal.');
      const data = await bodyJson(request, 65536), requestedStatus = writeStatus(data);
      const fields = payload(data.fields, requestedStatus === 'submitted'), serialized = JSON.stringify(fields);
      const status = requestedStatus === 'draft' && row.submitted_at !== null ? 'changes_requested' : requestedStatus;
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) reject(400, 'Include the proposal revision.');
      // A lost response can be retried without duplicating a revision.
      if (data.revision + 1 === row.revision && serialized === row.payload_json && status === row.status) return json({ id: row.id, status: row.status, revision: row.revision });
      if (!['draft', 'changes_requested'].includes(row.status)) reject(409, 'This proposal is being reviewed or has a decision. It can be edited when changes are requested.');
      await limit(env, `proposal-edit:${user.github_id}`, 60, 3600);
      const timestamp = Date.now();
      const changed = await env.DB.prepare(`UPDATE proposals SET title = ?, payload_json = ?, status = ?, revision = revision + 1, submitted_at = COALESCE(submitted_at, ?), updated_at = ? WHERE id = ? AND revision = ? AND status IN ('draft', 'changes_requested') RETURNING revision`)
        .bind(fields.title, serialized, status, status === 'submitted' ? timestamp : null, timestamp, row.id, data.revision).first();
      if (!changed) reject(409, 'This proposal changed in another tab. Reopen its details before editing.');
      return json({ id: row.id, status, revision: changed.revision });
    }
    if (match[2] === 'review' && method === 'POST') {
      if (!reviewer(env, user.github_id)) reject(403, 'Reviewer access is required.');
      if (row.status === 'draft') reject(409, 'Drafts have not been submitted for review.');
      const data = await bodyJson(request), status = field(data, 'status', 1, 30), note = field(data, 'note', 0, 4000);
      if (!STATUSES.includes(status)) reject(400, 'Select a supported review status.');
      if (['changes_requested', 'declined'].includes(status) && !note) reject(400, 'Include feedback explaining this decision.');
      if (data.revision !== row.revision) reject(409, 'This proposal changed. Reopen its details before reviewing.');
      await limit(env, `proposal-review:${user.github_id}`, 120, 3600);
      const reviewId = crypto.randomUUID(), timestamp = Date.now();
      // changes() makes the history insert conditional on the atomic revision check.
      const [changed] = await env.DB.batch([
        env.DB.prepare("UPDATE proposals SET status = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND status != 'draft'").bind(status, timestamp, row.id, data.revision),
        env.DB.prepare('INSERT INTO proposal_reviews (id, proposal_id, reviewer_id, revision, status, note, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1').bind(reviewId, row.id, user.github_id, row.revision, status, note, timestamp)
      ]);
      if (!changed.meta.changes) reject(409, 'This proposal changed. Reopen its details before reviewing.');
      return json({ ok: true, status });
    }
    reject(405, 'Method not allowed.');
  };
}
