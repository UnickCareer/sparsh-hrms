/**
 * chat.permissions.js
 *
 * Enterprise-grade chat component/module.
 */

/**
 * Central place for all chat permission rules.
 * Manages role-based access control for chat operations.
 */
import pool from "../config/db.js";

// employees.role values (compared lower-case) that count as SYSTEM admins.
// Only these people may create groups.
/**
 * System administrator roles
 * Roles that have full administrative access.
 */
export const SYSTEM_ADMIN_ROLES = new Set(["admin"]);

// group roles with admin-level powers (edit info, add people, polls, messaging setting)
/**
 * Group staff roles
 * Roles with admin-level powers in groups.
 */
export const GROUP_STAFF_ROLES = ["owner", "super_admin", "admin"];
/**
 * Check if role is group staff
 * @param {string} role - User role
 * @returns {boolean} True if staff
 */
export const isStaff = (role) => GROUP_STAFF_ROLES.includes(role);

/**
 * Check if employee is system admin
 * @param {number} employeeId - Employee ID
 * @param {object} client - Database client
 * @returns {Promise<boolean>} True if admin
 */
export async function isSystemAdmin(employeeId, client = pool) {
    const result = await client.query(
        `SELECT role FROM employees WHERE id = $1 LIMIT 1`,
        [employeeId]
    );
    const role = String(result.rows[0]?.role || "").trim().toLowerCase();
    return SYSTEM_ADMIN_ROLES.has(role);
}

// Active membership + the conversation facts the rules need.
/**
 * Get conversation membership
 * @param {number} conversationId - Conversation ID
 * @param {number} employeeId - Employee ID
 * @param {object} client - Database client
 * @returns {Promise<object|null>} Membership info
 */
export async function getMembership(conversationId, employeeId, client = pool) {
    const result = await client.query(
        `
        SELECT
            p.id,
            p.employee_id,
            p.participant_role,
            c.conversation_type,
            c.only_admins_can_message
        FROM chat_participants p
        INNER JOIN chat_conversations c
            ON c.id = p.conversation_id
        WHERE
            p.conversation_id = $1
            AND p.employee_id = $2
            AND p.participant_status = 'active'
        LIMIT 1
        `,
        [conversationId, employeeId]
    );
    return result.rows[0] || null;
}

// Who may remove whom
//   owner       -> anyone except the owner
//   super_admin -> admins and members
//   admin       -> members only
/**
 * Check if actor can remove target member
 * @param {string} actorRole - Actor role
 * @param {string} targetRole - Target role
 * @returns {boolean} True if allowed
 */
export function canRemoveMember(actorRole, targetRole) {
    if (targetRole === "owner") return false;
    if (actorRole === "owner") return true;
    if (actorRole === "super_admin") return targetRole === "admin" || targetRole === "member";
    if (actorRole === "admin") return targetRole === "member";
    return false;
}

// Who may change whose role
//   owner       -> any non-owner to member / admin / super_admin
//   super_admin -> member <-> admin only
//   admin       -> member -> admin only
/**
 * Check if actor can set role
 * @param {string} actorRole - Actor role
 * @param {string} targetRole - Target role
 * @param {string} newRole - New role
 * @returns {boolean} True if allowed
 */
export function canSetRole(actorRole, targetRole, newRole) {
    if (!["member", "admin", "super_admin"].includes(newRole)) return false;
    if (targetRole === "owner" || newRole === targetRole) return false;
    if (actorRole === "owner") return true;
    if (actorRole === "super_admin") {
        return (
            (targetRole === "member" && newRole === "admin") ||
            (targetRole === "admin" && newRole === "member")
        );
    }
    if (actorRole === "admin") return targetRole === "member" && newRole === "admin";
    return false;
}

// Can this person send content (messages, files, polls, forwards) here?
// Direct chats are never restricted. Groups can be set to "admins only".
/**
 * Check if employee can post in conversation
 * @param {number} conversationId - Conversation ID
 * @param {number} employeeId - Employee ID
 * @param {object} client - Database client
 * @returns {Promise<object>} Permission result
 */
export async function checkCanPost(conversationId, employeeId, client = pool) {
    const membership = await getMembership(conversationId, employeeId, client);
    if (!membership) {
        return {
            ok: false,
            status: 403,
            message: "You are not a participant of this conversation",
        };
    }
    if (
        membership.conversation_type === "group" &&
        membership.only_admins_can_message &&
        !isStaff(membership.participant_role)
    ) {
        return {
            ok: false,
            status: 403,
            message: "Only admins can send messages in this group",
        };
    }
    return { ok: true, membership };
}