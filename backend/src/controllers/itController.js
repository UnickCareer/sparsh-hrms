// server/controllers/itController.js

import pool from "../config/db.js";


// ============================================================
// HELPERS
// ============================================================

function getEmployeeId(user) {

    if (!user) return null;

    return (
        user.employee_id ??
        user.employeeId ??
        user.emp_id ??
        user.id ??
        null
    );
}


function getEmployeeName(user) {

    if (!user) return "Employee";

    return (
        user.full_name ||
        user.fullName ||
        user.name ||
        user.employee_name ||
        "Employee"
    );
}


// ============================================================
// TICKET NUMBER
// ============================================================

async function generateTicketNumber() {

    const result =
        await pool.query(`
            SELECT ticket_number
            FROM it_tickets
            ORDER BY id DESC
            LIMIT 1
        `);

    if (result.rows.length === 0) {
        return "TKT-1001";
    }

    const lastNumber =
        parseInt(
            result.rows[0]
                .ticket_number
                .replace("TKT-", ""),
            10
        );

    return `TKT-${lastNumber + 1}`;
}


// ============================================================
// NOTIFICATION
// ============================================================

async function createNotification({
    recipientEmployeeId,
    title,
    message,
    type = "it_ticket",
    referenceId = null,
}) {

    if (!recipientEmployeeId) {

        console.warn(
            "IT notification skipped: employee ID missing"
        );

        return;
    }

    await pool.query(
        `
        INSERT INTO notifications (
            recipient_employee_id,
            title,
            message,
            type,
            reference_id,
            reference_type,
            is_read
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'it_ticket',
            FALSE
        )
        `,
        [
            recipientEmployeeId,
            title,
            message,
            type,
            referenceId,
        ]
    );
}


// ============================================================
// GET TICKETS
// ============================================================

export async function getTickets(req, res) {

    try {

        const employeeId =
            req.query.employeeId;

        const isAdmin =
            String(
                req.query.isAdmin
            ) === "true";


        let result;


        // ADMIN / HR / OWNER
        // See everything.

        if (isAdmin) {

            result =
                await pool.query(`
                    SELECT
                        t.id,
                        t.ticket_number,
                        t.requester_name,
                        t.requester_employee_id,
                        t.assignee_name,
                        t.assignee_employee_id,
                        t.subject,
                        t.category,
                        t.priority,
                        t.status,
                        t.description,
                        t.attachment_name,
                        t.created_at,
                        t.updated_at,

                        COUNT(u.id)::INTEGER AS updates

                    FROM it_tickets t

                    LEFT JOIN it_ticket_updates u
                        ON u.ticket_id = t.id

                    GROUP BY t.id

                    ORDER BY t.created_at DESC
                `);

        } else {

            if (!employeeId) {

                return res.json({
                    success: true,
                    tickets: [],
                });
            }


            result =
                await pool.query(
                    `
                    SELECT
                        t.id,
                        t.ticket_number,
                        t.requester_name,
                        t.requester_employee_id,
                        t.assignee_name,
                        t.assignee_employee_id,
                        t.subject,
                        t.category,
                        t.priority,
                        t.status,
                        t.description,
                        t.attachment_name,
                        t.created_at,
                        t.updated_at,

                        COUNT(u.id)::INTEGER AS updates

                    FROM it_tickets t

                    LEFT JOIN it_ticket_updates u
                        ON u.ticket_id = t.id

                    WHERE
                        t.requester_employee_id = $1
                        OR t.assignee_employee_id = $1

                    GROUP BY t.id

                    ORDER BY t.created_at DESC
                    `,
                    [employeeId]
                );
        }


        res.json({
            success: true,
            tickets: result.rows,
        });

    } catch (error) {

        console.error(
            "Get IT tickets error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to fetch IT tickets",
        });
    }
}


// ============================================================
// GET SINGLE TICKET
// ============================================================

export async function getTicketById(req, res) {

    try {

        const { id } =
            req.params;


        const ticketResult =
            await pool.query(
                `
                SELECT
                    t.id,
                    t.ticket_number,
                    t.requester_name,
                    t.requester_employee_id,
                    t.assignee_name,
                    t.assignee_employee_id,
                    t.subject,
                    t.category,
                    t.priority,
                    t.status,
                    t.description,
                    t.attachment_name,
                    t.created_at,
                    t.updated_at,

                    COUNT(u.id)::INTEGER AS updates

                FROM it_tickets t

                LEFT JOIN it_ticket_updates u
                    ON u.ticket_id = t.id

                WHERE t.id = $1

                GROUP BY t.id
                `,
                [id]
            );


        if (
            ticketResult.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Ticket not found",
            });
        }


        const updatesResult =
            await pool.query(
                `
                SELECT
                    id,
                    author_name,
                    comment,
                    created_at

                FROM it_ticket_updates

                WHERE ticket_id = $1

                ORDER BY created_at ASC
                `,
                [id]
            );


        res.json({

            success: true,

            ticket: {
                ...ticketResult.rows[0],

                updateHistory:
                    updatesResult.rows,
            },

        });

    } catch (error) {

        console.error(
            "Get IT ticket error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to fetch ticket",
        });
    }
}


