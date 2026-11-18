const path = require('path');
const fs = require('fs');
require('dotenv').config();

// PostgreSQL connection string (Supabase / Render / Neon etc.)
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DB_URL;
const isPostgres = Boolean(connectionString && connectionString.trim().length > 0);

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function convertSqlToPostgres(sql) {
  let pg = sql;
  pg = pg.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
  pg = pg.replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE');
  pg = pg.replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE');
  pg = pg.replace(/\bNOW\(\)/gi, 'NOW()');
  pg = convertPlaceholders(pg);
  return pg;
}

if (isPostgres) {
  const { Pool } = require('pg');

  console.log('Connecting to Supabase / PostgreSQL database...');

  const pgPool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const runQuery = async (sql, params = []) => {
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    const isReplace = sql.trim().toUpperCase().startsWith('REPLACE INTO');

    if (isReplace) {
      // Convert SQLite REPLACE INTO to PostgreSQL INSERT ... ON CONFLICT (id) DO UPDATE
      const match = sql.match(/REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const table = match[1];
        const cols = match[2].split(',').map(c => c.trim());
        const updateCols = cols.filter(c => c.toLowerCase() !== 'id');
        const updateClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
        
        const insertSql = `INSERT INTO ${table} (${match[2]}) VALUES (${match[3]}) ON CONFLICT (id) DO UPDATE SET ${updateClause}`;
        const pgSql = convertSqlToPostgres(insertSql);
        const result = await pgPool.query(pgSql, params);
        const insertId = result.rows && result.rows[0]?.id ? result.rows[0].id : null;
        return [{ insertId, affectedRows: result.rowCount }, []];
      }
    }

    let pgSql = convertSqlToPostgres(sql);

    if (isSelect) {
      const result = await pgPool.query(pgSql, params);
      return [result.rows, []];
    } else {
      if (pgSql.trim().toUpperCase().startsWith('INSERT INTO') && !pgSql.toUpperCase().includes('RETURNING')) {
        pgSql += ' RETURNING id';
      }
      const result = await pgPool.query(pgSql, params);
      const insertId = result.rows && result.rows.length > 0 && result.rows[0].id !== undefined ? result.rows[0].id : null;
      return [{ insertId, affectedRows: result.rowCount }, []];
    }
  };

  const pool = {
    query: (sql, params) => runQuery(sql, params),
    getConnection: async () => ({
      beginTransaction: () => runQuery('BEGIN'),
      query: (sql, params) => runQuery(sql, params),
      commit: () => runQuery('COMMIT'),
      rollback: () => runQuery('ROLLBACK'),
      release: () => {},
    }),
  };

  async function initializePostgresDatabase() {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          city TEXT DEFAULT NULL,
          qualification TEXT DEFAULT NULL,
          source TEXT DEFAULT 'website',
          course_interest TEXT DEFAULT NULL,
          status TEXT DEFAULT 'New',
          lead_score INTEGER DEFAULT 0,
          score_category TEXT DEFAULT NULL,
          website_visits INTEGER DEFAULT 0,
          brochure_downloaded BOOLEAN DEFAULT FALSE,
          age INTEGER DEFAULT NULL,
          last_message TEXT DEFAULT NULL,
          last_message_channel TEXT DEFAULT NULL,
          last_message_at TEXT DEFAULT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS counselors (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          status TEXT DEFAULT 'active'
        )
      `);
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS counselor_assignments (
          id SERIAL PRIMARY KEY,
          lead_id INTEGER,
          counselor_id INTEGER,
          counselor_name TEXT,
          assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          notified BOOLEAN DEFAULT FALSE
        )
      `);
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS counselor_config (
          id INTEGER PRIMARY KEY,
          assignmentMode TEXT,
          counselors TEXT,
          roundRobin TEXT
        )
      `);

      const { rows } = await pgPool.query('SELECT COUNT(*) as count FROM counselors');
      if (parseInt(rows[0].count) === 0) {
        console.log('Seeding default counselors into PostgreSQL / Supabase...');
        await pgPool.query("INSERT INTO counselors (id, name, email) VALUES (1, 'Alex Johnson', 'alex@efos.ai') ON CONFLICT (id) DO NOTHING");
        await pgPool.query("INSERT INTO counselors (id, name, email) VALUES (2, 'Sarah Martinez', 'sarah@efos.ai') ON CONFLICT (id) DO NOTHING");
        await pgPool.query("INSERT INTO counselors (id, name, email) VALUES (3, 'Mike Chen', 'mike@efos.ai') ON CONFLICT (id) DO NOTHING");
      }
      console.log('Supabase / PostgreSQL database connected and initialized successfully.');
    } catch (err) {
      console.error('Error connecting to / initializing PostgreSQL database:', err.message);
    }
  }

  initializePostgresDatabase();
  module.exports = pool;

} else {
  console.log('No DATABASE_URL or SUPABASE_DB_URL set. Using local SQLite database...');
  const sqlite3 = require('sqlite3').verbose();

  const dbPath = path.join(__dirname, '../../database/leads.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
    } else {
      console.log('SQLite database connected successfully.');
      initializeDatabase();
    }
  });

  function initializeDatabase() {
    const schema = [
      `CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT DEFAULT NULL,
        qualification TEXT DEFAULT NULL,
        source TEXT DEFAULT 'website',
        course_interest TEXT DEFAULT NULL,
        status TEXT DEFAULT 'New',
        lead_score INTEGER DEFAULT 0,
        score_category TEXT DEFAULT NULL,
        website_visits INTEGER DEFAULT 0,
        brochure_downloaded BOOLEAN DEFAULT 0,
        age INTEGER DEFAULT NULL,
        last_message TEXT DEFAULT NULL,
        last_message_channel TEXT DEFAULT NULL,
        last_message_at TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS counselors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        status TEXT DEFAULT 'active'
      )`,
      `CREATE TABLE IF NOT EXISTS counselor_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        counselor_id INTEGER,
        counselor_name TEXT,
        assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
        notified BOOLEAN DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS counselor_config (
        id INTEGER PRIMARY KEY,
        assignmentMode TEXT,
        counselors TEXT,
        roundRobin TEXT
      )`
    ];

    db.serialize(() => {
      schema.forEach((query) => {
        db.run(query, (err) => {
          if (err) console.error('Error creating table:', err);
        });
      });

      db.get('SELECT COUNT(*) as count FROM counselors', (err, row) => {
        if (row && row.count === 0) {
          console.log('Seeding default counselors into database...');
          db.run("INSERT INTO counselors (id, name, email) VALUES (1, 'Alex Johnson', 'alex@efos.ai')");
          db.run("INSERT INTO counselors (id, name, email) VALUES (2, 'Sarah Martinez', 'sarah@efos.ai')");
          db.run("INSERT INTO counselors (id, name, email) VALUES (3, 'Mike Chen', 'mike@efos.ai')");
        }
      });
    });
  }

  function runQuery(sql, params = []) {
    let sqliteSql = sql;
    sqliteSql = sqliteSql.replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')");

    return new Promise((resolve, reject) => {
      const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        db.all(sqliteSql, params, (err, rows) => {
          if (err) {
            console.error('SQLite query error:', err, 'SQL:', sqliteSql);
            return reject(err);
          }
          resolve([rows, []]);
        });
      } else {
        db.run(sqliteSql, params, function (err) {
          if (err) {
            console.error('SQLite execute error:', err, 'SQL:', sqliteSql);
            return reject(err);
          }
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
        });
      }
    });
  }

  const pool = {
    query: (sql, params) => runQuery(sql, params),
    getConnection: async () => {
      return {
        beginTransaction: () => runQuery('BEGIN TRANSACTION'),
        query: (sql, params) => runQuery(sql, params),
        commit: () => runQuery('COMMIT'),
        rollback: () => runQuery('ROLLBACK'),
        release: () => {}
      };
    }
  };

  module.exports = pool;
}
