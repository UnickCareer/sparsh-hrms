// controllers/salesQueriesController.js

import pool from "../config/db.js";

// ============================================================
// CREATE SALES QUERY
// POST /api/sales-queries
// ============================================================

export const createSalesQuery = async (req, res) => {
    try {
        const {
            query_date,
            customer,
            contact,
            email,
            requirement,
            meeting_date,
            primary_amount,
            secondary_amount,
            status,
            follow_up_date,
            source,
            assigned_to,
            created_by,
        } = req.body;

        // ========================================================
        // REQUIRED FIELDS
        // ========================================================

        if (!customer || !contact || !created_by) {
            return res.status(400).json({
                success: false,
                message:
                    "customer, contact, and created_by are required",
            });
        }

        // ========================================================
        // VERIFY CREATOR
        // ========================================================

        const creatorCheck = await pool.query(
            `
            SELECT id
            FROM employees
            WHERE id = $1
            `,
            [created_by]
        );

        if (creatorCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid created_by employee",
            });
        }

        // ========================================================
        // VERIFY ASSIGNEE
        // ========================================================

        if (
            assigned_to !== null &&
            assigned_to !== undefined &&
            assigned_to !== ""
        ) {
            const assigneeCheck = await pool.query(
                `
                SELECT id
                FROM employees
                WHERE id = $1
                `,
                [assigned_to]
            );

            if (assigneeCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Selected assigned employee does not exist",
                });
            }
        }

        const normalizedAssignedTo =
            assigned_to === "" ||
            assigned_to === undefined
                ? null
                : assigned_to;

        // ========================================================
        // CREATE SALES QUERY
        // ========================================================

        const result = await pool.query(
            `
            INSERT INTO sales_queries (
                query_date,
                customer,
                contact,
                email,
                requirement,
                meeting_date,
                primary_amount,
                secondary_amount,
                status,
                follow_up_date,
                source,
                assigned_to,
                created_by
            )
            VALUES (
                COALESCE($1, CURRENT_DATE),
                $2,
                $3,
                $4,
                $5,
                $6,
                COALESCE($7, 0),
                COALESCE($8, 0),
                COALESCE($9, 'New'),
                $10,
                $11,
                $12,
                $13
            )
            RETURNING *
            `,
            [
                query_date || null,
                customer.trim(),
                contact.trim(),
                email || null,
                requirement || null,
                meeting_date || null,
                primary_amount ?? 0,
                secondary_amount ?? 0,
                status || "New",
                follow_up_date || null,
                source || "Direct",
                normalizedAssignedTo,
                created_by,
            ]
        );

        const createdQuery = result.rows[0];

        // ========================================================
        // CREATE NOTIFICATION
        //
        // IMPORTANT:
        // If creator assigns the query to himself:
        // NO notification.
        //
        // If creator assigns it to another employee:
        // CREATE notification for that employee.
        // ========================================================

        if (
            normalizedAssignedTo &&
            String(normalizedAssignedTo) !==
                String(created_by)
        ) {
            await pool.query(
                `
                INSERT INTO sales_query_notifications (
                    sales_query_id,
                    recipient_employee_id,
                    assigned_by,
                    notification_type,
                    title,
                    message
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'sales_query_assignment',
                    $4,
                    $5
                )
                `,
                [
                    createdQuery.id,
                    normalizedAssignedTo,
                    created_by,
                    "New Sales Query assigned to you",
                    `Customer: ${createdQuery.customer}`,
                ]
            );
        }

        res.status(201).json({
            success: true,
            message:
                "Sales query created successfully",
            query: createdQuery,
        });
    } catch (err) {
        console.error(
            "createSalesQuery error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Server error creating sales query",
        });
    }
};

// ============================================================
// GET ALL SALES QUERIES
// GET /api/sales-queries
// ============================================================