// ============================================================
// CREATE TICKET
// ============================================================

export async function createTicket(req, res) {

    try {

        const {
            subject,
            category,
            priority,
            description,
            attachmentName,

            requesterName,
            requesterEmployeeId,

            assigneeEmployeeId,
            assigneeName,
        } = req.body;


        if (
            !requesterEmployeeId ||
            !requesterName
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Logged-in employee information is missing",
            });
        }


        if (
            !subject ||
            !subject.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Subject is required",
            });
        }


        const ticketNumber =
            await generateTicketNumber();


        const result =
            await pool.query(
                `
                INSERT INTO it_tickets (
                    ticket_number,

                    requester_name,
                    requester_employee_id,

                    assignee_name,
                    assignee_employee_id,

                    subject,
                    category,
                    priority,
                    status,
                    description,
                    attachment_name
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    'Open',
                    $9,
                    $10
                )

                RETURNING *
                `,
                [
                    ticketNumber,

                    requesterName.trim(),
                    requesterEmployeeId,

                    assigneeName ||
                        "Unassigned",

                    assigneeEmployeeId ||
                        null,

                    subject.trim(),

                    category ||
                        "Other",

                    priority ||
                        "Medium",

                    description?.trim() ||
                        "",

                    attachmentName ||
                        null,
                ]
            );


        const ticket =
            result.rows[0];


        // ====================================================
        // NOTIFY ASSIGNEE IMMEDIATELY
        // ====================================================

        if (
            assigneeEmployeeId &&
            Number(assigneeEmployeeId) !==
                Number(requesterEmployeeId)
        ) {

            await createNotification({

                recipientEmployeeId:
                    assigneeEmployeeId,

                title:
                    "New IT Ticket Assigned",

                message:
                    `${requesterName} assigned IT ticket ${ticketNumber} to you.`,

                type:
                    "it_ticket_assigned",

                referenceId:
                    ticket.id,
            });
        }


        res.status(201).json({

            success: true,

            message:
                "IT ticket created successfully",

            ticket,

        });

    } catch (error) {

        console.error(
            "Create IT ticket error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to create IT ticket",

        });
    }
}


// ============================================================
// UPDATE TICKET
// ============================================================

export async function updateTicket(req, res) {

    try {

        const { id } =
            req.params;

        const {
            status,
            priority,
            assigneeName,
            assigneeEmployeeId,
            currentUser,
        } = req.body;


        const oldResult =
            await pool.query(
                `
                SELECT *
                FROM it_tickets
                WHERE id = $1
                `,
                [id]
            );


        if (
            oldResult.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Ticket not found",
            });
        }


        const oldTicket =
            oldResult.rows[0];


        const result =
            await pool.query(
                `
                UPDATE it_tickets

                SET
                    status =
                        COALESCE($1, status),

                    priority =
                        COALESCE($2, priority),

                    assignee_name =
                        COALESCE($3, assignee_name),

                    assignee_employee_id =
                        $4,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $5

                RETURNING *
                `,
                [
                    status || null,

                    priority || null,

                    assigneeName ??
                        oldTicket.assignee_name,

                    assigneeEmployeeId ??
                        null,

                    id,
                ]
            );


        const ticket =
            result.rows[0];


        const actor =
            getEmployeeName(
                currentUser
            );


        // ====================================================
        // REASSIGNED
        // ====================================================

        if (
            assigneeEmployeeId &&
            Number(assigneeEmployeeId) !==
                Number(
                    oldTicket.assignee_employee_id
                )
        ) {

            await createNotification({

                recipientEmployeeId:
                    assigneeEmployeeId,

                title:
                    "IT Ticket Assigned",

                message:
                    `${actor} assigned IT ticket ${ticket.ticket_number} to you.`,

                type:
                    "it_ticket_assigned",

                referenceId:
                    ticket.id,
            });
        }


        // ====================================================
        // STATUS CHANGED
        // NOTIFY REQUESTER
        // ====================================================

        if (
            status &&
            status !== oldTicket.status
        ) {

            let title =
                "IT Ticket Updated";


            if (
                status === "Resolved"
            ) {
                title =
                    "IT Ticket Resolved";
            }


            if (
                status === "Closed"
            ) {
                title =
                    "IT Ticket Closed";
            }


            if (
                status === "Reopened"
            ) {
                title =
                    "IT Ticket Reopened";
            }


            if (
                ticket.requester_employee_id &&
                Number(
                    ticket.requester_employee_id
                ) !==
                    Number(
                        currentUser?.employee_id ??
                        currentUser?.employeeId ??
                        currentUser?.id
                    )
            ) {

                await createNotification({

                    recipientEmployeeId:
                        ticket.requester_employee_id,

                    title,

                    message:
                        `${actor} changed IT ticket ${ticket.ticket_number} status to ${status}.`,

                    type:
                        `it_ticket_${status
                            .toLowerCase()
                            .replace(
                                " ",
                                "_"
                            )}`,

                    referenceId:
                        ticket.id,
                });
            }
        }


        res.json({

            success: true,

            message:
                "Ticket updated successfully",

            ticket,

        });

    } catch (error) {

        console.error(
            "Update IT ticket error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to update ticket",

        });
    }
}


