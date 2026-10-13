/**
 * employee.routes.js
 *
 * Backend module for HRMS application
 */

import express from 'express';
import { getAllEmployees, loginEmployee } from '../controllers/employee.controller.js';

const router = express.Router();

router.get('/', getAllEmployees);
router.post('/login', loginEmployee);

export default router;