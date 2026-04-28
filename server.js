const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ✅ DEBUG: check if env is loading
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Loaded ✅" : "Missing ❌");

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json());

// ✅ DB CONNECTION CHECK (VERY IMPORTANT)
const pool = require("./db");

pool.connect()
  .then(() => {
    console.log("✅ Database connected successfully");
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
  });

// ✅ ROUTES
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

// ✅ ROOT TEST ROUTE
app.get("/", (req, res) => {
  res.send("Synchire Backend Running 🚀");
});

// ✅ PORT (Render/Vercel compatible)
const PORT = process.env.PORT || 5000;

// ✅ START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});