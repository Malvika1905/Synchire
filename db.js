const { Pool } = require("pg");

// 🔥 Create pool using environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // ✅ SSL required for Neon (only in production)
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,

  // ✅ Stability settings
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 10
});


// 🔥 Test connection ONCE at startup (safe)
(async () => {
  try {
    const client = await pool.connect();

    console.log("✅ PostgreSQL connected successfully");

    const res = await client.query(
      "SELECT current_database(), current_user"
    );

    console.log("DB INFO:", res.rows[0]);

    client.release();
  } catch (err) {
    console.error("❌ DB CONNECTION ERROR:", err.message);
  }
})();


// 🔥 Handle unexpected errors globally
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL error:", err.message);
});

module.exports = pool;