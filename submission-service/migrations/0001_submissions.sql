CREATE TABLE users (
  github_id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_oauth_expiry ON oauth_states(expires_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  github_id TEXT NOT NULL REFERENCES users(github_id),
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  github_id TEXT NOT NULL REFERENCES users(github_id),
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  workflow TEXT NOT NULL,
  summary TEXT NOT NULL,
  contact TEXT NOT NULL,
  filename TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'submitted', 'in_review', 'changes_requested', 'accepted', 'declined')),
  created_at INTEGER NOT NULL,
  submitted_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_submissions_owner ON submissions(github_id, created_at DESC, id DESC);
CREATE INDEX idx_submissions_queue ON submissions(status, created_at DESC, id DESC);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  reviewer_id TEXT NOT NULL REFERENCES users(github_id),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'in_review', 'changes_requested', 'accepted', 'declined')),
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_reviews_submission ON reviews(submission_id, created_at, id);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_expiry ON rate_limits(expires_at);
