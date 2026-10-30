import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');

/** Parameterized PostgreSQL queries. All application replicas must use the same database. */
export async function createStore(database) {
  await database.query('CREATE TABLE IF NOT EXISTS partylayer_challenges (nonce TEXT PRIMARY KEY, browser TEXT NOT NULL, value JSONB NOT NULL, expires BIGINT NOT NULL)');
  await database.query('CREATE TABLE IF NOT EXISTS partylayer_sessions (token TEXT PRIMARY KEY, identity JSONB NOT NULL, expires BIGINT NOT NULL, browser TEXT NOT NULL)');
  await database.query('CREATE TABLE IF NOT EXISTS partylayer_browsers (binding TEXT PRIMARY KEY, revoked BOOLEAN NOT NULL, expires BIGINT NOT NULL)');
  await database.query('CREATE TABLE IF NOT EXISTS partylayer_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL)');
  const transaction = async action => {
    if (typeof database.transaction === 'function') return database.transaction(action); // PGlite test engine.
    const connection = await database.connect(); // node-postgres: one checked-out connection for the entire transaction.
    try { await connection.query('BEGIN'); const result = await action(connection); await connection.query('COMMIT'); return result; }
    catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
  };
  return {
    async insert(challenge, browser) {
      const now = Date.now();
      await database.query('DELETE FROM partylayer_challenges WHERE expires < $1', [now]);
      await database.query('DELETE FROM partylayer_sessions WHERE expires < $1', [now]);
      await transaction(async connection => {
        await connection.query('DELETE FROM partylayer_browsers WHERE expires < $1', [now]);
        await connection.query('INSERT INTO partylayer_browsers VALUES ($1, false, $2)', [hash(browser), now + 3600_000]);
        await connection.query('INSERT INTO partylayer_challenges VALUES ($1, $2, $3, $4)', [challenge.nonce, hash(browser), JSON.stringify(challenge), Date.parse(challenge.expiresAt)]);
      });
    },
    async consume(nonce, browser) {
      // DELETE ... RETURNING is one database statement, not GET followed by DELETE.
      const { rows } = await database.query('DELETE FROM partylayer_challenges WHERE nonce = $1 AND browser = $2 RETURNING value', [nonce, hash(browser)]);
      return rows[0]?.value ?? null;
    },
    async session(token) {
      if (!token) return null;
      const { rows } = await database.query('SELECT identity FROM partylayer_sessions WHERE token = $1 AND expires > $2', [hash(token), Date.now()]);
      return rows[0]?.identity ?? null;
    },
    async establish(token, identity, previousToken, browser) {
      await transaction(async connection => {
        const { rows } = await connection.query('SELECT revoked, expires FROM partylayer_browsers WHERE binding = $1 FOR UPDATE', [hash(browser)]);
        if (!rows.length || rows[0].revoked || Number(rows[0].expires) <= Date.now()) throw new Error('Browser sign-in was revoked');
        await connection.query('DELETE FROM partylayer_sessions WHERE token = $1', [hash(previousToken ?? '')]);
        await connection.query('INSERT INTO partylayer_sessions VALUES ($1, $2, $3, $4)', [hash(token), JSON.stringify(identity), Date.now() + 3600_000, hash(browser)]);
        await connection.query('UPDATE partylayer_browsers SET revoked = true WHERE binding = $1', [hash(browser)]);
        await connection.query('DELETE FROM partylayer_challenges WHERE browser = $1', [hash(browser)]);
      });
    },
    async logout(token, browser) {
      await transaction(async connection => {
        const { rows } = await connection.query('SELECT browser FROM partylayer_sessions WHERE token = $1', [hash(token ?? '')]);
        const bindings = [...new Set([...(browser ? [hash(browser)] : []), ...rows.map(row => row.browser)])].sort();
        for (const binding of bindings) {
          // Serialize with establish(): a late verification cannot re-open a logged-out browser.
          await connection.query('SELECT binding FROM partylayer_browsers WHERE binding = $1 FOR UPDATE', [binding]);
          await connection.query('UPDATE partylayer_browsers SET revoked = true WHERE binding = $1', [binding]);
          await connection.query('DELETE FROM partylayer_sessions WHERE browser = $1', [binding]);
          await connection.query('DELETE FROM partylayer_challenges WHERE browser = $1', [binding]);
        }
        await connection.query('DELETE FROM partylayer_sessions WHERE token = $1', [hash(token ?? '')]);
      });
    },
    async limit(address, path) {
      const now = Date.now();
      await database.query('DELETE FROM partylayer_limits WHERE expires < $1', [now]);
      const { rows } = await database.query('INSERT INTO partylayer_limits VALUES ($1, 1, $2) ON CONFLICT(bucket) DO UPDATE SET count = partylayer_limits.count + 1 RETURNING count',
        [hash(`${address}:${path}:${Math.floor(now / 60_000)}`), now + 60_000]);
      return rows[0].count <= 30;
    },
  };
}
