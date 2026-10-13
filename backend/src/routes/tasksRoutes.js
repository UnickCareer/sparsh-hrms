/**
 * tasksRoutes.js
 *
 * Backend module for HRMS application
 */

import express from "express";
import {
  createTask,
  getMyTasks,
  getAllTasks,
  getPendingReviewAssignments,
  startAssignment,
  submitAssignment,
  reviewAssignment,
} from "../controllers/tasksController.js";

const router = express.Router();

router.post("/", createTask);
router.get("/pending-review", getPendingReviewAssignments);
router.get("/my/:employeeId", getMyTasks);
router.get("/", getAllTasks);
router.patch("/assignments/:assignmentId/status", startAssignment);
router.post("/assignments/:assignmentId/submit", submitAssignment);
router.patch("/assignments/:assignmentId/review", reviewAssignment);

export default router;