// ============================================================
// ADD UPDATE
// ============================================================

export async function addTicketUpdate(
    req,
    res
) {

    try {

        const { id } =
            req.params;

        const {
            comment,
            currentUser,
            authorName,
        } = req.body;


        if (
            !comment ||
            !comment.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Comment is required",
            });
        }


        const ticketCheck =
            await pool.query(
                `
                SELECT *
                FROM it_tickets
                WHERE id = $1
                `,
                [id]
            );


        if (
            ticketCheck.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Ticket not found",
            });
        }


        const ticket =
            ticketCheck.rows[0];


        const finalAuthorName =
            authorName ||
            getEmployeeName(
                currentUser
            );


        const authorEmployeeId =
            getEmployeeId(
                currentUser
            );


        const result =
            await pool.query(
                `
                INSERT INTO it_ticket_updates (
                    ticket_id,
                    author_name,
                    comment
                )

                VALUES (
                    $1,
                    $2,
                    $3
                )

                RETURNING *
                `,
                [
                    id,
                    finalAuthorName,
                    comment.trim(),
                ]
            );


        await pool.query(
            `
            UPDATE it_tickets

            SET updated_at =
                CURRENT_TIMESTAMP

            WHERE id = $1
            `,
            [id]
        );


        // ====================================================
        // REQUESTER WRITES
        // → NOTIFY ASSIGNEE
        // ====================================================

        if (
            ticket.assignee_employee_id &&
            Number(
                ticket.assignee_employee_id
            ) !==
                Number(authorEmployeeId)
        ) {

            await createNotification({

                recipientEmployeeId:
                    ticket.assignee_employee_id,

                title:
                    "IT Ticket Updated",

                message:
                    `${finalAuthorName} added an update to IT ticket ${ticket.ticket_number}.`,

                type:
                    "it_ticket_update",

                referenceId:
                    ticket.id,
            });
        }


        // ====================================================
        // ASSIGNEE WRITES
        // → NOTIFY REQUESTER
        // ====================================================

        if (
            ticket.requester_employee_id &&
            Number(
                ticket.requester_employee_id
            ) !==
                Number(authorEmployeeId)
        ) {

            await createNotification({

                recipientEmployeeId:
                    ticket.requester_employee_id,

                title:
                    "IT Ticket Updated",

                message:
                    `${finalAuthorName} added an update to IT ticket ${ticket.ticket_number}.`,

                type:
                    "it_ticket_update",

                referenceId:
                    ticket.id,
            });
        }


        res.status(201).json({

            success: true,

            message:
                "Ticket update added successfully",

            update:
                result.rows[0],

        });

    } catch (error) {

        console.error(
            "Add IT ticket update error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to add ticket update",

        });
    }
}


// ============================================================
// DELETE
// ============================================================

export async function deleteTicket(
    req,
    res
) {

    try {

        const { id } =
            req.params;


        const result =
            await pool.query(
                `
                DELETE FROM it_tickets

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
                    "Ticket not found",
            });
        }


        res.json({

            success: true,

            message:
                "Ticket deleted successfully",

        });

    } catch (error) {

        console.error(
            "Delete IT ticket error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to delete ticket",

        });
    }
}


// ============================================================
// GET IT NOTIFICATIONS
// ============================================================

export async function getITNotifications(
    req,
    res
) {

    try {

        const {
            employeeId,
        } = req.query;


        if (!employeeId) {

            return res.json({
                success: true,
                notifications: [],
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    recipient_employee_id,
                    title,
                    message,
                    type,
                    reference_id,
                    reference_type,
                    is_read,
                    created_at

                FROM notifications

                WHERE
                    recipient_employee_id = $1

                    AND (
                        type LIKE 'it_ticket%'
                        OR reference_type = 'it_ticket'
                    )

                ORDER BY created_at DESC

                LIMIT 30
                `,
                [employeeId]
            );


        res.json({

            success: true,

            notifications:
                result.rows,

        });

    } catch (error) {

        console.error(
            "Get IT notifications error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to fetch IT notifications",

        });
    }
}


// ============================================================
// MARK IT NOTIFICATION READ
// ============================================================

export async function markITNotificationRead(
    req,
    res
) {

    try {

        const { id } =
            req.params;


        await pool.query(
            `
            UPDATE notifications

            SET is_read = TRUE

            WHERE id = $1

              AND (
                  type LIKE 'it_ticket%'
                  OR reference_type = 'it_ticket'
              )
            `,
            [id]
        );


        res.json({
            success: true,
        });

    } catch (error) {

        console.error(
            "Mark IT notification read error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to mark notification as read",

        });
    }
}