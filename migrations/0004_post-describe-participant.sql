PRAGMA foreign_keys=off;

CREATE TABLE participants_migration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    role_weight DECIMAL(1, 2) NOT NULL DEFAULT 1,
    currency_weight DECIMAL(1, 2) NOT NULL DEFAULT 1
);

INSERT INTO participants_migration (id, session_id, name, description, role_weight, currency_weight)
SELECT id, session_id, name, description, role_weight, currency_weight
FROM participants;

DROP TABLE participants;

ALTER TABLE participants_migration RENAME TO participants;

PRAGMA foreign_keys=on;