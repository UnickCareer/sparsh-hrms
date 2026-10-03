import pool from "../config/db.js";

// POST /api/attendance/checkin
export const checkIn = async (req, res) => {
  const { employee_id, latitude, longitude, location_name, district, state, late_reason } = req.body;
  if (!employee_id) return res.status(400).json({ success: false, message: "employee_id is required" });

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const checkInTime = now.toTimeString().split(" ")[0];

  const cutoffMinutes = 9 * 60 + 30;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isLate = nowMinutes > cutoffMinutes;

  if (isLate && !late_reason) {
    return res.status(400).json({ success: false, message: "Late reason is required after 9:30" });
  }

  try {
    const existing = await pool.query(
      "SELECT * FROM attendance WHERE employee_id = $1 AND date = $2",
      [employee_id, today]
    );
    if (existing.rows.length > 0 && existing.rows[0].check_in) {
      return res.status(400).json({ success: false, message: "Already checked in today" });
    }

    const status = isLate ? "Late" : "Present";

  const result = await pool.query(
    `INSERT INTO attendance (employee_id, date, check_in, status, latitude, longitude, location_name, district, state, late_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (employee_id, date)
     DO UPDATE SET check_in = $3, status = $4, latitude = $5, longitude = $6, location_name = $7, district = $8, state = $9, late_reason = $10
     RETURNING *, to_char(date, 'YYYY-MM-DD') AS date_str`,
    [employee_id, today, checkInTime, status, latitude || null, longitude || null, location_name || null, district || null, state || null, late_reason || null]
  );

    res.status(200).json({ success: true, attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/attendance/checkout
export const checkOut = async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ success: false, message: "employee_id is required" });

  const today = new Date().toISOString().split("T")[0];

  try {
    const existing = await pool.query(
      "SELECT * FROM attendance WHERE employee_id = $1 AND date = $2",
      [employee_id, today]
    );
    if (existing.rows.length === 0 || !existing.rows[0].check_in) {
      return res.status(400).json({ success: false, message: "You haven't checked in today" });
    }
    if (existing.rows[0].check_out) {
      return res.status(400).json({ success: false, message: "Already checked out today" });
    }

    const checkOutTime = new Date().toTimeString().split(" ")[0];

    const result = await pool.query(
      `UPDATE attendance SET check_out = $1 WHERE employee_id = $2 AND date = $3
       RETURNING *, to_char(date, 'YYYY-MM-DD') AS date_str`,
      [checkOutTime, employee_id, today]
    );

    res.status(200).json({ success: true, attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/attendance/:employeeId?month=8&year=2026
export const getMonthlyAttendance = async (req, res) => {
  const { employeeId } = req.params;
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ success: false, message: "month and year are required" });
  }

  try {
    const result = await pool.query(
      `SELECT *, to_char(date, 'YYYY-MM-DD') AS date_str FROM attendance
       WHERE employee_id = $1
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3
       ORDER BY date ASC`,
      [employeeId, month, year]
    );
    res.status(200).json({ success: true, attendance: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/attendance/:employeeId/today
export const getTodayStatus = async (req, res) => {
  const { employeeId } = req.params;
  const today = new Date().toISOString().split("T")[0];

  try {
    const result = await pool.query(
      "SELECT *, to_char(date, 'YYYY-MM-DD') AS date_str FROM attendance WHERE employee_id = $1 AND date = $2",
      [employeeId, today]
    );
    res.status(200).json({ success: true, attendance: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/attendance/reverse-geocode?lat=..&lng=..
export const reverseGeocode = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ success: false, message: "lat and lng are required" });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "User-Agent": "sparsh-hrms-attendance/1.0" } }
    );
    const data = await response.json();
    const addr = data.address || {};

    const placeName =
      addr.amenity || addr.building || addr.road || addr.neighbourhood ||
      addr.suburb || addr.village || addr.town || addr.city_district ||
      addr.city || "Unknown location";

    const district = addr.state_district || addr.county || null;
    const state = addr.state || null;

    res.status(200).json({
      success: true,
      location_name: placeName,
      district,
      state,
      full_address: data.display_name || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not resolve location" });
  }
};