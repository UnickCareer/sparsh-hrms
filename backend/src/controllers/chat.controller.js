import pool from "../config/db.js";
import fs from "node:fs";
import { publishToConversation } from "../realtime/chat.realtime.js";

// ============================================================
// CHAT CONTROLLER
//
// PHASE 2A — CONVERSATIONS & GROUPS
// PHASE 2B — MESSAGES
// PHASE 2C — REPLY & FORWARD
// PHASE 2D — REACTIONS
// PHASE 2E — MESSAGE ACTIONS
// PHASE 2F — DELIVERY / READ RECEIPTS
// PHASE 2G — CHAT ATTACHMENTS
// ============================================================


// ============================================================
// SHARED HELPERS
// ============================================================

async function verifyConversationParticipant(
    employeeId,
    conversationId,
    client = pool
) {
    const result = await client.query(
        `
        SELECT
            p.id,
            p.employee_id,
            p.participant_role,
            p.participant_status,
            p.last_read_at,
            p.is_muted,
            p.cleared_at,
            p.deleted_chat_at
        FROM chat_participants p
        WHERE
            p.conversation_id = $1
            AND p.employee_id = $2
            AND p.participant_status = 'active'
        LIMIT 1
        `,
        [
            conversationId,
            employeeId,
        ]
    );

    return result.rows[0] || null;
}


// ============================================================
// REALTIME HELPER
// ============================================================

async function publishChatEvent(
    conversationId,
    event,
    options = {}
) {
    try {
        await publishToConversation(
            conversationId,
            {
                ...event,
                conversationId: Number(conversationId),
            },
            options
        );
    } catch (error) {
        console.error(
            "Chat realtime publish error:",
            error
        );
    }
}


// ============================================================
// SHARED MESSAGE SELECT
// ============================================================

async function getMessageById(
    messageId,
    client = pool,
    viewerEmployeeId = null
) {
    const result = await client.query(
        `
        SELECT
            m.id,
            m.conversation_id,
            m.sender_employee_id,
            m.message,
            m.message_type,
            m.reply_to_message_id,
            m.forwarded_from_message_id,
            m.edited_at,
            m.deleted_at,
            m.deleted_by,
            m.created_at,
            m.updated_at,

            c.conversation_type,

            sender.full_name AS sender_name,
            sender.employee_code AS sender_employee_code,
            sender.avatar AS sender_avatar,

            reply.message AS reply_message,
            reply.sender_employee_id AS reply_sender_employee_id,
            replySender.full_name AS reply_sender_name,

            CASE
                WHEN $2::integer IS NULL THEN false
                ELSE EXISTS (
                    SELECT 1
                    FROM chat_starred_messages sm
                    WHERE
                        sm.message_id = m.id
                        AND sm.employee_id = $2
                )
            END AS is_starred,

            EXISTS (
                SELECT 1
                FROM chat_pinned_messages pm
                WHERE
                    pm.message_id = m.id
            ) AS is_pinned

        FROM chat_messages m

        INNER JOIN chat_conversations c
            ON c.id = m.conversation_id

        INNER JOIN employees sender
            ON sender.id = m.sender_employee_id

        LEFT JOIN chat_messages reply
            ON reply.id = m.reply_to_message_id

        LEFT JOIN employees replySender
            ON replySender.id = reply.sender_employee_id

        WHERE
            m.id = $1

        LIMIT 1
        `,
        [
            messageId,
            viewerEmployeeId
                ? Number(viewerEmployeeId)
                : null,
        ]
    );

    const message = result.rows[0];

    if (!message) {
        return null;
    }

    const attachmentsResult = await client.query(
        `
        SELECT
            id,
            message_id,
            file_name,
            file_url,
            file_type,
            file_size,
            created_at
        FROM chat_message_attachments
        WHERE message_id = $1
        ORDER BY id ASC
        `,
        [messageId]
    );

    message.attachments =
        attachmentsResult.rows;

    const reactionsResult = await client.query(
    `
    SELECT
        r.id,
        r.message_id,
        r.employee_id,
        r.reaction AS emoji,
        r.created_at,
        e.full_name,
        e.employee_code,
        e.avatar
    FROM chat_message_reactions r
    INNER JOIN employees e
        ON e.id = r.employee_id
    WHERE r.message_id = $1
    ORDER BY r.created_at ASC, r.id ASC
    `,
        [messageId]
    );

    message.reactions =
        reactionsResult.rows;

    return message;
}


// ============================================================
// PHASE 2A — CONVERSATIONS & GROUPS
// ============================================================


// ============================================================
// GET MY CONVERSATIONS
// ============================================================

export async function getMyConversations(req, res) {
    try {
        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid employee ID is required",
            });
        }

        const result = await pool.query(
            `
            SELECT
                c.id,
                c.conversation_type,
                c.title,
                c.description,
                c.avatar,
                c.created_by,
                c.last_message_id,
                c.last_message_at,
                c.created_at,
                c.updated_at,

                p.participant_role,
                p.last_read_at,
                p.is_muted,
                p.cleared_at,
                p.deleted_chat_at,

                creator.full_name AS created_by_name,

                last_message.message AS last_message,
                last_message.message_type AS last_message_type,
                last_message.sender_employee_id AS last_message_sender_id,
                last_sender.full_name AS last_message_sender_name,

                (
                    SELECT COUNT(*)
                    FROM chat_participants cp
                    WHERE
                        cp.conversation_id = c.id
                        AND cp.participant_status = 'active'
                ) AS participant_count

            FROM chat_conversations c

            INNER JOIN chat_participants p
                ON p.conversation_id = c.id

            LEFT JOIN employees creator
                ON creator.id = c.created_by

            LEFT JOIN chat_messages last_message
                ON last_message.id = c.last_message_id

            LEFT JOIN employees last_sender
                ON last_sender.id =
                    last_message.sender_employee_id

            WHERE
                p.employee_id = $1
                AND p.participant_status = 'active'

                AND (
                    p.deleted_chat_at IS NULL
                    OR c.last_message_at IS NULL
                    OR c.last_message_at > p.deleted_chat_at
                )

            ORDER BY
                COALESCE(
                    c.last_message_at,
                    c.updated_at
                ) DESC,
                c.id DESC
            `,
            [employeeId]
        );

        return res.json({
            success: true,
            conversations: result.rows,
        });
    } catch (error) {
        console.error(
            "Get chat conversations error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch conversations",
        });
    }
}


// ============================================================
// GET SINGLE CONVERSATION
// ============================================================

export async function getConversationById(req, res) {
    try {
        const { id } = req.params;
        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid employee ID is required",
            });
        }

        const conversationResult =
            await pool.query(
                `
                SELECT
                    c.id,
                    c.conversation_type,
                    c.title,
                    c.description,
                    c.avatar,
                    c.created_by,
                    c.last_message_id,
                    c.last_message_at,
                    c.created_at,
                    c.updated_at,

                    creator.full_name AS created_by_name,

                    current_participant.participant_role,
                    current_participant.last_read_at,
                    current_participant.is_muted,
                    current_participant.cleared_at,
                    current_participant.deleted_chat_at

                FROM chat_conversations c

                INNER JOIN chat_participants current_participant
                    ON current_participant.conversation_id = c.id

                LEFT JOIN employees creator
                    ON creator.id = c.created_by

                WHERE
                    c.id = $1
                    AND current_participant.employee_id = $2
                    AND current_participant.participant_status = 'active'
                `,
                [
                    id,
                    employeeId,
                ]
            );

        if (
            conversationResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }

        const participantsResult =
            await pool.query(
                `
                SELECT
                    p.id,
                    p.employee_id,
                    p.participant_role,
                    p.participant_status,
                    p.last_read_at,
                    p.is_muted,
                    p.joined_at,

                    e.full_name,
                    e.employee_code,
                    e.email,
                    e.department,
                    e.designation,
                    e.avatar

                FROM chat_participants p

                INNER JOIN employees e
                    ON e.id = p.employee_id

                WHERE
                    p.conversation_id = $1
                    AND p.participant_status = 'active'

                ORDER BY
                    CASE p.participant_role
                        WHEN 'owner' THEN 1
                        WHEN 'admin' THEN 2
                        ELSE 3
                    END,
                    e.full_name
                `,
                [id]
            );

        return res.json({
            success: true,
            conversation:
                conversationResult.rows[0],
            participants:
                participantsResult.rows,
        });
    } catch (error) {
        console.error(
            "Get chat conversation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch conversation",
        });
    }
}


