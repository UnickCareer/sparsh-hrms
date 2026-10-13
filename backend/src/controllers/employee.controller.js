/**
 * employee.controller.js
 *
 * Backend module for HRMS application
 */

import pool from '../config/db.js';

export const getAllEmployees = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employees ORDER BY id');
    res.json({ success: true, employees: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const loginEmployee = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Employee code/email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE employee_code = $1 OR email = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid login ID or password' });
    }

    const employee = result.rows[0];

    if (employee.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid login ID or password' });
    }

    const { password: _, ...employeeWithoutPassword } = employee;

    res.json({ success: true, employee: employeeWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};