// backend/src/middleware/chatAuth.js

import pool from "../config/db.js";

// ============================================================
// SPARSH HRMS - CHAT AUTHORIZATION
// ============================================================
//
// IMPORTANT:
//
// HRMS role:
//     employees.role
//     Admin / Employee
//
// Chat role:
//     chat_participants.participant_role
//     owner / admin / member
//
// Chat permissions MUST be based on the participant role,
// NOT employees.role.
//
// Current project does not yet have JWT/session authentication.
// Therefore this middleware currently resolves the employee ID
// from request data. This is a temporary identity mechanism.
//
// Later, when proper authentication is added, getEmployeeId()
// should read req.user.id instead.
// ============================================================


// ============================================================
// GET CURRENT EMPLOYEE ID
// ============================================================

export function getChatEmployeeId(req) {
    if (!req) {
        return null;
    }

    // Future authenticated user support
    if (req.user?.employee_id) {
        return Number(req.user.employee_id);
    }

    if (req.user?.employeeId) {
        return Number(req.user.employeeId);
    }

    if (req.user?.id) {
        return Number(req.user.id);
    }

    // Current frontend/backend compatibility
    if (req.body?.employeeId) {
        return Number(req.body.employeeId);
    }

    if (req.body?.employee_id) {
        return Number(req.body.employee_id);
    }

    if (req.body?.currentUser?.employee_id) {
        return Number(req.body.currentUser.employee_id);
    }

    if (req.body?.currentUser?.employeeId) {
        return Number(req.body.currentUser.employeeId);
    }

    if (req.body?.currentUser?.id) {
        return Number(req.body.currentUser.id);
    }

    if (req.query?.employeeId) {
        return Number(req.query.employeeId);
    }

    if (req.query?.employee_id) {
        return Number(req.query.employee_id);
    }

    // Optional header support
    if (req.headers?.["x-employee-id"]) {
        return Number(req.headers["x-employee-id"]);
    }

    return null;
}


// ============================================================
// VALIDATE EMPLOYEE ID
// ============================================================

export function validateChatEmployeeId(req, res, next) {
    const employeeId = getChatEmployeeId(req);

    if (!employeeId || !Number.isInteger(employeeId)) {
        return res.status(401).json({
            success: false,
            message: "Chat employee identity is required",
        });
    }

    req.chatEmployeeId = employeeId;

    next();
}


// ============================================================
// GET CONVERSATION ID
// ============================================================

export function getConversationId(req) {
    if (!req) {
        return null;
    }

    const value =
        req.params?.conversationId ??
        req.params?.id ??
        req.body?.conversationId ??
        req.body?.conversation_id ??
        req.query?.conversationId ??
        req.query?.conversation_id;

    if (!value) {
        return null;
    }

    const id = Number(value);

    return Number.isInteger(id) ? id : null;
}


// ============================================================
// GET CHAT PARTICIPANT
// ============================================================
//
// Returns the employee's membership in a conversation.
//
// Example:
//
// {
//     id: 12,
//     conversation_id: 5,
//     employee_id: 44,
//     participant_role: "owner",
//     participant_status: "active"
// }
//

export async function getChatParticipant(
    conversationId,
    employeeId
) {
    if (!conversationId || !employeeId) {
        return null;
    }

    const result = await pool.query(
        `
        SELECT
            cp.id,
            cp.conversation_id,
            cp.employee_id,
            cp.participant_role,
            cp.participant_status,
            cp.last_read_at,
            cp.is_muted,
            cp.joined_at,
            cp.updated_at
        FROM chat_participants cp
        WHERE cp.conversation_id = $1
          AND cp.employee_id = $2
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
// REQUIRE CHAT PARTICIPANT
// ============================================================
//
// Allows only active participants to access a conversation.
//

export async function requireChatParticipant(
    req,
    res,
    next
) {
    try {
        const employeeId =
            req.chatEmployeeId ??
            getChatEmployeeId(req);

        const conversationId =
            getConversationId(req);

        if (!employeeId) {
            return res.status(401).json({
                success: false,
                message: "Chat employee identity is required",
            });
        }

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
        }

        const participant =
            await getChatParticipant(
                conversationId,
                employeeId
            );

        if (!participant) {
            return res.status(403).json({
                success: false,
                message: "You are not a participant of this conversation",
            });
        }

        if (
            participant.participant_status !==
            "active"
        ) {
            return res.status(403).json({
                success: false,
                message: "You are no longer an active participant",
            });
        }

        req.chatEmployeeId = employeeId;
        req.chatParticipant = participant;
        req.chatConversationId = conversationId;

        next();

    } catch (error) {
        console.error(
            "Chat participant authorization error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to verify Chat permissions",
        });
    }
}


// ============================================================
// ROLE LEVELS
// ============================================================

const CHAT_ROLE_LEVELS = {
    member: 1,
    admin: 2,
    owner: 3,
};


// ============================================================
// CHECK CHAT ROLE
// ============================================================
//
// Example:
//
// requireChatRole("admin")
//
// allows:
//
// owner
// admin
//
// but rejects:
//
// member
//

export function requireChatRole(
    minimumRole
) {
    return function (req, res, next) {

        const participant =
            req.chatParticipant;

        if (!participant) {
            return res.status(403).json({
                success: false,
                message: "Chat participant information is missing",
            });
        }

        const currentRole =
            participant.participant_role;

        const currentLevel =
            CHAT_ROLE_LEVELS[currentRole] || 0;

        const requiredLevel =
            CHAT_ROLE_LEVELS[minimumRole] || 0;

        if (
            currentLevel <
            requiredLevel
        ) {
            return res.status(403).json({
                success: false,
                message:
                    `Chat ${minimumRole} permission required`,
            });
        }

        next();
    };
}


// ============================================================
// OWNER ONLY
// ============================================================

export const requireChatOwner =
    requireChatRole("owner");


// ============================================================
// ADMIN OR OWNER
// ============================================================

export const requireChatAdmin =
    requireChatRole("admin");


// ============================================================
// MEMBER / ADMIN / OWNER
// ============================================================
//
// This is mostly useful for readability.
// requireChatParticipant() already guarantees that the user
// is an active participant.
//

export const requireChatMember =
    requireChatRole("member");


// ============================================================
// EXPORT ROLE LEVELS
// ============================================================

export {
    CHAT_ROLE_LEVELS,
};