// ============================================================
// CREATE DIRECT CHAT
// ============================================================

export async function createDirectChat(req, res) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const {
            employeeId,
            otherEmployeeId,
        } = req.body;

        const firstEmployeeId =
            Number(employeeId);

        const secondEmployeeId =
            Number(otherEmployeeId);

        if (
            !Number.isInteger(firstEmployeeId) ||
            firstEmployeeId <= 0 ||
            !Number.isInteger(secondEmployeeId) ||
            secondEmployeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Both employee IDs are required",
            });
        }

        if (
            firstEmployeeId ===
            secondEmployeeId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "You cannot create a direct chat with yourself",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        const existingResult =
            await client.query(
                `
                SELECT c.id

                FROM chat_conversations c

                INNER JOIN chat_participants p1
                    ON p1.conversation_id = c.id

                INNER JOIN chat_participants p2
                    ON p2.conversation_id = c.id

                WHERE
                    c.conversation_type = 'direct'

                    AND p1.employee_id = $1
                    AND p1.participant_status = 'active'

                    AND p2.employee_id = $2
                    AND p2.participant_status = 'active'

                LIMIT 1
                `,
                [
                    firstEmployeeId,
                    secondEmployeeId,
                ]
            );

        if (existingResult.rows.length > 0) {
            await client.query("COMMIT");
            transactionStarted = false;

            const existingConversationId =
                existingResult.rows[0].id;

            // Restore the chat from the current employee's
            // deleted-chat state if necessary.
            await client.query(
                `
                UPDATE chat_participants
                SET
                    deleted_chat_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE
                    conversation_id = $1
                    AND employee_id = $2
                    AND participant_status = 'active'
                `,
                [
                    existingConversationId,
                    firstEmployeeId,
                ]
            );

            return res.json({
                success: true,
                existing: true,
                conversationId:
                    existingConversationId,
                message:
                    "Direct conversation already exists",
            });
        }

        const employeesResult =
            await client.query(
                `
                SELECT id
                FROM employees
                WHERE id = ANY($1::integer[])
                `,
                [
                    [
                        firstEmployeeId,
                        secondEmployeeId,
                    ],
                ]
            );

        if (
            employeesResult.rows.length !== 2
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message:
                    "One or both employees do not exist",
            });
        }

        const conversationResult =
            await client.query(
                `
                INSERT INTO chat_conversations (
                    conversation_type,
                    created_by
                )
                VALUES (
                    'direct',
                    $1
                )
                RETURNING *
                `,
                [firstEmployeeId]
            );

        const conversation =
            conversationResult.rows[0];

        await client.query(
            `
            INSERT INTO chat_participants (
                conversation_id,
                employee_id,
                participant_role,
                participant_status
            )
            VALUES (
                $1,
                $2,
                'member',
                'active'
            )
            `,
            [
                conversation.id,
                firstEmployeeId,
            ]
        );

        await client.query(
            `
            INSERT INTO chat_participants (
                conversation_id,
                employee_id,
                participant_role,
                participant_status
            )
            VALUES (
                $1,
                $2,
                'member',
                'active'
            )
            `,
            [
                conversation.id,
                secondEmployeeId,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            existing: false,
            conversation,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Create direct chat error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to create direct conversation",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// CREATE GROUP
// ============================================================

export async function createGroup(req, res) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const {
            employeeId,
            title,
            description,
            avatar,
            participantIds,
        } = req.body;

        const creatorId =
            Number(employeeId);

        if (
            !Number.isInteger(creatorId) ||
            creatorId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Creator employee ID is required",
            });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message:
                    "Group name is required",
            });
        }

        if (!Array.isArray(participantIds)) {
            return res.status(400).json({
                success: false,
                message:
                    "participantIds must be an array",
            });
        }

        const uniqueParticipantIds = [
            ...new Set(
                [
                    creatorId,
                    ...participantIds
                        .map(Number)
                        .filter(
                            (id) =>
                                Number.isInteger(id) &&
                                id > 0
                        ),
                ]
            ),
        ];

        await client.query("BEGIN");
        transactionStarted = true;

        const employeesResult =
            await client.query(
                `
                SELECT id
                FROM employees
                WHERE id = ANY($1::integer[])
                `,
                [uniqueParticipantIds]
            );

        if (
            employeesResult.rows.length !==
            uniqueParticipantIds.length
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message:
                    "One or more selected employees do not exist",
            });
        }

        const conversationResult =
            await client.query(
                `
                INSERT INTO chat_conversations (
                    conversation_type,
                    title,
                    description,
                    avatar,
                    created_by
                )
                VALUES (
                    'group',
                    $1,
                    $2,
                    $3,
                    $4
                )
                RETURNING *
                `,
                [
                    title.trim(),
                    description?.trim() || null,
                    avatar || null,
                    creatorId,
                ]
            );

        const conversation =
            conversationResult.rows[0];

        for (
            const participantId
            of uniqueParticipantIds
        ) {
            const role =
                Number(participantId) ===
                    creatorId
                    ? "owner"
                    : "member";

            await client.query(
                `
                INSERT INTO chat_participants (
                    conversation_id,
                    employee_id,
                    participant_role,
                    participant_status
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'active'
                )
                `,
                [
                    conversation.id,
                    participantId,
                    role,
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message:
                "Group created successfully",
            conversation,
            participantIds:
                uniqueParticipantIds,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Create chat group error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to create group",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// PHASE 2B — MESSAGES
// ============================================================


// ============================================================
// GET MESSAGES
// ============================================================

export async function getMessages(req, res) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        const result = await pool.query(
            `
            SELECT
                m.id,
                m.conversation_id,
                m.sender_employee_id,
                m.message,
                m.message_type,
                m.reply_to_message_id,
                m.forwarded_from_message_id,
                m.edited_at,
                m.deleted_at,
                m.deleted_by,
                m.created_at,
                m.updated_at,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'message_id', a.message_id,
                                'file_name', a.file_name,
                                'file_url', a.file_url,
                                'file_type', a.file_type,
                                'file_size', a.file_size,
                                'created_at', a.created_at
                            )
                            ORDER BY a.id ASC
                        )
                        FROM chat_message_attachments a
                        WHERE a.message_id = m.id
                    ),
                    '[]'::json
                ) AS attachments,

                c.conversation_type,

                sender.full_name AS sender_name,
                sender.employee_code AS sender_employee_code,
                sender.avatar AS sender_avatar,

                reply.message AS reply_message,
                reply.sender_employee_id AS reply_sender_employee_id,
                replySender.full_name AS reply_sender_name,

                EXISTS (
                    SELECT 1
                    FROM chat_starred_messages sm
                    WHERE
                        sm.message_id = m.id
                        AND sm.employee_id = $2
                ) AS is_starred,

                EXISTS (
                    SELECT 1
                    FROM chat_pinned_messages pm
                    WHERE
                        pm.message_id = m.id
                ) AS is_pinned,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', r.id,
                                'message_id', r.message_id,
                                'employee_id', r.employee_id,
                                'emoji', r.reaction,
                                'created_at', r.created_at,
                                'full_name', re.full_name,
                                'employee_code', re.employee_code,
                                'avatar', re.avatar
                            )
                            ORDER BY r.created_at ASC, r.id ASC
                        )
                        FROM chat_message_reactions r
                        INNER JOIN employees re
                            ON re.id = r.employee_id
                        WHERE r.message_id = m.id
                    ),
                    '[]'::json
                ) AS reactions,

                CASE
                    WHEN m.sender_employee_id <> $2
                        THEN NULL

                    WHEN (
                        SELECT COUNT(*)
                        FROM chat_participants rp
                        WHERE
                            rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status = 'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                    ) = 0
                        THEN 'sent'

                    WHEN (
                        SELECT COUNT(*)
                        FROM chat_participants rp
                        WHERE
                            rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status = 'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                    ) = (
                        SELECT COUNT(*)
                        FROM chat_message_receipts rr
                        JOIN chat_participants rp
                            ON rp.employee_id =
                                rr.employee_id
                        WHERE
                            rr.message_id = m.id
                            AND rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status =
                                'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                            AND rr.delivered_at IS NOT NULL
                    )
                    AND (
                        SELECT COUNT(*)
                        FROM chat_participants rp
                        WHERE
                            rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status =
                                'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                    ) = (
                        SELECT COUNT(*)
                        FROM chat_message_receipts rr
                        JOIN chat_participants rp
                            ON rp.employee_id =
                                rr.employee_id
                        WHERE
                            rr.message_id = m.id
                            AND rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status =
                                'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                            AND rr.read_at IS NOT NULL
                    )
                        THEN 'read'

                    WHEN (
                        SELECT COUNT(*)
                        FROM chat_participants rp
                        WHERE
                            rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status =
                                'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                    ) = (
                        SELECT COUNT(*)
                        FROM chat_message_receipts rr
                        JOIN chat_participants rp
                            ON rp.employee_id =
                                rr.employee_id
                        WHERE
                            rr.message_id = m.id
                            AND rp.conversation_id =
                                m.conversation_id
                            AND rp.participant_status =
                                'active'
                            AND rp.employee_id <>
                                m.sender_employee_id
                            AND rr.delivered_at IS NOT NULL
                    )
                        THEN 'delivered'

                    ELSE 'sent'
                END AS delivery_status

            FROM chat_messages m

            INNER JOIN chat_conversations c
                ON c.id = m.conversation_id

            INNER JOIN employees sender
                ON sender.id = m.sender_employee_id

            LEFT JOIN chat_messages reply
                ON reply.id = m.reply_to_message_id

            LEFT JOIN employees replySender
                ON replySender.id =
                    reply.sender_employee_id

            WHERE
                m.conversation_id = $1

                AND m.created_at >
                    COALESCE(
                        (
                            SELECT cp.cleared_at
                            FROM chat_participants cp
                            WHERE
                                cp.conversation_id = $1
                                AND cp.employee_id = $2
                                AND cp.participant_status = 'active'
                            LIMIT 1
                        ),
                        TO_TIMESTAMP(0)
                    )

            ORDER BY
                m.created_at ASC,
                m.id ASC
            `,
            [
                id,
                employeeId,
            ]
        );

        return res.json({
            success: true,
            messages: result.rows,
        });
    } catch (error) {
        console.error(
            "Get chat messages error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch chat messages",
        });
    }
}


