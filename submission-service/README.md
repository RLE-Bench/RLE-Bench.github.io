# RLE-Bench submission service

The contribution guide remains on GitHub Pages. Separate task and proposal forms
and reviewer queues run on a Cloudflare Worker, with GitHub authentication, a private
R2 bucket, and a D1 database. The complete sign-in/upload flow stays on the Worker
origin, so it does not depend on third-party cookies or cross-origin API access.
The Worker also serves a generated copy of the contribution guide at `/guide/`
and the public template ZIP. This keeps portal links usable before the GitHub
Pages changes are published. Edit the original guide under `contribute/`; the
deploy step regenerates the portal copy and reuses the shared styles.

## Configuration

`wrangler.jsonc` targets the resources supplied for RLE-Bench:

| Setting | Value |
| --- | --- |
| Worker | `rlebench-submissions` |
| Portal | `https://rlebench-submissions.congharvard.workers.dev/submit` |
| Proposal form | `https://rlebench-submissions.congharvard.workers.dev/propose` |
| Reviewer queue | `https://rlebench-submissions.congharvard.workers.dev/review` |
| Proposal review queue | `https://rlebench-submissions.congharvard.workers.dev/review/proposals` |
| Account | `b8fb67ed42eed035686205a83734eabf` |
| D1 binding | `DB` → `rlebench-submissions` |
| Database ID | `6ea08c49-df5c-4fb7-aba8-abb6a89200e4` |
| R2 binding | `SUBMISSIONS_BUCKET` → `rlebench` (the existing bucket) |
| GitHub Client ID | `Iv23li9TQi8Pf7egdcUx` |

The secret `GITHUB_CLIENT_SECRET` belongs in the Worker's **Settings → Variables
and Secrets**, with type **Secret**. It is not part of this repository.
`keep_vars` preserves dashboard-owned variables on deployment. The public client
ID, origin, upload limit, and reviewer IDs in `wrangler.jsonc` are code-owned.

Set this exact callback URL in the GitHub App:

```text
https://rlebench-submissions.congharvard.workers.dev/auth/github/callback
```

No repository or organization permissions, webhook, private key, or installation
are needed for this identity-only flow. GitHub access tokens are used only to
fetch the authenticated identity and are never stored or sent to the browser.

Reviewer access is pinned to these verified numeric GitHub account IDs:

| GitHub username | Account ID |
| --- | --- |
| `mahaitongdae` | `44082254` |
| `typoverflow` | `41679605` |
| `rushi-Q` | `87316432` |

The backend uses the `REVIEWER_IDS` allowlist on every reviewer API request.
Usernames are display names, so renaming an account does not transfer review
access to someone who later claims the old username.

## Local development

Use Node.js 22.13+ (the tests use the built-in SQLite module).

```sh
cd submission-service
npm ci
npm run db:local
npm run dev
```

Open `http://127.0.0.1:8787/submit`. Without credentials, the page shows an explicit
sign-in-unavailable state. For a real local sign-in, copy `.dev.vars.example` to
`.dev.vars`, set the GitHub credentials there, and register this additional
callback in the GitHub App:

```text
http://127.0.0.1:8787/auth/github/callback
```

Local D1 and R2 data live under the ignored `.wrangler/` directory and are separate
from production. The guide, template, icon, and shared styles are copied from the
website by `scripts/sync-assets.mjs` before development, build checks, and deployment.

## Validation and deployment

```sh
npm test
npm run check
npx wrangler whoami
```

The account list must include `b8fb67ed42eed035686205a83734eabf`. If it does not,
authenticate into the account that owns the Worker using `npx wrangler login`,
or arrange access to that account. Do not change `account_id` to work around an
access error: the resources belong to the configured account.

After verifying the target account and the existing bindings/secret:

```sh
npm run db:remote
npm run deploy
```

The first command applies the versioned schema to the remote D1 database; the
second uploads the Worker and its portal assets. Apply only unapplied migrations.
Do not edit previously applied migrations. Keep the R2 bucket's public development
URL and custom-domain access disabled.

