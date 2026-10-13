/**
 * leavesController.js
 *
 * Backend module for HRMS application
 */

import pool from "../config/db.js";

// Helper: count working days (Mon-Sat, skipping Sundays) between two dates
function countWorkingDays(startDate, endDate, isHalfDay) {
  if (isHalfDay) return 0.5;
  let count = 0;
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    if (current.getDay() !== 0) count++; // skip Sundays
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// POST /api/leaves
export const applyLeave = async (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, is_half_day, reason } = req.body;

    if (!employee_id || !leave_type || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, message: "End date cannot be before start date" });
    }

    // Overlap check
    const overlap = await pool.query(
      `SELECT id FROM leaves 
       WHERE employee_id = $1 
       AND status IN ('Pending', 'Approved')
       AND (start_date, end_date) OVERLAPS ($2::date, $3::date)`,
      [employee_id, start_date, end_date]
    );

    if (overlap.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Leave already applied for overlapping dates" });
    }

    const total_days = countWorkingDays(start_date, end_date, is_half_day);

    const result = await pool.query(
      `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, is_half_day, total_days, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [employee_id, leave_type, start_date, end_date, is_half_day || false, total_days, reason]
    );

    res.status(201).json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error("applyLeave error:", err);
    res.status(500).json({ success: false, message: "Server error applying leave" });
  }
};

// GET /api/leaves/my/:employee_id
export const getMyLeaves = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM leaves WHERE employee_id = $1 ORDER BY applied_at DESC`,
      [employee_id]
    );
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error("getMyLeaves error:", err);
    res.status(500).json({ success: false, message: "Server error fetching leaves" });
  }
};

// GET /api/leaves  (admin — all employees)
export const getAllLeaves = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, e.full_name, e.employee_code, e.department
       FROM leaves l
       JOIN employees e ON l.employee_id = e.id
       ORDER BY l.applied_at DESC`
    );
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error("getAllLeaves error:", err);
    res.status(500).json({ success: false, message: "Server error fetching all leaves" });
  }
};

// PATCH /api/leaves/:id/status
export const updateLeaveStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, approved_by } = req.body; // status: 'Approved' | 'Rejected'

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    await client.query("BEGIN");

    const leaveResult = await client.query(
      `UPDATE leaves SET status = $1, approved_by = $2, decided_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, approved_by, id]
    );

    if (leaveResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    const leave = leaveResult.rows[0];

    if (status === "Approved") {
      await client.query(
        `UPDATE employees SET leave_balance = leave_balance - $1::numeric WHERE id = $2`,
        [leave.total_days, leave.employee_id]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, leave });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ success: false, message: "Server error updating leave status" });
  } finally {
    client.release();
  }
};