// ============================================================
// MARK CONVERSATION READ
// ============================================================

export async function markConversationRead(
    req,
    res
) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { id } = req.params;

        const employeeId =
            Number(
                req.body.employeeId ||
                req.query.employeeId
            );

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                id,
                client
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        await client.query(
            `
            INSERT INTO chat_message_receipts (
                message_id,
                employee_id,
                delivered_at,
                read_at
            )

            SELECT
                m.id,
                $2,
                COALESCE(
                    r.delivered_at,
                    NOW()
                ),
                NOW()

            FROM chat_messages m

            LEFT JOIN chat_message_receipts r
                ON r.message_id = m.id
                AND r.employee_id = $2

            WHERE
                m.conversation_id = $1
                AND m.sender_employee_id <> $2
                AND m.deleted_at IS NULL

            ON CONFLICT (
                message_id,
                employee_id
            )
            DO UPDATE SET
                delivered_at =
                    COALESCE(
                        chat_message_receipts.delivered_at,
                        EXCLUDED.delivered_at
                    ),
                read_at =
                    EXCLUDED.read_at
            `,
            [
                id,
                employeeId,
            ]
        );

        await client.query(
            `
            UPDATE chat_participants
            SET
                last_read_at = NOW(),
                updated_at = NOW()
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [
                id,
                employeeId,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        await publishChatEvent(
            id,
            {
                type: "conversation.read",
                employeeId,
                readAt: new Date().toISOString(),
            },
            {
                excludeEmployeeIds: [
                    employeeId,
                ],
            }
        );

        return res.json({
            success: true,
            readAt:
                new Date().toISOString(),
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Mark conversation read error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to mark conversation as read",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// SEND MESSAGE
// ============================================================

export async function sendMessage(req, res) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { id } = req.params;

        const {
            employeeId,
            message,
            messageType = "text",
            replyToMessageId = null,
        } = req.body;

        const senderId =
            Number(employeeId);

        if (
            !Number.isInteger(senderId) ||
            senderId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Message cannot be empty",
            });
        }

        const allowedMessageTypes = [
            "text",
            "system",
            "image",
            "video",
            "file",
        ];

        if (
            !allowedMessageTypes.includes(
                messageType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid message type",
            });
        }

        const participant =
            await verifyConversationParticipant(
                senderId,
                id,
                client
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        if (replyToMessageId) {
            const replyCheck =
                await client.query(
                    `
                    SELECT id
                    FROM chat_messages
                    WHERE
                        id = $1
                        AND conversation_id = $2
                        AND deleted_at IS NULL
                    LIMIT 1
                    `,
                    [
                        replyToMessageId,
                        id,
                    ]
                );

            if (
                replyCheck.rows.length === 0
            ) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(400).json({
                    success: false,
                    message:
                        "Reply message does not belong to this conversation",
                });
            }
        }

        const result =
            await client.query(
                `
                INSERT INTO chat_messages (
                    conversation_id,
                    sender_employee_id,
                    message,
                    message_type,
                    reply_to_message_id
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                RETURNING *
                `,
                [
                    id,
                    senderId,
                    message.trim(),
                    messageType,
                    replyToMessageId,
                ]
            );

        const newMessage =
            result.rows[0];

        await client.query(
            `
            UPDATE chat_conversations
            SET
                last_message_id = $1,
                last_message_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [
                newMessage.id,
                id,
            ]
        );

        // Sending a new message should make a previously
        // deleted/cleared personal chat visible again.
        await client.query(
            `
            UPDATE chat_participants
            SET
                deleted_chat_at = NULL
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [
                id,
                senderId,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        const completeMessage =
            await getMessageById(
                newMessage.id,
                pool,
                senderId
            );

        await publishChatEvent(
            id,
            {
                type: "message.created",
                message:
                    completeMessage,
            }
        );

        return res.status(201).json({
            success: true,
            message:
                completeMessage,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Send chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to send message",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// EDIT MESSAGE
// ============================================================

export async function editMessage(req, res) {
    try {
        const { id } = req.params;

        const {
            employeeId,
            message,
        } = req.body;

        const editorId =
            Number(employeeId);

        if (
            !Number.isInteger(editorId) ||
            editorId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Message cannot be empty",
            });
        }

        const messageResult =
            await pool.query(
                `
                SELECT
                    id,
                    conversation_id,
                    sender_employee_id,
                    deleted_at,
                    created_at

                FROM chat_messages

                WHERE id = $1

                LIMIT 1
                `,
                [id]
            );

        if (
            messageResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const existingMessage =
            messageResult.rows[0];

        const participant =
            await verifyConversationParticipant(
                editorId,
                existingMessage.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        if (
            Number(
                existingMessage.sender_employee_id
            ) !== editorId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only edit your own messages",
            });
        }

        if (existingMessage.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Deleted messages cannot be edited",
            });
        }

        const ageResult =
            await pool.query(
                `
                SELECT
                    EXTRACT(
                        EPOCH FROM (
                            CURRENT_TIMESTAMP -
                            created_at
                        )
                    ) AS age_seconds
                FROM chat_messages
                WHERE id = $1
                `,
                [id]
            );

        const ageSeconds =
            Number(
                ageResult.rows[0]?.age_seconds || 0
            );

        if (ageSeconds > 5 * 60) {
            return res.status(403).json({
                success: false,
                code:
                    "EDIT_WINDOW_EXPIRED",
                message:
                    "Messages can only be edited within 5 minutes of sending",
            });
        }

        const result =
            await pool.query(
                `
                UPDATE chat_messages
                SET
                    message = $1,
                    edited_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id
                `,
                [
                    message.trim(),
                    id,
                ]
            );

        const updatedMessage =
            await getMessageById(
                result.rows[0].id,
                pool,
                editorId
            );

        await publishChatEvent(
            existingMessage.conversation_id,
            {
                type: "message.updated",
                message:
                    updatedMessage,
            }
        );

        return res.json({
            success: true,
            message:
                updatedMessage,
        });
    } catch (error) {
        console.error(
            "Edit chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to edit message",
        });
    }
}


// ============================================================
// DELETE MESSAGE
// ============================================================

export async function deleteMessage(req, res) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const messageResult =
            await pool.query(
                `
                SELECT
                    id,
                    conversation_id,
                    sender_employee_id,
                    deleted_at

                FROM chat_messages

                WHERE id = $1

                LIMIT 1
                `,
                [id]
            );

        if (
            messageResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const existingMessage =
            messageResult.rows[0];

        const participant =
            await verifyConversationParticipant(
                employeeId,
                existingMessage.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        if (
            Number(
                existingMessage.sender_employee_id
            ) !== employeeId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only delete your own messages",
            });
        }

        if (existingMessage.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Message is already deleted",
            });
        }

        const result =
            await pool.query(
                `
                UPDATE chat_messages
                SET
                    deleted_at =
                        CURRENT_TIMESTAMP,
                    deleted_by = $1,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    message =
                        'This message was deleted'
                WHERE id = $2
                RETURNING id
                `,
                [
                    employeeId,
                    id,
                ]
            );

        const deletedMessage =
            await getMessageById(
                result.rows[0].id,
                pool,
                employeeId
            );

        await publishChatEvent(
            existingMessage.conversation_id,
            {
                type: "message.deleted",
                message:
                    deletedMessage,
            }
        );

        return res.json({
            success: true,
            message:
                deletedMessage,
        });
    } catch (error) {
        console.error(
            "Delete chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete message",
        });
    }
}


// ============================================================
// PHASE 2C — REPLY
// ============================================================

export async function replyToMessage(req, res) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { messageId } = req.params;

        const {
            employeeId,
            message,
        } = req.body;

        const senderId =
            Number(employeeId);

        if (
            !Number.isInteger(senderId) ||
            senderId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Reply message cannot be empty",
            });
        }

        const originalResult =
            await client.query(
                `
                SELECT
                    id,
                    conversation_id,
                    sender_employee_id,
                    message,
                    message_type,
                    deleted_at

                FROM chat_messages

                WHERE id = $1

                LIMIT 1
                `,
                [messageId]
            );

        if (
            originalResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Original message not found",
            });
        }

        const originalMessage =
            originalResult.rows[0];

        if (originalMessage.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot reply to a deleted message",
            });
        }

        const participant =
            await verifyConversationParticipant(
                senderId,
                originalMessage.conversation_id,
                client
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        const result =
            await client.query(
                `
                INSERT INTO chat_messages (
                    conversation_id,
                    sender_employee_id,
                    message,
                    message_type,
                    reply_to_message_id
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'text',
                    $4
                )
                RETURNING id
                `,
                [
                    originalMessage.conversation_id,
                    senderId,
                    message.trim(),
                    originalMessage.id,
                ]
            );

        const replyMessageId =
            result.rows[0].id;

        await client.query(
            `
            UPDATE chat_conversations
            SET
                last_message_id = $1,
                last_message_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [
                replyMessageId,
                originalMessage.conversation_id,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        const completeReply =
            await getMessageById(
                replyMessageId,
                pool,
                senderId
            );

        await publishChatEvent(
            originalMessage.conversation_id,
            {
                type: "message.created",
                message:
                    completeReply,
            }
        );

        return res.status(201).json({
            success: true,
            message:
                completeReply,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Reply to chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to reply to message",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// PHASE 2C — FORWARD
// ============================================================

export async function forwardMessage(req, res) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { id } = req.params;

        const {
            employeeId,
            conversationIds,
        } = req.body;

        const senderId =
            Number(employeeId);

        if (
            !Number.isInteger(senderId) ||
            senderId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !Array.isArray(conversationIds) ||
            conversationIds.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "At least one destination conversation is required",
            });
        }

        const uniqueConversationIds = [
            ...new Set(
                conversationIds
                    .map(Number)
                    .filter(
                        (conversationId) =>
                            Number.isInteger(
                                conversationId
                            ) &&
                            conversationId > 0
                    )
            ),
        ];

        if (
            uniqueConversationIds.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "No valid destination conversations were provided",
            });
        }

        const originalResult =
            await client.query(
                `
                SELECT
                    id,
                    conversation_id,
                    sender_employee_id,
                    message,
                    message_type,
                    deleted_at

                FROM chat_messages

                WHERE id = $1

                LIMIT 1
                `,
                [id]
            );

        if (
            originalResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Original message not found",
            });
        }

        const originalMessage =
            originalResult.rows[0];

        if (originalMessage.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot forward a deleted message",
            });
        }

        const originalParticipant =
            await verifyConversationParticipant(
                senderId,
                originalMessage.conversation_id,
                client
            );

        if (!originalParticipant) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot forward this message",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        const forwardedMessages = [];

        for (
            const conversationId
            of uniqueConversationIds
        ) {
            const destinationParticipant =
                await verifyConversationParticipant(
                    senderId,
                    conversationId,
                    client
                );

            if (!destinationParticipant) {
                continue;
            }

            const insertResult =
                await client.query(
                    `
                    INSERT INTO chat_messages (
                        conversation_id,
                        sender_employee_id,
                        message,
                        message_type,
                        forwarded_from_message_id
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING id
                    `,
                    [
                        conversationId,
                        senderId,
                        originalMessage.message,
                        originalMessage.message_type,
                        originalMessage.id,
                    ]
                );

            const forwardedMessageId =
                insertResult.rows[0].id;

            await client.query(
                `
                UPDATE chat_conversations
                SET
                    last_message_id = $1,
                    last_message_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [
                    forwardedMessageId,
                    conversationId,
                ]
            );

            await client.query(
                `
                UPDATE chat_participants
                SET
                    deleted_chat_at = NULL
                WHERE
                    conversation_id = $1
                    AND employee_id = $2
                    AND participant_status = 'active'
                `,
                [
                    conversationId,
                    senderId,
                ]
            );

            forwardedMessages.push({
                id:
                    forwardedMessageId,
                conversationId,
            });
        }

        if (
            forwardedMessages.length === 0
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                success: false,
                message:
                    "You are not an active participant in any destination conversation",
            });
        }

        await client.query("COMMIT");
        transactionStarted = false;

        const completeMessages = [];

        for (
            const forwarded
            of forwardedMessages
        ) {
            const completeMessage =
                await getMessageById(
                    forwarded.id,
                    pool,
                    senderId
                );

            if (completeMessage) {
                completeMessages.push(
                    completeMessage
                );

                await publishChatEvent(
                    forwarded.conversationId,
                    {
                        type:
                            "message.created",
                        message:
                            completeMessage,
                    }
                );
            }
        }

        return res.status(201).json({
            success: true,
            forwardedCount:
                completeMessages.length,
            messages:
                completeMessages,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Forward chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to forward message",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// CLEAR CONVERSATION
// ============================================================

export async function clearConversation(req, res) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(
                req.body.employeeId ||
                req.query.employeeId
            );

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        await pool.query(
            `
            UPDATE chat_participants
            SET
                cleared_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [
                id,
                employeeId,
            ]
        );

        await publishChatEvent(
            id,
            {
                type:
                    "conversation.cleared",
                employeeId,
            },
            {
                excludeEmployeeIds: [
                    employeeId,
                ],
            }
        );

        return res.json({
            success: true,
            message:
                "Conversation cleared successfully",
        });
    } catch (error) {
        console.error(
            "Clear chat conversation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to clear conversation",
        });
    }
}


