/**
 * server.js
 *
 * Backend module for HRMS application
 */

// server/server.js

import express from "express";
import dotenv from "dotenv";
import pool from "./config/db.js";
import cors from "cors";
import path from "path";

import employeeRoutes from "./routes/employee.routes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leavesRoutes from "./routes/leavesRoutes.js";
import tasksRoutes from "./routes/tasksRoutes.js";
import visitorsRoutes from "./routes/visitorsRoutes.js";
import salesQueriesRoutes from "./routes/salesQueriesRoutes.js";
import itRoutes from "./routes/itRoutes.js";
import performanceReviewRoutes from "./routes/performanceReview.routes.js";
import chatRoutes from "./routes/chat.routes.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use(cors());

// ========================================================
// EXISTING ROUTES
// ========================================================

app.use("/api/employees", employeeRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/leaves", leavesRoutes);

app.use("/api/tasks", tasksRoutes);

app.use("/api/visitors", visitorsRoutes);

app.use("/api/sales-queries", salesQueriesRoutes);

// ========================================================
// IT HELPDESK
// ========================================================

app.use("/api/it", itRoutes);

// ========================================================
// PERFORMANCE REVIEW
// ========================================================

app.use("/api/performance-reviews", performanceReviewRoutes);

// ========================================================
// CHAT
// ========================================================

app.use("/api/chat", chatRoutes);

app.use(
    "/uploads/chat",
    express.static(path.resolve("uploads/chat"))
);

// ========================================================
// DATABASE TEST
// ========================================================

app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            success: true,
            time: result.rows[0],
        });
    } catch (err) {
        console.error("Database query failed:", err);

        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// ========================================================
// START SERVER
// ========================================================

const startServer = async () => {
    try {
        // Explicitly test PostgreSQL connection
        await pool.query("SELECT 1");

        console.log("Connected to PostgreSQL database");

        app.listen(PORT, () => {
            console.log(
                `Server running on http://localhost:${PORT}`
            );
        });
    } catch (err) {
        console.error(
            "PostgreSQL connection failed:",
            err.message
        );

        process.exit(1);
    }
};

startServer();

