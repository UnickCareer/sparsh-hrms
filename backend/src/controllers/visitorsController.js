/**
 * visitorsController.js
 *
 * Backend module for HRMS application
 */

import pool from "../config/db.js";

// ============================================================
// GET /api/visitors/hosts
// Returns only safe employee information required for
// selecting the employee whom the visitor is meeting.
// ============================================================
export const getVisitorHosts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         employee_code,
         full_name,
         department,
         designation
       FROM employees
       WHERE status = 'Active'
       ORDER BY full_name ASC`
    );

    res.json({
      success: true,
      employees: result.rows,
    });
  } catch (err) {
    console.error("getVisitorHosts error:", err);

    res.status(500).json({
      success: false,
      message: "Server error fetching employees",
    });
  }
};

// ============================================================
// POST /api/visitors
// Create a new visitor
// ============================================================
export const createVisitor = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      company,
      mobile,
      email,
      purpose,
      meeting_date,
      remarks,
      created_by,
      host_employee_id,
    } = req.body;

    if (
      !first_name ||
      !mobile ||
      !purpose ||
      !created_by ||
      !host_employee_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "first_name, mobile, purpose, created_by, and host_employee_id are required",
      });
    }

    // Verify host employee exists and is active
    const hostCheck = await pool.query(
      `SELECT id
       FROM employees
       WHERE id = $1
         AND status = 'Active'`,
      [host_employee_id]
    );

    if (hostCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected host employee was not found or is inactive",
      });
    }

    const result = await pool.query(
      `INSERT INTO visitors (
        first_name,
        last_name,
        company,
        mobile,
        email,
        purpose,
        meeting_date,
        remarks,
        status,
        created_by,
        host_employee_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'Scheduled', $9, $10
      )
      RETURNING *`,
      [
        first_name.trim(),
        last_name?.trim() || null,
        company?.trim() || null,
        mobile.trim(),
        email?.trim() || null,
        purpose.trim(),
        meeting_date || null,
        remarks?.trim() || null,
        created_by,
        host_employee_id,
      ]
    );

    res.status(201).json({
      success: true,
      visitor: result.rows[0],
    });
  } catch (err) {
    console.error("createVisitor error:", err);

    res.status(500).json({
      success: false,
      message: "Server error creating visitor",
    });
  }
};

// ============================================================
// GET /api/visitors
// Get all visitors
// ============================================================
export const getAllVisitors = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         v.*,
         creator.full_name AS created_by_name,
         host.full_name AS host_employee_name,
         checkin.full_name AS checked_in_by_name,
         checkout.full_name AS checked_out_by_name
       FROM visitors v

       JOIN employees creator
         ON v.created_by = creator.id

       LEFT JOIN employees host
         ON v.host_employee_id = host.id

       LEFT JOIN employees checkin
         ON v.checked_in_by = checkin.id

       LEFT JOIN employees checkout
         ON v.checked_out_by = checkout.id

       ORDER BY v.created_at DESC`
    );

    res.json({
      success: true,
      visitors: result.rows,
    });
  } catch (err) {
    console.error("getAllVisitors error:", err);

    res.status(500).json({
      success: false,
      message: "Server error fetching visitors",
    });
  }
};

// ============================================================
// PATCH /api/visitors/:id/status
//
// Allowed transitions:
//
// Scheduled
//    → Checked In
//    → Cancelled
//
// Checked In
//    → Checked Out
//
// Checked Out
//    → nothing
//
// Cancelled
//    → nothing
// ============================================================
export const updateVisitorStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status, employee_id } = req.body;

    const allowedStatuses = [
      "Scheduled",
      "Checked In",
      "Checked Out",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "employee_id is required",
      });
    }

    await client.query("BEGIN");

    const visitorResult = await client.query(
      `SELECT *
       FROM visitors
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (visitorResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    const visitor = visitorResult.rows[0];

    // --------------------------------------------------------
    // Validate status transition
    // --------------------------------------------------------

    if (visitor.status === "Scheduled") {
      if (!["Checked In", "Cancelled"].includes(status)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "A Scheduled visitor can only be Checked In or Cancelled",
        });
      }
    }

    if (visitor.status === "Checked In") {
      if (status !== "Checked Out") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "A Checked In visitor can only be Checked Out",
        });
      }
    }

    if (
      visitor.status === "Checked Out" ||
      visitor.status === "Cancelled"
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "This visitor's visit is already closed and cannot be changed",
      });
    }

    // --------------------------------------------------------
    // Checked In
    // --------------------------------------------------------

    if (status === "Checked In") {
      const result = await client.query(
        `UPDATE visitors
         SET
           status = 'Checked In',
           checked_in_at = NOW(),
           checked_in_by = $1
         WHERE id = $2
         RETURNING *`,
        [employee_id, id]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        visitor: result.rows[0],
      });
    }

    // --------------------------------------------------------
    // Checked Out
    // --------------------------------------------------------

    if (status === "Checked Out") {
      const result = await client.query(
        `UPDATE visitors
         SET
           status = 'Checked Out',
           checked_out_at = NOW(),
           checked_out_by = $1
         WHERE id = $2
         RETURNING *`,
        [employee_id, id]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        visitor: result.rows[0],
      });
    }

    // --------------------------------------------------------
    // Cancelled
    // --------------------------------------------------------

    if (status === "Cancelled") {
      const result = await client.query(
        `UPDATE visitors
         SET status = 'Cancelled'
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        visitor: result.rows[0],
      });
    }

    await client.query("ROLLBACK");

    return res.status(400).json({
      success: false,
      message: "Unsupported status change",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("updateVisitorStatus error:", err);

    res.status(500).json({
      success: false,
      message: "Server error updating visitor status",
    });
  } finally {
    client.release();
  }
};