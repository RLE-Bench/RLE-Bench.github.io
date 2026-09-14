-- Keep proposals independent of finished task archives and their review history.
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  github_id TEXT NOT NULL REFERENCES users(github_id),
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'in_review', 'changes_requested', 'accepted', 'declined')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  submitted_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_proposals_owner ON proposals(github_id, created_at DESC, id DESC);
CREATE INDEX idx_proposals_queue ON proposals(status, created_at DESC, id DESC);

CREATE TABLE proposal_reviews (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  reviewer_id TEXT NOT NULL REFERENCES users(github_id),
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'in_review', 'changes_requested', 'accepted', 'declined')),
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_proposal_reviews ON proposal_reviews(proposal_id, created_at, id);

ALTER TABLE oauth_states ADD COLUMN return_path TEXT NOT NULL DEFAULT '/submit';
