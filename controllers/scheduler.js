const pool = require("../db");

const generateSchedule = async () => {
  try {
    // 🔥 Clear old schedule
    await pool.query("DELETE FROM interviews");

    // 🔥 Fetch all requests
    const requests = (
      await pool.query(`
        SELECT
          ir.request_id,
          ir.student_id,
          ir.company_id,
          s.skills,
          c.required_skills,
          c.interview_priority
        FROM interview_requests ir
        JOIN students s ON ir.student_id = s.student_id
        JOIN companies c ON ir.company_id = c.company_id
        ORDER BY c.interview_priority DESC, ir.request_id ASC
      `)
    ).rows;

    const panels = (await pool.query("SELECT * FROM panels")).rows;

    const slots = (
      await pool.query("SELECT * FROM slots ORDER BY start_time")
    ).rows;

    const usedStudentSlot = new Set();
    const usedPanelSlot = new Set();
    const studentInterviewCount = {};

    // 🔥 GROUP requests by company (for fairness)
    const companyMap = {};
    for (const req of requests) {
      if (!companyMap[req.company_id]) {
        companyMap[req.company_id] = [];
      }
      companyMap[req.company_id].push(req);
    }

    const companyIds = Object.keys(companyMap);

    let scheduledSomething = true;

    // 🔥 ROUND ROBIN SCHEDULING
    while (scheduledSomething) {
      scheduledSomething = false;

      for (const companyId of companyIds) {
        const companyRequests = companyMap[companyId];

        for (let i = 0; i < companyRequests.length; i++) {
          const req = companyRequests[i];

          studentInterviewCount[req.student_id] ||= 0;

          // Max 3 interviews
          if (studentInterviewCount[req.student_id] >= 3) continue;

          // 🔥 Normalize skills
          const studentSkills = (req.skills || []).map(s =>
            s.toLowerCase().trim()
          );

          const requiredSkills = (req.required_skills || []).map(s =>
            s.toLowerCase().trim()
          );

          // 🔥 FLEXIBLE MATCH
          const skillMatch =
            requiredSkills.length === 0 ||
            requiredSkills.some(reqSkill =>
              studentSkills.some(stuSkill =>
                stuSkill.includes(reqSkill) ||
                reqSkill.includes(stuSkill)
              )
            );

          if (!skillMatch) continue;

          let scheduled = false;

          for (const slot of slots) {
            if (scheduled) break;

            for (const panel of panels) {
              if (panel.company_id != req.company_id) continue;

              const studentKey = `${req.student_id}-${slot.slot_id}`;
              const panelKey = `${panel.panel_id}-${slot.slot_id}`;

              if (
                !usedStudentSlot.has(studentKey) &&
                !usedPanelSlot.has(panelKey)
              ) {
                await pool.query(
                  `
                  INSERT INTO interviews
                  (student_id, panel_id, slot_id)
                  VALUES ($1, $2, $3)
                  `,
                  [
                    req.student_id,
                    panel.panel_id,
                    slot.slot_id
                  ]
                );

                usedStudentSlot.add(studentKey);
                usedPanelSlot.add(panelKey);

                studentInterviewCount[req.student_id]++;
                scheduledSomething = true;
                scheduled = true;

                break;
              }
            }
          }
        }
      }
    }

    // 🔥 Return final schedule
    const result = await pool.query(`
      SELECT
        s.name AS student,
        s.email,
        c.name AS company,
        c.industry,
        p.name AS panel,
        sl.start_time,
        sl.end_time
      FROM interviews i
      JOIN students s ON i.student_id = s.student_id
      JOIN panels p ON i.panel_id = p.panel_id
      JOIN companies c ON p.company_id = c.company_id
      JOIN slots sl ON i.slot_id = sl.slot_id
      ORDER BY sl.start_time, student
    `);

    return result.rows;

  } catch (err) {
    console.error("SCHEDULER ERROR:", err);
    return [];
  }
};

module.exports = { generateSchedule };