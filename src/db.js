const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
  },
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  closeDatabase,
};