// ============================================================
// DELETE CONVERSATION
// ============================================================

export async function deleteConversation(req, res) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(
                req.body.employeeId ||
                req.query.employeeId
            );

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        await pool.query(
            `
            UPDATE chat_participants
            SET
                deleted_chat_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [
                id,
                employeeId,
            ]
        );

        await publishChatEvent(
            id,
            {
                type:
                    "conversation.deleted",
                employeeId,
            },
            {
                excludeEmployeeIds: [
                    employeeId,
                ],
            }
        );

        return res.json({
            success: true,
            message:
                "Conversation deleted successfully",
        });
    } catch (error) {
        console.error(
            "Delete chat conversation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete conversation",
        });
    }
}


// ============================================================
// LATEST CONVERSATION ACTIVITY
// ============================================================

export async function getLatestConversationActivity(
    req,
    res
) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        const result =
            await pool.query(
                `
                SELECT
                    r.id,
                    r.message_id,
                    r.employee_id,
                    r.reaction AS emoji,
                    r.created_at,

                    reactor.full_name AS reactor_name,

                    LEFT(
                        REPLACE(
                            COALESCE(
                                m.message,
                                ''
                            ),
                            E'\\n',
                            ' '
                        ),
                        70
                    ) AS message_preview

                FROM chat_message_reactions r

                INNER JOIN chat_messages m
                    ON m.id = r.message_id

                INNER JOIN employees reactor
                    ON reactor.id = r.employee_id

                INNER JOIN chat_participants cp
                    ON cp.conversation_id =
                        m.conversation_id
                    AND cp.employee_id = $2
                    AND cp.participant_status =
                        'active'

                WHERE
                    m.conversation_id = $1
                    AND m.deleted_at IS NULL
                    AND m.created_at >
                        COALESCE(
                            cp.cleared_at,
                            TO_TIMESTAMP(0)
                        )

                ORDER BY
                    r.created_at DESC,
                    r.id DESC

                LIMIT 1
                `,
                [
                    id,
                    employeeId,
                ]
            );

        return res.json({
            success: true,
            latestReaction:
                result.rows[0] || null,
        });
    } catch (error) {
        console.error(
            "Get latest chat activity error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch latest conversation activity",
        });
    }
}


// ============================================================
// PHASE 2D — REACTIONS
// ============================================================


// ============================================================
// HELPER — MESSAGE + PARTICIPANT
// ============================================================

async function getMessageForReaction(
    messageId,
    employeeId,
    client = pool
) {
    const result = await client.query(
        `
        SELECT
            m.id,
            m.conversation_id,
            m.sender_employee_id,
            m.message,
            m.message_type,
            m.deleted_at

        FROM chat_messages m

        INNER JOIN chat_participants p
            ON p.conversation_id =
                m.conversation_id

        WHERE
            m.id = $1
            AND p.employee_id = $2
            AND p.participant_status = 'active'

        LIMIT 1
        `,
        [
            messageId,
            employeeId,
        ]
    );

    return result.rows[0] || null;
}


// ============================================================
// PUBLISH REACTION
// ============================================================

async function publishReactionActivity(
    message,
    employeeId,
    action,
    emoji = null
) {
    await publishChatEvent(
        message.conversation_id,
        {
            type:
                "reaction.changed",
            messageId:
                Number(message.id),
            employeeId:
                Number(employeeId),
            action,
            emoji,
        }
    );
}


// ============================================================
// ADD / CHANGE / TOGGLE REACTION
// ============================================================

export async function reactToMessage(
    req,
    res
) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { messageId } =
            req.params;

        const {
            employeeId,
            emoji,
        } = req.body;

        const reactorId =
            Number(employeeId);

        if (
            !Number.isInteger(reactorId) ||
            reactorId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !emoji ||
            typeof emoji !== "string" ||
            !emoji.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Emoji is required",
            });
        }

        const cleanEmoji =
            emoji.trim();

        const message =
            await getMessageForReaction(
                messageId,
                reactorId,
                client
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found or you are not a participant of this conversation",
            });
        }

        if (message.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot react to a deleted message",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        const existingResult =
            await client.query(
                `
            SELECT
                id,
                reaction

            FROM chat_message_reactions

                WHERE
                    message_id = $1
                    AND employee_id = $2

                LIMIT 1
                `,
                [
                    messageId,
                    reactorId,
                ]
            );

        if (
            existingResult.rows.length === 0
        ) {
            const insertResult =
                await client.query(
                    `
                    INSERT INTO chat_message_reactions (
                        message_id,
                        employee_id,
                        reaction
                    )
                    VALUES (
                        $1,
                        $2,
                        $3
                    )
                    RETURNING *
                    `,
                    [
                        messageId,
                        reactorId,
                        cleanEmoji,
                    ]
                );

            await client.query("COMMIT");
            transactionStarted = false;

            await publishReactionActivity(
                message,
                reactorId,
                "added",
                cleanEmoji
            );

            return res.status(201).json({
                success: true,
                action: "added",
                reaction:
                    insertResult.rows[0],
            });
        }

        const existingReaction =
            existingResult.rows[0];

        if (
            existingReaction.reaction ===
            cleanEmoji
        ) {
            await client.query(
                `
                DELETE FROM chat_message_reactions
                WHERE id = $1
                `,
                [
                    existingReaction.id,
                ]
            );

            await client.query("COMMIT");
            transactionStarted = false;

            await publishReactionActivity(
                message,
                reactorId,
                "removed",
                cleanEmoji
            );

            return res.json({
                success: true,
                action: "removed",
                message:
                    "Reaction removed",
            });
        }

        const updateResult =
            await client.query(
                `
                UPDATE chat_message_reactions
                SET
                    reaction = $1
        
                WHERE 
                    id = $2
                RETURNING *
                `,
                [
                    cleanEmoji,
                    existingReaction.id,
                ]
            );

        await client.query("COMMIT");
        transactionStarted = false;

        await publishReactionActivity(
            message,
            reactorId,
            "changed",
            cleanEmoji
        );

        return res.json({
            success: true,
            action: "changed",
            reaction:
                updateResult.rows[0],
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "React to chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to react to message",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// GET MESSAGE REACTIONS
// ============================================================

export async function getMessageReactions(
    req,
    res
) {
    try {
        const { messageId } =
            req.params;

        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageForReaction(
                messageId,
                employeeId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found or you are not a participant of this conversation",
            });
        }

        const result =
            await pool.query(
                `
                SELECT
                    r.id,
                    r.message_id,
                    r.employee_id,
                    r.reaction AS emoji,
                    r.created_at,

                    e.full_name,
                    e.employee_code,
                    e.avatar

                FROM chat_message_reactions r

                INNER JOIN employees e
                    ON e.id = r.employee_id

                WHERE
                    r.message_id = $1

                ORDER BY
                    r.created_at ASC,
                    r.id ASC
                `,
                [messageId]
            );

        const grouped = {};

        for (
            const reaction
            of result.rows
        ) {
            if (
                !grouped[
                reaction.emoji
                ]
            ) {
                grouped[
                    reaction.emoji
                ] = {
                    emoji:
                        reaction.emoji,
                    count: 0,
                    employees: [],
                };
            }

            grouped[
                reaction.emoji
            ].count++;

            grouped[
                reaction.emoji
            ].employees.push({
                employee_id:
                    reaction.employee_id,
                full_name:
                    reaction.full_name,
                employee_code:
                    reaction.employee_code,
                avatar:
                    reaction.avatar,
            });
        }

        return res.json({
            success: true,
            messageId:
                Number(messageId),
            reactions:
                Object.values(grouped),
            total:
                result.rows.length,
        });
    } catch (error) {
        console.error(
            "Get chat message reactions error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch message reactions",
        });
    }
}


// ============================================================
// REMOVE REACTION
// ============================================================

export async function removeMessageReaction(
    req,
    res
) {
    try {
        const { messageId } =
            req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageForReaction(
                messageId,
                employeeId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found or you are not a participant of this conversation",
            });
        }

        const result =
            await pool.query(
                `
                DELETE FROM chat_message_reactions
                WHERE
                    message_id = $1
                    AND employee_id = $2
                RETURNING *
                `,
                [
                    messageId,
                    employeeId,
                ]
            );

        if (
            result.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "You have not reacted to this message",
            });
        }

        await publishReactionActivity(
            message,
            employeeId,
            "removed",
            result.rows[0].emoji
        );

        return res.json({
            success: true,
            action: "removed",
            reaction:
                result.rows[0],
        });
    } catch (error) {
        console.error(
            "Remove chat message reaction error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to remove reaction",
        });
    }
}


// ============================================================
// PHASE 2E — MESSAGE ACTIONS
// PIN / STAR / REPORT
// ============================================================


// ============================================================
// PIN MESSAGE
// ============================================================

export async function pinMessage(
    req,
    res
) {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageById(
                id,
                client,
                employeeId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        if (message.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Deleted messages cannot be pinned",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                message.conversation_id,
                client
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot pin this message",
            });
        }

        const result =
            await client.query(
                `
                INSERT INTO chat_pinned_messages (
                    message_id,
                    conversation_id,
                    pinned_by
                )
                VALUES (
                    $1,
                    $2,
                    $3
                )
                ON CONFLICT (
                    message_id,
                    pinned_by
                )
                DO NOTHING
                RETURNING
                    id,
                    message_id,
                    conversation_id,
                    pinned_by,
                    pinned_at
                `,
                [
                    id,
                    message.conversation_id,
                    employeeId,
                ]
            );

        const pin =
            result.rows[0] || null;

        await publishChatEvent(
            message.conversation_id,
            {
                type:
                    "message.pin.changed",
                messageId:
                    Number(id),
                employeeId,
                pinned: true,
                pin,
            }
        );

        return res.status(201).json({
            success: true,
            pinned: true,
            pin,
        });
    } catch (error) {
        console.error(
            "Pin chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to pin message",
        });
    } finally {
        client.release();
    }
}


// ============================================================
// UNPIN MESSAGE
// ============================================================

export async function unpinMessage(
    req,
    res
) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageById(
                id,
                pool,
                employeeId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                message.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot unpin this message",
            });
        }

        const result =
            await pool.query(
                `
                DELETE FROM chat_pinned_messages
                WHERE
                    message_id = $1
                    AND pinned_by = $2
                RETURNING *
                `,
                [
                    id,
                    employeeId,
                ]
            );

        await publishChatEvent(
            message.conversation_id,
            {
                type:
                    "message.pin.changed",
                messageId:
                    Number(id),
                employeeId,
                pinned: false,
                pin:
                    result.rows[0] ||
                    null,
            }
        );

        return res.json({
            success: true,
            pinned: false,
        });
    } catch (error) {
        console.error(
            "Unpin chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to unpin message",
        });
    }
}


// ============================================================
// GET PINNED MESSAGES
// ============================================================

export async function getPinnedMessages(
    req,
    res
) {
    try {
        const { conversationId } =
            req.params;

        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                conversationId
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        const result =
            await pool.query(
                `
                SELECT
                    p.id,
                    p.message_id,
                    p.pinned_by,
                    p.pinned_at,

                    m.message,
                    m.message_type,
                    m.created_at,

                    e.full_name AS pinned_by_name

                FROM chat_pinned_messages p

                INNER JOIN chat_messages m
                    ON m.id = p.message_id

                INNER JOIN employees e
                    ON e.id = p.pinned_by

                WHERE
                    p.conversation_id = $1
                    AND m.deleted_at IS NULL

                ORDER BY
                    p.pinned_at DESC
                `,
                [conversationId]
            );

        return res.json({
            success: true,
            pins:
                result.rows,
        });
    } catch (error) {
        console.error(
            "Get pinned chat messages error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch pinned messages",
        });
    }
}

// ============================================================
// GET STARRED MESSAGES
// ============================================================
//
// GET /api/chat/starred-messages?employeeId=44
//
// Returns messages starred by the requesting employee.
//
// ============================================================

export async function getStarredMessages(
    req,
    res
) {
    try {
        const employeeId =
            Number(req.query.employeeId);

        // ----------------------------------------------------
        // Validate employee
        // ----------------------------------------------------

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        // ----------------------------------------------------
        // Get starred messages
        // ----------------------------------------------------

        const result =
            await pool.query(
                `
                SELECT
                    s.id,
                    s.message_id,
                    s.employee_id,
                    s.starred_at,

                    m.conversation_id,
                    m.sender_employee_id,
                    m.message,
                    m.message_type,
                    m.created_at,
                    m.deleted_at,

                    e.full_name AS sender_name,

                    c.conversation_type,
                    c.title

                FROM chat_starred_messages s

                INNER JOIN chat_messages m
                    ON m.id = s.message_id

                INNER JOIN employees e
                    ON e.id = m.sender_employee_id

                INNER JOIN chat_conversations c
                    ON c.id = m.conversation_id

                WHERE
                    s.employee_id = $1
                    AND m.deleted_at IS NULL
                    AND EXISTS (
                        SELECT 1
                        FROM chat_participants cp
                        WHERE
                            cp.conversation_id =
                                m.conversation_id
                            AND cp.employee_id = $1
                    )

                ORDER BY
                    s.starred_at DESC
                `,
                [
                    employeeId,
                ]
            );

        return res.json({
            success: true,
            starredMessages:
                result.rows,
        });

    } catch (error) {
        console.error(
            "Get starred chat messages error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch starred messages",
        });
    }
}

// ============================================================
// STAR MESSAGE
// ============================================================

export async function starMessage(
    req,
    res
) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageById(
                id,
                pool,
                employeeId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        if (message.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Deleted messages cannot be starred",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                message.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot star this message",
            });
        }

        const result =
            await pool.query(
                `
                INSERT INTO chat_starred_messages (
                    message_id,
                    employee_id
                )
                VALUES (
                    $1,
                    $2
                )
                ON CONFLICT (
                    message_id,
                    employee_id
                )
                DO NOTHING
                RETURNING
                    id,
                    message_id,
                    employee_id,
                    starred_at
                `,
                [
                    id,
                    employeeId,
                ]
            );

        await publishChatEvent(
            message.conversation_id,
            {
                type:
                    "message.star.changed",
                messageId:
                    Number(id),
                employeeId,
                starred: true,
                star:
                    result.rows[0] ||
                    null,
            }
        );

        return res.status(201).json({
            success: true,
            starred: true,
            star:
                result.rows[0] ||
                null,
        });
    } catch (error) {
        console.error(
            "Star chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to star message",
        });
    }
}


// ============================================================
// UNSTAR MESSAGE
// ============================================================

export async function unstarMessage(
    req,
    res
) {
    try {
        const { id } = req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageById(
                id,
                pool,
                employeeId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const participant =
            await verifyConversationParticipant(
                employeeId,
                message.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot unstar this message",
            });
        }

        const result =
            await pool.query(
                `
                DELETE FROM chat_starred_messages
                WHERE
                    message_id = $1
                    AND employee_id = $2
                RETURNING *
                `,
                [
                    id,
                    employeeId,
                ]
            );

        await publishChatEvent(
            message.conversation_id,
            {
                type:
                    "message.star.changed",
                messageId:
                    Number(id),
                employeeId,
                starred: false,
                star:
                    result.rows[0] ||
                    null,
            }
        );

        return res.json({
            success: true,
            starred: false,
        });
    } catch (error) {
        console.error(
            "Unstar chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to unstar message",
        });
    }
}


// ============================================================
// REPORT MESSAGE
// ============================================================

export async function reportMessage(
    req,
    res
) {
    try {
        const { id } = req.params;

        const {
            employeeId,
            reason = "other",
            details = null,
        } = req.body;

        const reporterId =
            Number(employeeId);

        if (
            !Number.isInteger(reporterId) ||
            reporterId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const message =
            await getMessageById(
                id,
                pool,
                reporterId
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const participant =
            await verifyConversationParticipant(
                reporterId,
                message.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot report this message",
            });
        }

        const result =
            await pool.query(
                `
                INSERT INTO chat_message_reports (
                    message_id,
                    conversation_id,
                    reported_by,
                    reason,
                    details
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                RETURNING
                    id,
                    message_id,
                    conversation_id,
                    reported_by,
                    reason,
                    details,
                    status,
                    created_at
                `,
                [
                    id,
                    message.conversation_id,
                    reporterId,
                    String(reason).slice(
                        0,
                        100
                    ),
                    details
                        ? String(details)
                        : null,
                ]
            );

        return res.status(201).json({
            success: true,
            report:
                result.rows[0],
        });
    } catch (error) {
        console.error(
            "Report chat message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to report message",
        });
    }
}


// ============================================================
// PHASE 2G — CHAT ATTACHMENTS
// ============================================================


// ============================================================
// ATTACHMENT TYPE HELPER
// ============================================================

function getAttachmentMessageType(file) {
    if (
        file?.mimetype?.startsWith(
            "image/"
        )
    ) {
        return "image";
    }

    if (
        file?.mimetype?.startsWith(
            "video/"
        )
    ) {
        return "video";
    }

    return "file";
}


// ============================================================
// GET MESSAGE ATTACHMENTS
// ============================================================

export async function getMessageAttachments(
    req,
    res
) {
    try {
        const { messageId } =
            req.params;

        const employeeId =
            Number(req.query.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        const messageResult =
            await pool.query(
                `
                SELECT
                    m.id,
                    m.conversation_id
                FROM chat_messages m
                WHERE
                    m.id = $1
                LIMIT 1
                `,
                [messageId]
            );

        if (
            !messageResult.rows.length
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const message =
            messageResult.rows[0];

        const participant =
            await verifyConversationParticipant(
                employeeId,
                message.conversation_id
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    message_id,
                    file_name,
                    file_url,
                    file_type,
                    file_size,
                    created_at
                FROM chat_message_attachments
                WHERE
                    message_id = $1
                ORDER BY id ASC
                `,
                [messageId]
            );

        return res.json({
            success: true,
            messageId:
                Number(messageId),
            attachments:
                result.rows,
        });
    } catch (error) {
        console.error(
            "Get chat attachments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch message attachments",
        });
    }
}