Check `/api/health` for `ok: true` and `authConfigured: true`. This checks database
and bucket access and the presence of auth configuration, not the validity of
the GitHub secret. Complete a real GitHub sign-in to verify the registered
callback and credentials. Use a normal contributor account to check ownership
isolation, then one of the three reviewer accounts to check review access.

Deploying this Worker does not publish the GitHub Pages changes. Publish the
contribution guide through the website's existing Git workflow after the portal
is ready.

## Behavior and limits

- `/submit` collects finished task packages; `/propose` collects ideas before
  implementation. `/review` and `/review/proposals` have independent queues.
- Proposals collect the task name, robotics domain, software and versions,
  operating system, licensing category, description, evaluation plan, and email.
  Input materials, reference output, HTTPS resource links, and a difficulty
  self-test are optional. Proposal supporting files use links in this version;
  proposals never need a ZIP and do not write to R2.
- A draft needs only a task name and is private to its author, including from
  reviewers. Contributors can reopen drafts and revise proposals after changes
  are requested. Submitted proposals stay available to their author and reviewers.
  Saving revisions after feedback retains Changes requested until resubmitted.
- Proposal revisions prevent one tab from overwriting a newer edit or review.
  Review history stays attached when an author revises the proposal. An accepted
  proposal does not accept or automatically create a finished task submission.
- Proposal limits allow 10 new records per author per UTC day, 60 edits per
  author per hour, and 120 review updates per reviewer per hour. Identical create
  and edit retries are idempotent. Drafts and proposals have no automatic deletion.
- OAuth returns to the selected task, proposal, or review flow using an allowlist
  stored with the browser-bound state. The GitHub callback URL stays the same.
- Contributors provide title, version, workflow, summary, email, and one ZIP.
- The default and maximum upload size is 25 MiB; lower it with `MAX_UPLOAD_BYTES`.
  Larger supporting datasets should use documented immutable download locations
  and checksums as described in the author guide.
- A metadata record is created before upload. Retries use the same submission ID
  and SHA-256, so a lost response does not duplicate a task. Incomplete uploads
  can be resumed from Details with the original file.
- Archives become immutable once submitted. A revised task is a new submission
  with an updated version; review feedback remains with the original version.
- ZIP checks inspect the directory and file headers, required paths, duplicate
  paths, path traversal, links, compression, and declared expansion size. Limits:
  5,000 entries and 500 MiB declared expanded size. ZIP64 and encryption are not
  supported. These checks do not extract data, validate CRCs or file contents,
  run contributor code, assess grading quality, or certify safety to execute.
- Only the owner and designated reviewers may access submission metadata,
  archives, and feedback. No public R2 URLs or email notifications are used.
- Reviewers can set Submitted, In review, Changes requested, Accepted, or Declined.
  Every update is recorded in an append-only history; notes are visible to the
  contributor. Changes requested and Declined require explanatory feedback.
- Sessions expire after eight hours. Cookies are HttpOnly, Secure in production,
  and SameSite=Lax; stored session tokens are hashed. OAuth state is single-use,
  browser-bound, expires after ten minutes, and includes PKCE. Writes require
  the session CSRF token and the exact configured Origin.
- Limits allow 10 new submission records per account per UTC day, 30 upload
  attempts per account per hour, 30 sign-in starts per IP per hour, and 120 review
  updates per reviewer per hour. Retries of existing metadata do not count as
  new submissions.
- Daily cleanup removes expired sessions, OAuth states, and rate-limit counters.
  Submitted archives and incomplete submission records are retained. There is
  no automated retention/deletion policy in this version.
- Automated task execution is not implemented. Treat downloaded submissions as
  untrusted research artifacts and use a separate sandbox for execution.

## References

- [Agents' Last Exam proposal form](https://agents-last-exam.org/submit/new/form)
- [GitHub App web application flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/)
- [Cloudflare R2 bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
