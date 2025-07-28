CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    description TEXT NOT NULL,
    stake DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    voter_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    share DECIMAL(10, 2) NOT NULL,

    CONSTRAINT one_vote_per_voter_recipient UNIQUE (session_id, voter_id, recipient_id),
    CONSTRAINT no_self_vote CHECK (voter_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_key ON sessions(key);
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_id ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_recipient_id ON votes(recipient_id);
