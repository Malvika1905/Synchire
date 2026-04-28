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
app.use(cors({ origin: "*" }));
app.use(express.json());

// =========================
// ✅ REQUEST LOGGER (🔥 helps debug 404 issues)
// =========================
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  next();
});

// =========================
// ✅ DB CONNECTION CHECK (SAFE)
// =========================
const pool = require("./db");

(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");

    const result = await client.query(
      "SELECT current_database(), current_user"
    );
    console.log("DB INFO:", result.rows[0]);

    client.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

// =========================
// ✅ ROUTES
// =========================
const apiRoutes = require("./routes/api");

// 🔥 log to confirm routes loaded
console.log("✅ API routes loaded");

app.use("/api", apiRoutes);

// =========================
// ✅ ROOT ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("Synchire Backend Running 🚀");
});

// =========================
// ✅ HEALTH CHECK
// =========================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// =========================
// ❌ 404 HANDLER (🔥 IMPORTANT)
// =========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
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
// ✅ PORT
// =========================
const PORT = process.env.PORT || 5000;

// =========================
// 🚀 START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});