/**
 * salesQueriesRoutes.js
 *
 * Backend module for HRMS application
 */

// routes/salesQueriesRoutes.js

import express from "express";

import {
    createSalesQuery,
    getAllSalesQueries,
    getSalesQueryNotifications,
    markSalesQueryNotificationRead,
    updateSalesQuery,
    deleteSalesQuery,
} from "../controllers/salesQueriesController.js";

const router = express.Router();

// ============================================================
// CREATE
// POST /api/sales-queries
// ============================================================

router.post(
    "/",
    createSalesQuery
);

// ============================================================
// GET ALL SALES QUERIES
// GET /api/sales-queries
// ============================================================

router.get(
    "/",
    getAllSalesQueries
);

// ============================================================
// SALES QUERY NOTIFICATIONS
//
// IMPORTANT:
// These routes MUST come BEFORE /:id
// ============================================================

// GET notifications for employee
// GET /api/sales-queries/notifications/:employeeId

router.get(
    "/notifications/:employeeId",
    getSalesQueryNotifications
);

// Mark notification as read
// PATCH /api/sales-queries/notifications/:notificationId/read

router.patch(
    "/notifications/:notificationId/read",
    markSalesQueryNotificationRead
);

// ============================================================
// UPDATE
// PATCH /api/sales-queries/:id
// ============================================================

router.patch(
    "/:id",
    updateSalesQuery
);

// ============================================================
// DELETE
// DELETE /api/sales-queries/:id
// ============================================================

router.delete(
    "/:id",
    deleteSalesQuery
);

export default router;