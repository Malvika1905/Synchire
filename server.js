const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// =========================
// ✅ ENV DEBUG
// =========================
console.log(
  "DATABASE_URL:",
  process.env.DATABASE_URL ? "Loaded ✅" : "Missing ❌"
);

// =========================
// ✅ MIDDLEWARE
// =========================
app.use(cors({
  origin: "*", // 🔥 allow all (change later in production)
}));

app.use(express.json());

// =========================
// ✅ DB CONNECTION CHECK (SAFE)
// =========================
const pool = require("./db");

// 🔥 safer connection test (no hanging connections)
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");

    const res = await client.query(
      "SELECT current_database(), current_user"
    );
    console.log("DB INFO:", res.rows[0]);

    client.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

// =========================
// ✅ ROUTES
// =========================
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

// =========================
// ✅ ROOT ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("Synchire Backend Running 🚀");
});

// =========================
// ✅ HEALTH CHECK (Render useful)
// =========================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// =========================
// ❌ GLOBAL ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

// =========================
// ✅ PORT (Render compatible)
// =========================
const PORT = process.env.PORT || 5000;

// =========================
// 🚀 START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});