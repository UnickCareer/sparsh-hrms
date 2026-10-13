/**
 * leavesRoutes.js
 *
 * Backend module for HRMS application
 */

import express from "express";
import {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
} from "../controllers/leavesController.js";

const router = express.Router();

router.post("/", applyLeave);
router.get("/my/:employee_id", getMyLeaves);
router.get("/", getAllLeaves);
router.patch("/:id/status", updateLeaveStatus);

export default router;