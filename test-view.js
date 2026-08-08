const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    CREATE TEMP TABLE t_projects (id int, kind text, a text, b text);
    CREATE VIEW v_opps AS SELECT id, a FROM t_projects WHERE kind = 'opp';
    INSERT INTO v_opps (id, a) VALUES (1, 'test');
  `);
  const res = await client.query('SELECT * FROM t_projects;');
  console.log(res.rows);
  await client.end();
}
run();
