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
    const result = await pool.query(`
      SELECT current_database() AS db,
             current_user AS user
    `);

    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json({
      success: true,
      db: result.rows[0],
      tables: tableCheck.rows
    });

  } catch (err) {
    console.error("❌ DB CHECK ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
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
    sendResponse(res, 500, false, err.message);
  }
});

router.get("/companies", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM companies ORDER BY company_id");
    sendResponse(res, 200, true, "Companies fetched", result.rows);
  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
});

router.get("/slots", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM slots ORDER BY start_time");
    sendResponse(res, 200, true, "Slots fetched", result.rows);
  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
});


// =========================
// ADD STUDENT
// =========================

router.post("/students", async (req, res) => {
  try {
    const { name, email, skills, resume_url } = req.body || {};

    if (!name || !email) {
      return sendResponse(res, 400, false, "Name and email required");
    }

    const safeSkills = normalizeSkills(skills);

    const result = await pool.query(
      `INSERT INTO students (name, email, skills, resume_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), email.trim(), safeSkills, resume_url]
    );

    const student = result.rows[0];

    // AUTO MATCH COMPANIES
    const companies = await pool.query("SELECT * FROM companies");

    for (let company of companies.rows) {
      const companySkills = normalizeSkills(company.required_skills);

      const isMatch =
        companySkills.length === 0 ||
        companySkills.some(skill =>
          safeSkills.some(s =>
            s.includes(skill) || skill.includes(s)
          )
        );

      if (isMatch) {
        await pool.query(
          `INSERT INTO interview_requests (student_id, company_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, company_id) DO NOTHING`,
          [student.student_id, company.company_id]
        );
      }
    }

    sendResponse(res, 201, true, "Student added", student);

  } catch (err) {
    if (err.code === "23505") {
      return sendResponse(res, 400, false, "Email already exists");
    }
    sendResponse(res, 500, false, err.message);
  }
});


// =========================
// ADD COMPANY (🔥 AUTO PANEL)
// =========================

router.post("/companies", async (req, res) => {
  try {
    const { name, industry, interview_priority, required_skills } = req.body || {};

    if (!name || !industry) {
      return sendResponse(res, 400, false, "Name and industry required");
    }

    const safeSkills = normalizeSkills(required_skills);

    const result = await pool.query(
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

    // 🔥 CREATE PANELS
    await pool.query(
      `INSERT INTO panels (name, company_id)
       VALUES ($1, $2), ($3, $2)`,
      [
        `${company.name} Panel 1`,
        company.company_id,
        `${company.name} Panel 2`
      ]
    );

    // 🔥 MATCH STUDENTS
    const students = await pool.query("SELECT * FROM students");

    for (let student of students.rows) {
      const studentSkills = normalizeSkills(student.skills);

      const isMatch =
        safeSkills.length === 0 ||
        safeSkills.some(skill =>
          studentSkills.some(s =>
            s.includes(skill) || skill.includes(s)
          )
        );

      if (isMatch) {
        await pool.query(
          `INSERT INTO interview_requests (student_id, company_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, company_id) DO NOTHING`,
          [student.student_id, company.company_id]
        );
      }
    }

    sendResponse(res, 201, true, "Company added", company);

  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
});


// =========================
// DELETE STUDENT
// =========================

router.delete("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM interview_requests WHERE student_id=$1", [id]);
    await pool.query("DELETE FROM interviews WHERE student_id=$1", [id]);

    const result = await pool.query(
      "DELETE FROM students WHERE student_id=$1",
      [id]
    );

    if (!result.rowCount) {
      return sendResponse(res, 404, false, "Student not found");
    }

    sendResponse(res, 200, true, "Student deleted");

  } catch (err) {
    sendResponse(res, 500, false, err.message);
  }
});


// =========================
// DELETE COMPANY (🔥 FIXED)
// =========================

router.delete("/companies/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM interview_requests WHERE company_id=$1", [id]);

    await pool.query(`
      DELETE FROM interviews
      WHERE panel_id IN (
        SELECT panel_id FROM panels WHERE company_id=$1
      )
    `, [id]);

    await pool.query("DELETE FROM panels WHERE company_id=$1", [id]);

    const result = await pool.query(
      "DELETE FROM companies WHERE company_id=$1",
      [id]
    );

    if (!result.rowCount) {
      return sendResponse(res, 404, false, "Company not found");
    }

    sendResponse(res, 200, true, "Company deleted");

  } catch (err) {
    sendResponse(res, 500, false, err.message);
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
    sendResponse(res, 500, false, err.message);
  }
});


module.exports = router;