export const getAllSalesQueries = async (
    req,
    res
) => {
    try {
        const result = await pool.query(
            `
            SELECT
                sq.*,

                creator.full_name AS created_by_name,

                assignee.full_name AS assigned_to_name

            FROM sales_queries sq

            LEFT JOIN employees creator
                ON sq.created_by = creator.id

            LEFT JOIN employees assignee
                ON sq.assigned_to = assignee.id

            ORDER BY sq.created_at DESC
            `
        );

        res.json({
            success: true,
            queries: result.rows,
        });
    } catch (err) {
        console.error(
            "getAllSalesQueries error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Server error fetching sales queries",
        });
    }
};

// ============================================================
// GET SALES QUERY NOTIFICATIONS
//
// GET /api/sales-queries/notifications/:employeeId
//
// Returns ONLY notifications belonging to that employee.
// ============================================================

export const getSalesQueryNotifications = async (
    req,
    res
) => {
    try {
        const { employeeId } = req.params;

        const employeeCheck = await pool.query(
            `
            SELECT id
            FROM employees
            WHERE id = $1
            `,
            [employeeId]
        );

        if (employeeCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const result = await pool.query(
            `
            SELECT
                n.id,
                n.sales_query_id,
                n.recipient_employee_id,
                n.assigned_by,
                n.notification_type,
                n.title,
                n.message,
                n.read_at,
                n.created_at,

                sq.customer,
                sq.contact,
                sq.status AS query_status,

                assigner.full_name AS assigned_by_name

            FROM sales_query_notifications n

            LEFT JOIN sales_queries sq
                ON n.sales_query_id = sq.id

            LEFT JOIN employees assigner
                ON n.assigned_by = assigner.id

            WHERE n.recipient_employee_id = $1

            ORDER BY n.created_at DESC

            LIMIT 25
            `,
            [employeeId]
        );

        const unreadResult = await pool.query(
            `
            SELECT COUNT(*)::int AS unread_count
            FROM sales_query_notifications
            WHERE recipient_employee_id = $1
            AND read_at IS NULL
            `,
            [employeeId]
        );

        res.json({
            success: true,
            notifications: result.rows,
            unreadCount:
                unreadResult.rows[0]?.unread_count || 0,
        });
    } catch (err) {
        console.error(
            "getSalesQueryNotifications error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Server error fetching sales query notifications",
        });
    }
};

// ============================================================
// MARK SALES QUERY NOTIFICATION AS READ
//
// PATCH /api/sales-queries/notifications/:notificationId/read
// ============================================================

export const markSalesQueryNotificationRead = async (
    req,
    res
) => {
    try {
        const { notificationId } =
            req.params;

        const result = await pool.query(
            `
            UPDATE sales_query_notifications

            SET read_at = COALESCE(
                read_at,
                NOW()
            )

            WHERE id = $1

            RETURNING *
            `,
            [notificationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Sales query notification not found",
            });
        }

        res.json({
            success: true,
            notification:
                result.rows[0],
        });
    } catch (err) {
        console.error(
            "markSalesQueryNotificationRead error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Server error marking notification as read",
        });
    }
};

// ============================================================
// UPDATE SALES QUERY
// PATCH /api/sales-queries/:id
// ============================================================

