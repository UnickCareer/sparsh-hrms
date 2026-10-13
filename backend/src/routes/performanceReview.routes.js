/**
 * performanceReview.routes.js
 *
 * Backend module for HRMS application
 */

import express from "express";

import {
    // ========================================================
    // Employee Performance Review
    // ========================================================
    getMyPerformanceReviews,
    getPerformanceReviewById,
    createPerformanceReview,
    updatePerformanceReview,
    updatePerformanceGoal,
    startPerformanceReview,
    startSelfAssessment,
    submitPerformanceReview,

    // ========================================================
    // Performance Approvals
    // ========================================================
    getPerformanceApprovals,
    getPerformanceApprovalDetail,
    processPerformanceApproval,

    // ========================================================
    // Performance Notifications
    // ========================================================
    getPerformanceNotifications,
    markPerformanceNotificationRead,
} from "../controllers/performanceReview.controller.js";

const router = express.Router();

// ============================================================
// PERFORMANCE REVIEW NOTIFICATIONS
// ============================================================
//
// IMPORTANT:
// These routes MUST come before:
//
//     /:reviewId
//
// Otherwise Express may interpret:
//
//     "notifications"
//
// as a reviewId.
//
// GET
// /api/performance-reviews/notifications/:employeeId
//
// PATCH
// /api/performance-reviews/notifications/:notificationId/read
// ============================================================

router.get(
    "/notifications/:employeeId",
    getPerformanceNotifications
);

router.patch(
    "/notifications/:notificationId/read",
    markPerformanceNotificationRead
);

// ============================================================
// PERFORMANCE APPROVALS
// ============================================================
//
// These routes are ONLY for Performance Review approvals.
//
// Workflow:
//
// Employee
//    ↓
// Submit Goals / Self Assessment
//    ↓
// Manager Review
//    ↓
// Performance Approvals
//    ↓
// Approve → Approved
// Reject  → Needs Correction
//
// GET
// /api/performance-reviews/approvals
//
// GET
// /api/performance-reviews/approvals/:reviewId
//
// PATCH
// /api/performance-reviews/:reviewId/approval
// ============================================================

router.get(
    "/approvals",
    getPerformanceApprovals
);

router.get(
    "/approvals/:reviewId",
    getPerformanceApprovalDetail
);

router.patch(
    "/:reviewId/approval",
    processPerformanceApproval
);

// ============================================================
// GET EMPLOYEE PERFORMANCE REVIEWS
// ============================================================
//
// GET
// /api/performance-reviews/my/:employeeId
//
// Used by the employee Performance Review page.
// ============================================================

router.get(
    "/my/:employeeId",
    getMyPerformanceReviews
);

// ============================================================
// CREATE PERFORMANCE REVIEW
// ============================================================
//
// POST
// /api/performance-reviews
//
// Body:
//
// {
//     cycle_id: 1,
//     employee_id: 44
// }
//
// Creates:
//
// Performance Review
//        +
// Default 5 Goals
//        +
// Review History
// ============================================================

router.post(
    "/",
    createPerformanceReview
);

// ============================================================
// START PERFORMANCE REVIEW
// ============================================================
//
// Normal workflow:
//
// Not Started
//      ↓
// Goals
//
// PATCH
// /api/performance-reviews/:reviewId/start
//
// Body:
//
// {
//     employee_id: 44
// }
//
// This also unlocks the default goals.
// ============================================================

router.patch(
    "/:reviewId/start",
    startPerformanceReview
);

// ============================================================
// START SELF ASSESSMENT
// ============================================================
//
// Normal workflow:
//
// Goals
//      ↓
// Self Assessment
//
// Correction workflow:
//
// Needs Correction
//      ↓
// Self Assessment
//
// PATCH
// /api/performance-reviews/:reviewId/self-assessment
//
// Body:
//
// {
//     employee_id: 44
// }
// ============================================================

router.patch(
    "/:reviewId/self-assessment",
    startSelfAssessment
);

// ============================================================
// SUBMIT PERFORMANCE REVIEW
// ============================================================
//
// Normal workflow:
//
// Self Assessment
//      ↓
// Manager Review
//
// Correction workflow:
//
// Self Assessment
//      ↓
// Manager Review
//
// PATCH
// /api/performance-reviews/:reviewId/submit
//
// Body:
//
// {
//     employee_id: 44
// }
//
// This also:
// - Locks employee goals
// - Creates history
// - Creates approval notifications
// ============================================================

router.patch(
    "/:reviewId/submit",
    submitPerformanceReview
);

// ============================================================
// UPDATE PERFORMANCE GOAL
// ============================================================
//
// PATCH
// /api/performance-reviews/goals/:goalId
//
// Employee fields:
//
// {
//     goal_description,
//     employee_comments,
//     employee_rating,
//     employee_id
// }
//
// Manager fields:
//
// {
//     manager_comments,
//     manager_rating,
//     employee_id
// }
//
// Used while the review is editable.
// ============================================================

router.patch(
    "/goals/:goalId",
    updatePerformanceGoal
);

// ============================================================
// UPDATE PERFORMANCE REVIEW
// ============================================================
//
// PATCH
// /api/performance-reviews/:reviewId
//
// Used for review-level information such as:
//
// - current_stage
// - manager_comments
// - hr_comments
// - final_rating
// ============================================================

router.patch(
    "/:reviewId",
    updatePerformanceReview
);

// ============================================================
// GET SINGLE PERFORMANCE REVIEW
// ============================================================
//
// IMPORTANT:
//
// This dynamic route MUST remain LAST.
//
// Otherwise routes such as:
//
// /approvals
// /notifications
// /my
// /goals
//
// could potentially be interpreted as:
//
// /:reviewId
//
// GET
// /api/performance-reviews/:reviewId
// ============================================================

router.get(
    "/:reviewId",
    getPerformanceReviewById
);

// ============================================================
// EXPORT ROUTER
// ============================================================

export default router;