// ============================================================
// UPLOAD MESSAGE ATTACHMENTS
// ============================================================

export async function uploadMessageAttachments(
    req,
    res
) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { messageId } =
            req.params;

        const employeeId =
            Number(req.body.employeeId);

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !req.files ||
            req.files.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "At least one attachment is required",
            });
        }

        const messageResult =
            await client.query(
                `
                SELECT
                    id,
                    conversation_id,
                    sender_employee_id,
                    deleted_at
                FROM chat_messages
                WHERE
                    id = $1
                LIMIT 1
                `,
                [messageId]
            );

        if (
            !messageResult.rows.length
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found",
            });
        }

        const message =
            messageResult.rows[0];

        const participant =
            await verifyConversationParticipant(
                employeeId,
                message.conversation_id,
                client
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        if (
            Number(
                message.sender_employee_id
            ) !== employeeId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only add attachments to your own message",
            });
        }

        if (message.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "Deleted messages cannot have attachments",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        const attachments = [];

        for (
            const file of req.files
        ) {
            const attachmentType =
                getAttachmentMessageType(
                    file
                );

            const fileUrl =
                `/uploads/chat/${file.filename}`;

            const result =
                await client.query(
                    `
                    INSERT INTO chat_message_attachments (
                        message_id,
                        file_name,
                        file_url,
                        file_type,
                        file_size
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING
                        id,
                        message_id,
                        file_name,
                        file_url,
                        file_type,
                        file_size,
                        created_at
                    `,
                    [
                        messageId,
                        file.originalname,
                        fileUrl,
                        file.mimetype,
                        file.size,
                    ]
                );

            attachments.push({
                ...result.rows[0],
                attachment_type:
                    attachmentType,
            });
        }

        let messageType =
            "file";

        const attachmentTypes =
            attachments.map(
                (attachment) =>
                    attachment.attachment_type
            );

        if (
            attachmentTypes.length > 0 &&
            attachmentTypes.every(
                (type) =>
                    type === "image"
            )
        ) {
            messageType = "image";
        } else if (
            attachmentTypes.length > 0 &&
            attachmentTypes.every(
                (type) =>
                    type === "video"
            )
        ) {
            messageType = "video";
        }

        await client.query(
            `
            UPDATE chat_messages
            SET
                message_type = $1,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [
                messageType,
                messageId,
            ]
        );

        await client.query(
            `
            UPDATE chat_conversations
            SET
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [
                message.conversation_id,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        const completeMessage =
            await getMessageById(
                messageId,
                pool,
                employeeId
            );

        await publishChatEvent(
            message.conversation_id,
            {
                type:
                    "message.updated",
                message:
                    completeMessage,
            }
        );

        return res.status(201).json({
            success: true,
            messageId:
                Number(messageId),
            messageType,
            attachments,
            message:
                completeMessage,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Upload chat attachments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to upload attachments",
        });
    } finally {
        client.release();
    }
}

// ============================================================
// SEND MESSAGE WITH ATTACHMENTS
// Creates the message + uploads all attachments atomically.
// Used by the WhatsApp-style media/document composer.
// ============================================================

export async function sendMessageWithAttachments(
    req,
    res
) {
    const client = await pool.connect();

    let transactionStarted = false;
    const savedFiles = [];

    try {
        const { id } = req.params;

        const employeeId = Number(
            req.body.employeeId
        );

        const caption =
            typeof req.body.caption === "string"
                ? req.body.caption.trim()
                : "";

        const replyToMessageId =
            req.body.replyToMessageId
                ? Number(req.body.replyToMessageId)
                : null;

        if (
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid employee ID is required",
            });
        }

        if (
            !req.files ||
            req.files.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "At least one attachment is required",
            });
        }

        // --------------------------------------------------------
        // Validate participant
        // --------------------------------------------------------

        const participant =
            await verifyConversationParticipant(
                employeeId,
                id,
                client
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not a participant of this conversation",
            });
        }

        // --------------------------------------------------------
        // Validate attachment count/types
        // --------------------------------------------------------

        const imageFiles =
            req.files.filter((file) =>
                String(file.mimetype || "")
                    .toLowerCase()
                    .startsWith("image/")
            );

        const videoFiles =
            req.files.filter((file) =>
                String(file.mimetype || "")
                    .toLowerCase()
                    .startsWith("video/")
            );

        const documentFiles =
            req.files.filter(
                (file) =>
                    !String(file.mimetype || "")
                        .toLowerCase()
                        .startsWith("image/") &&
                    !String(file.mimetype || "")
                        .toLowerCase()
                        .startsWith("video/")
            );

        // Documents are sent individually.
        if (
            documentFiles.length > 0 &&
            req.files.length > 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Send one document at a time",
            });
        }

        // Maximum eight photos/videos.
        if (
            imageFiles.length +
                videoFiles.length >
            8
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "You can attach at most 8 photos/videos at once",
            });
        }

        // Maximum two videos.
        if (videoFiles.length > 2) {
            return res.status(400).json({
                success: false,
                message:
                    "You can attach at most 2 videos at once",
            });
        }

        // Photos: maximum 16 MB each.
        const maxImageSize =
            16 * 1024 * 1024;

        const oversizedImage =
            imageFiles.find(
                (file) =>
                    Number(file.size) >
                    maxImageSize
            );

        if (oversizedImage) {
            return res.status(400).json({
                success: false,
                message:
                    "Each photo must be 16 MB or smaller",
            });
        }

        // Videos/documents: maximum 100 MB.
        const maxFileSize =
            100 * 1024 * 1024;

        const oversizedFile =
            req.files.find(
                (file) =>
                    Number(file.size) >
                    maxFileSize
            );

        if (oversizedFile) {
            return res.status(400).json({
                success: false,
                message:
                    "Files must be 100 MB or smaller",
            });
        }

        // --------------------------------------------------------
        // Validate reply
        // --------------------------------------------------------

        if (replyToMessageId) {
            if (
                !Number.isInteger(
                    replyToMessageId
                ) ||
                replyToMessageId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid reply message",
                });
            }

            const replyCheck =
                await client.query(
                    `
                    SELECT id
                    FROM chat_messages
                    WHERE
                        id = $1
                        AND conversation_id = $2
                        AND deleted_at IS NULL
                    LIMIT 1
                    `,
                    [
                        replyToMessageId,
                        id,
                    ]
                );

            if (
                replyCheck.rows.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Reply message does not belong to this conversation",
                });
            }
        }

        // --------------------------------------------------------
        // Determine message type
        // --------------------------------------------------------

        let messageType = "file";

        if (
            imageFiles.length > 0 &&
            imageFiles.length ===
                req.files.length
        ) {
            messageType = "image";
        } else if (
            videoFiles.length > 0 &&
            videoFiles.length ===
                req.files.length
        ) {
            messageType = "video";
        }

        // --------------------------------------------------------
        // Start transaction
        // --------------------------------------------------------

        await client.query("BEGIN");
        transactionStarted = true;

        // --------------------------------------------------------
        // Create message
        //
        // chat_messages.message is NOT NULL, but an empty string
        // is valid. This allows media without a caption.
        // --------------------------------------------------------

        const messageResult =
            await client.query(
                `
                INSERT INTO chat_messages (
                    conversation_id,
                    sender_employee_id,
                    message,
                    message_type,
                    reply_to_message_id
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                RETURNING *
                `,
                [
                    id,
                    employeeId,
                    caption,
                    messageType,
                    replyToMessageId,
                ]
            );

        const newMessage =
            messageResult.rows[0];

        // --------------------------------------------------------
        // Save attachments
        // --------------------------------------------------------

        const attachments = [];

        for (
            const file of req.files
        ) {
            const attachmentType =
                getAttachmentMessageType(
                    file
                );

            const fileUrl =
                `/uploads/chat/${file.filename}`;

            savedFiles.push(file.path);

            const attachmentResult =
                await client.query(
                    `
                    INSERT INTO chat_message_attachments (
                        message_id,
                        file_name,
                        file_url,
                        file_type,
                        file_size
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING
                        id,
                        message_id,
                        file_name,
                        file_url,
                        file_type,
                        file_size,
                        created_at
                    `,
                    [
                        newMessage.id,
                        file.originalname,
                        fileUrl,
                        file.mimetype,
                        file.size,
                    ]
                );

            attachments.push({
                ...attachmentResult.rows[0],
                attachment_type:
                    attachmentType,
            });
        }

        // --------------------------------------------------------
        // Update conversation's latest message
        // --------------------------------------------------------

        await client.query(
            `
            UPDATE chat_conversations
            SET
                last_message_id = $1,
                last_message_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [
                newMessage.id,
                id,
            ]
        );

        // --------------------------------------------------------
        // Sending a new message makes a previously cleared
        // personal chat visible again.
        // --------------------------------------------------------

        await client.query(
            `
            UPDATE chat_participants
            SET
                deleted_chat_at = NULL
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [
                id,
                employeeId,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        // --------------------------------------------------------
        // Fetch the complete message.
        // This includes attachments, reactions, reply data,
        // pinned/starred state, etc.
        // --------------------------------------------------------

        const completeMessage =
            await getMessageById(
                newMessage.id,
                pool,
                employeeId
            );

        // --------------------------------------------------------
        // Publish ONE complete realtime event.
        // --------------------------------------------------------

        await publishChatEvent(
            id,
            {
                type:
                    "message.created",
                message:
                    completeMessage,
            }
        );

        return res.status(201).json({
            success: true,
            message:
                completeMessage,
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query(
                "ROLLBACK"
            );
        }

        // Remove files if database transaction
        // failed after Multer already saved them.
        for (
            const filePath of savedFiles
        ) {
            try {
                if (
                    fs.existsSync(filePath)
                ) {
                    fs.unlinkSync(
                        filePath
                    );
                }
            } catch (cleanupError) {
                console.error(
                    "Attachment cleanup error:",
                    cleanupError
                );
            }
        }

        console.error(
            "Send message with attachments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to send attachment",
        });
    } finally {
        client.release();
    }
}