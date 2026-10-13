/**
 * visitorsRoutes.js
 *
 * Backend module for HRMS application
 */

import express from "express";

import {
  createVisitor,
  getAllVisitors,
  updateVisitorStatus,
  getVisitorHosts,
} from "../controllers/visitorsController.js";

const router = express.Router();

// Safe list of active employees for "Meeting With"
router.get("/hosts", getVisitorHosts);

// Visitor creation
router.post("/", createVisitor);

// Visitor list
router.get("/", getAllVisitors);

// Visitor lifecycle
router.patch("/:id/status", updateVisitorStatus);

export default router;