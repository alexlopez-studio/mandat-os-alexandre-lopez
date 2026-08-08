const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ 
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    user: 'postgres.byrsmbgfkvgxdtdyhrro',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    port: 5432,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log("Connected to database.");
    
    const sqlFile = process.argv[2];
    if (!sqlFile) throw new Error("Please provide a SQL file path.");
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log("Running migration:", sqlFile);
    
    await client.query(sql);
    console.log("Migration executed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

run();
