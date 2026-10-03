import pool from "../config/db.js";

// Recomputes a task's overall status from its assignments' statuses.
// Not Started: every assignment still Not Started
// In Progress: at least one assignment has moved past Not Started
// Completed:   every assignment is Approved
async function recalcTaskStatus(client, taskId) {
  const result = await client.query(
    `SELECT status FROM task_assignments WHERE task_id = $1`,
    [taskId]
  );
  const statuses = result.rows.map((r) => r.status);
  if (statuses.length === 0) return;

  let newStatus;
  if (statuses.every((s) => s === "Approved")) {
    newStatus = "Completed";
  } else if (statuses.every((s) => s === "Not Started")) {
    newStatus = "Not Started";
  } else {
    newStatus = "In Progress";
  }

  await client.query(`UPDATE tasks SET status = $1 WHERE id = $2`, [newStatus, taskId]);
}

// Shared SELECT fragment: task + creator name + assignment list + progress %
const TASK_SELECT = `
  SELECT t.*,
         creator.full_name AS created_by_name,
         (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = t.id) AS total_assignees,
         (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = t.id AND ta.status = 'Approved') AS approved_assignees,
         (SELECT json_agg(json_build_object(
             'assignment_id', ta.id,
             'employee_id', ta.employee_id,
             'full_name', e.full_name,
             'status', ta.status,
             'submission_report', ta.submission_report,
             'review_note', ta.review_note,
             'reviewed_at', ta.reviewed_at
           ))
          FROM task_assignments ta JOIN employees e ON ta.employee_id = e.id
          WHERE ta.task_id = t.id) AS assignments
  FROM tasks t
  JOIN employees creator ON t.created_by = creator.id
`;

// POST /api/tasks
// body: { title, description, category, priority, start_date, end_date, created_by, assignee_ids: [1,2,3] }
export const createTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      title, description, category, priority,
      start_date, end_date, created_by, assignee_ids,
    } = req.body;

    if (!title || !created_by || !Array.isArray(assignee_ids) || assignee_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "title, created_by, and at least one assignee are required",
      });
    }

    await client.query("BEGIN");

    const taskResult = await client.query(
      `INSERT INTO tasks (title, description, category, priority, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description || null, category || null, priority || "Medium", start_date || null, end_date || null, created_by]
    );

    const task = taskResult.rows[0];

    for (const employeeId of assignee_ids) {
      await client.query(
        `INSERT INTO task_assignments (task_id, employee_id) VALUES ($1, $2)`,
        [task.id, employeeId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, task });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createTask error:", err);
    res.status(500).json({ success: false, message: "Server error creating task" });
  } finally {
    client.release();
  }
};

// GET /api/tasks/my/:employeeId
// Tasks this employee created OR is assigned to, each with full assignment list + progress
export const getMyTasks = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const result = await pool.query(
      `${TASK_SELECT}
       WHERE t.created_by = $1
          OR t.id IN (SELECT task_id FROM task_assignments WHERE employee_id = $1)
       ORDER BY t.created_at DESC`,
      [employeeId]
    );
    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error("getMyTasks error:", err);
    res.status(500).json({ success: false, message: "Server error fetching tasks" });
  }
};

// GET /api/tasks  (admin — everything)
export const getAllTasks = async (req, res) => {
  try {
    const result = await pool.query(`${TASK_SELECT} ORDER BY t.created_at DESC`);
    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error("getAllTasks error:", err);
    res.status(500).json({ success: false, message: "Server error fetching all tasks" });
  }
};

// GET /api/tasks/pending-review  (admin — individual assignments awaiting a decision)
export const getPendingReviewAssignments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ta.*, e.full_name AS employee_name, t.title AS task_title, t.category, t.created_by,
              creator.full_name AS created_by_name
       FROM task_assignments ta
       JOIN employees e ON ta.employee_id = e.id
       JOIN tasks t ON ta.task_id = t.id
       JOIN employees creator ON t.created_by = creator.id
       WHERE ta.status = 'Submitted'
       ORDER BY ta.submitted_at ASC`
    );
    res.json({ success: true, assignments: result.rows });
  } catch (err) {
    console.error("getPendingReviewAssignments error:", err);
    res.status(500).json({ success: false, message: "Server error fetching pending reviews" });
  }
};

// PATCH /api/tasks/assignments/:assignmentId/status
// Assignee starts their own portion: Not Started -> In Progress
export const startAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { assignmentId } = req.params;

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE task_assignments SET status = 'In Progress'
       WHERE id = $1 AND status = 'Not Started'
       RETURNING *`,
      [assignmentId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Assignment not found or already started" });
    }

    await recalcTaskStatus(client, result.rows[0].task_id);
    await client.query("COMMIT");
    res.json({ success: true, assignment: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("startAssignment error:", err);
    res.status(500).json({ success: false, message: "Server error starting assignment" });
  } finally {
    client.release();
  }
};

// POST /api/tasks/assignments/:assignmentId/submit
// Assignee submits their own report -> Submitted
export const submitAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { assignmentId } = req.params;
    const { submission_report } = req.body;

    if (!submission_report || !submission_report.trim()) {
      return res.status(400).json({ success: false, message: "A submission report is required" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE task_assignments
       SET status = 'Submitted', submission_report = $1, submitted_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [submission_report.trim(), assignmentId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    await recalcTaskStatus(client, result.rows[0].task_id);
    await client.query("COMMIT");
    res.json({ success: true, assignment: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("submitAssignment error:", err);
    res.status(500).json({ success: false, message: "Server error submitting assignment" });
  } finally {
    client.release();
  }
};

// PATCH /api/tasks/assignments/:assignmentId/review
// Admin approves (-> Approved) or sends back (-> Needs Rework) one person's submission.
// When the last remaining assignment becomes Approved, the parent task auto-completes.
export const reviewAssignment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { assignmentId } = req.params;
    const { decision, reviewed_by, review_note } = req.body; // decision: 'Approved' | 'Rework'

    if (!["Approved", "Rework"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Invalid decision" });
    }

    const newStatus = decision === "Approved" ? "Approved" : "Needs Rework";

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE task_assignments
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE id = $4
       RETURNING *`,
      [newStatus, reviewed_by, review_note || null, assignmentId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    await recalcTaskStatus(client, result.rows[0].task_id);
    await client.query("COMMIT");
    res.json({ success: true, assignment: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("reviewAssignment error:", err);
    res.status(500).json({ success: false, message: "Server error reviewing assignment" });
  } finally {
    client.release();
  }
};