export const updateSalesQuery = async (
    req,
    res
) => {
    try {
        const { id } = req.params;

        const {
            customer,
            contact,
            email,
            requirement,
            meeting_date,
            primary_amount,
            secondary_amount,
            status,
            follow_up_date,
            source,
            assigned_to,

            // Optional:
            // frontend can send the employee currently
            // performing the assignment.
            assigned_by,
        } = req.body;

        // ========================================================
        // GET CURRENT QUERY
        // ========================================================

        const currentResult =
            await pool.query(
                `
                SELECT
                    id,
                    assigned_to,
                    created_by,
                    customer
                FROM sales_queries
                WHERE id = $1
                `,
                [id]
            );

        if (
            currentResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Sales query not found",
            });
        }

        const currentQuery =
            currentResult.rows[0];

        const oldAssignedTo =
            currentQuery.assigned_to;

        // ========================================================
        // VERIFY NEW ASSIGNEE
        // ========================================================

        if (
            assigned_to !== null &&
            assigned_to !== undefined &&
            assigned_to !== ""
        ) {
            const assigneeCheck =
                await pool.query(
                    `
                    SELECT id
                    FROM employees
                    WHERE id = $1
                    `,
                    [assigned_to]
                );

            if (
                assigneeCheck.rows.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Selected assigned employee does not exist",
                });
            }
        }

        // ========================================================
        // NORMALIZE ASSIGNEE
        // ========================================================

        const newAssignedTo =
            assigned_to === ""
                ? null
                : assigned_to ??
                  null;

        // ========================================================
        // DETERMINE WHO PERFORMED ASSIGNMENT
        //
        // If frontend sends assigned_by, use it.
        // Otherwise fall back to query creator.
        // ========================================================

        const assignmentActor =
            assigned_by ||
            currentQuery.created_by;

        // ========================================================
        // CHECK WHETHER ASSIGNMENT CHANGED
        // ========================================================

        const assignmentChanged =
            String(oldAssignedTo || "") !==
            String(newAssignedTo || "");

        // ========================================================
        // UPDATE QUERY
        // ========================================================

        const result = await pool.query(
            `
            UPDATE sales_queries
            SET
                customer = COALESCE($1, customer),
                contact = COALESCE($2, contact),
                email = $3,
                requirement = $4,
                meeting_date = $5,
                primary_amount = COALESCE($6, primary_amount),
                secondary_amount = COALESCE($7, secondary_amount),
                status = COALESCE($8, status),
                follow_up_date = $9,
                source = COALESCE($10, source),
                assigned_to = $11,
                updated_at = NOW()

            WHERE id = $12

            RETURNING *
            `,
            [
                customer?.trim() || null,
                contact?.trim() || null,
                email || null,
                requirement || null,
                meeting_date || null,
                primary_amount ?? null,
                secondary_amount ?? null,
                status || null,
                follow_up_date || null,
                source || null,
                newAssignedTo,
                id,
            ]
        );

        // ========================================================
        // NEW ASSIGNMENT NOTIFICATION
        //
        // IMPORTANT:
        //
        // 1. Assignment did not change
        //    -> no new notification
        //
        // 2. Unassigned
        //    -> no notification
        //
        // 3. Assigned to yourself
        //    -> no notification
        //
        // 4. Assigned to another employee
        //    -> CREATE notification
        // ========================================================

        if (
            assignmentChanged &&
            newAssignedTo &&
            String(newAssignedTo) !==
                String(assignmentActor)
        ) {
            await pool.query(
                `
                INSERT INTO sales_query_notifications (
                    sales_query_id,
                    recipient_employee_id,
                    assigned_by,
                    notification_type,
                    title,
                    message
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'sales_query_assignment',
                    $4,
                    $5
                )
                `,
                [
                    id,
                    newAssignedTo,
                    assignmentActor,
                    "New Sales Query assigned to you",
                    `Customer: ${
                        result.rows[0].customer
                    }`,
                ]
            );
        }

        res.json({
            success: true,

            message:
                "Sales query updated successfully",

            query:
                result.rows[0],

            assignmentChanged,

            previousAssignedTo:
                oldAssignedTo || null,

            newAssignedTo:
                newAssignedTo || null,
        });
    } catch (err) {
        console.error(
            "updateSalesQuery error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Server error updating sales query",
        });
    }
};

// ============================================================
// DELETE SALES QUERY
// DELETE /api/sales-queries/:id
// ============================================================

export const deleteSalesQuery = async (
    req,
    res
) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM sales_queries
            WHERE id = $1
            RETURNING id
            `,
            [id]
        );

        if (
            result.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Sales query not found",
            });
        }

        // IMPORTANT:
        // We intentionally DO NOT delete the notification.
        //
        // This preserves notification history.

        res.json({
            success: true,
            message:
                "Sales query deleted successfully",
        });
    } catch (err) {
        console.error(
            "deleteSalesQuery error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Server error deleting sales query",
        });
    }
};