const express = require("express");
const router = express.Router();
const pool = require("../db");
const { generateSchedule } = require("../controllers/scheduler");

// =========================
// HELPERS
// =========================

const normalizeSkills = (skills) => {
  if (!skills) return [];

  if (Array.isArray(skills)) {
    return skills.map((s) => s.toLowerCase().trim());
  }

  if (typeof skills === "string") {
    return skills
      .split(",")
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);
  }

  return [];
};

const sendResponse = (res, status, success, message, data = null) => {
  return res.status(status).json({
    success,
    message,
    data
  });
};

const validateId = (id) => {
  const num = Number(id);
  return Number.isInteger(num) && num > 0 ? num : null;
};

// =========================
// TEST BACKEND
// =========================

router.get("/test-backend", (req, res) => {
  res.json({
    success: true,
    message: "Correct backend is running"
  });
});

// =========================
// DB CHECK
// =========================

router.get("/db-check", async (req, res) => {
  try {
    const db = await pool.query(`
      SELECT current_database() AS db,
             current_user AS user
    `);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json({
      success: true,
      db: db.rows[0],
      tables: tables.rows
    });

  } catch (err) {
    console.error("DB CHECK ERROR:", err);
    sendResponse(res, 500, false, err.message);
  }
});

// =========================
// GET ROUTES
// =========================

router.get("/students", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students ORDER BY student_id");
    sendResponse(res, 200, true, "Students fetched", result.rows);
  } catch (err) {
    console.error("GET STUDENTS ERROR:", err);
    sendResponse(res, 500, false, err.message);
  }
});

router.get("/companies", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM companies ORDER BY company_id");
    sendResponse(res, 200, true, "Companies fetched", result.rows);
  } catch (err) {
    console.error("GET COMPANIES ERROR:", err);
    sendResponse(res, 500, false, err.message);
  }
});

router.get("/slots", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM slots ORDER BY start_time");
    sendResponse(res, 200, true, "Slots fetched", result.rows);
  } catch (err) {
    console.error("GET SLOTS ERROR:", err);
    sendResponse(res, 500, false, err.message);
  }
});

// =========================
// ADD STUDENT (🔥 SAFE TX)
// =========================

router.post("/students", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { name, email, skills, resume_url } = req.body || {};

    if (!name || !email) {
      await client.query("ROLLBACK");
      return sendResponse(res, 400, false, "Name and email required");
    }

    const safeSkills = normalizeSkills(skills);

    const result = await client.query(
      `INSERT INTO students (name, email, skills, resume_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), email.trim(), safeSkills, resume_url]
    );

    const student = result.rows[0];

    const companies = await client.query("SELECT * FROM companies");

    for (let company of companies.rows) {
      const companySkills = normalizeSkills(company.required_skills);

      const isMatch =
        companySkills.length === 0 ||
        companySkills.some(skill =>
          safeSkills.some(s => s.includes(skill) || skill.includes(s))
        );

      if (isMatch) {
        await client.query(
          `INSERT INTO interview_requests (student_id, company_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, company_id) DO NOTHING`,
          [student.student_id, company.company_id]
        );
      }
    }

    await client.query("COMMIT");
    sendResponse(res, 201, true, "Student added", student);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ADD STUDENT ERROR:", err);

    if (err.code === "23505") {
      return sendResponse(res, 400, false, "Email already exists");
    }

    sendResponse(res, 500, false, err.message);

  } finally {
    client.release();
  }
});

// =========================
// ADD COMPANY (🔥 FULL SAFE)
// =========================

router.post("/companies", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { name, industry, interview_priority, required_skills } = req.body || {};

    if (!name || !industry) {
      await client.query("ROLLBACK");
      return sendResponse(res, 400, false, "Name and industry required");
    }

    const safeSkills = normalizeSkills(required_skills);

    const result = await client.query(
      `INSERT INTO companies
       (name, industry, interview_priority, required_skills)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        name.trim(),
        industry.trim(),
        interview_priority || 1,
        safeSkills
      ]
    );

    const company = result.rows[0];

    // CREATE PANELS
    await client.query(
      `INSERT INTO panels (name, company_id)
       VALUES ($1, $2), ($3, $2)`,
      [
        `${company.name} Panel 1`,
        company.company_id,
        `${company.name} Panel 2`
      ]
    );

    const students = await client.query("SELECT * FROM students");

    for (let student of students.rows) {
      const studentSkills = normalizeSkills(student.skills);

      const isMatch =
        safeSkills.length === 0 ||
        safeSkills.some(skill =>
          studentSkills.some(s => s.includes(skill) || skill.includes(s))
        );

      if (isMatch) {
        await client.query(
          `INSERT INTO interview_requests (student_id, company_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, company_id) DO NOTHING`,
          [student.student_id, company.company_id]
        );
      }
    }

    await client.query("COMMIT");
    sendResponse(res, 201, true, "Company added", company);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ADD COMPANY ERROR:", err);
    sendResponse(res, 500, false, err.message);

  } finally {
    client.release();
  }
});

// =========================
// DELETE STUDENT
// =========================

router.delete("/students/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const id = validateId(req.params.id);
    if (!id) {
      await client.query("ROLLBACK");
      return sendResponse(res, 400, false, "Invalid ID");
    }

    await client.query("DELETE FROM interview_requests WHERE student_id=$1", [id]);
    await client.query("DELETE FROM interviews WHERE student_id=$1", [id]);

    const result = await client.query(
      "DELETE FROM students WHERE student_id=$1",
      [id]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return sendResponse(res, 404, false, "Student not found");
    }

    await client.query("COMMIT");
    sendResponse(res, 200, true, "Student deleted");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE STUDENT ERROR:", err);
    sendResponse(res, 500, false, err.message);

  } finally {
    client.release();
  }
});

// =========================
// DELETE COMPANY
// =========================

router.delete("/companies/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const id = validateId(req.params.id);
    if (!id) {
      await client.query("ROLLBACK");
      return sendResponse(res, 400, false, "Invalid ID");
    }

    await client.query("DELETE FROM interview_requests WHERE company_id=$1", [id]);

    await client.query(`
      DELETE FROM interviews
      WHERE panel_id IN (
        SELECT panel_id FROM panels WHERE company_id=$1
      )
    `, [id]);

    await client.query("DELETE FROM panels WHERE company_id=$1", [id]);

    const result = await client.query(
      "DELETE FROM companies WHERE company_id=$1",
      [id]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return sendResponse(res, 404, false, "Company not found");
    }

    await client.query("COMMIT");
    sendResponse(res, 200, true, "Company deleted");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE COMPANY ERROR:", err);
    sendResponse(res, 500, false, err.message);

  } finally {
    client.release();
  }
});

// =========================
// GENERATE SCHEDULE
// =========================

router.post("/generate", async (req, res) => {
  try {
    const result = await generateSchedule();
    sendResponse(res, 200, true, "Schedule generated", result);
  } catch (err) {
    console.error("SCHEDULE ERROR:", err);
    sendResponse(res, 500, false, err.message);
  }
});

module.exports = router;