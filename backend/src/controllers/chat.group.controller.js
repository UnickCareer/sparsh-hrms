// Group management endpoints: permissions, remove member, change role,
// edit group info, group photo.
import pool from "../config/db.js";
import fs from "node:fs";
import { publishToConversation } from "../realtime/chat.realtime.js";
import {
    isSystemAdmin,
    getMembership,
    isStaff,
    canRemoveMember,
    canSetRole,
} from "./chat.permissions.js";

const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

async function publish(conversationId, event) {
    try {
        await publishToConversation(Number(conversationId), {
            ...event,
            conversationId: Number(conversationId),
        });
    } catch (error) {
        console.error("Group realtime publish error:", error);
    }
}

function removeUploadedFile(file) {
    try {
        if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (error) {
        console.error("Group avatar cleanup error:", error);
    }
}

// Validates ids + membership + group type. Sends the error response itself
// and returns null when the request must stop.
async function requireGroupActor(res, conversationId, actorId) {
    if (!validId(conversationId) || !validId(actorId)) {
        res.status(400).json({
            success: false,
            message: "Valid conversation and employee IDs are required",
        });
        return null;
    }
    const membership = await getMembership(conversationId, actorId);
    if (!membership) {
        res.status(403).json({
            success: false,
            message: "You are not a participant of this conversation",
        });
        return null;
    }
    if (membership.conversation_type !== "group") {
        res.status(400).json({
            success: false,
            message: "This action is only available in group chats",
        });
        return null;
    }
    return membership;
}

async function loadConversation(conversationId) {
    const result = await pool.query(
        `
        SELECT
            id, conversation_type, title, description, avatar,
            only_admins_can_message, created_by,
            last_message_id, last_message_at, created_at, updated_at
        FROM chat_conversations
        WHERE id = $1
        LIMIT 1
        `,
        [conversationId]
    );
    return result.rows[0] || null;
}

// GET /api/chat/permissions?employeeId=44
export async function getChatPermissions(req, res) {
    try {
        const employeeId = Number(req.query.employeeId);
        if (!validId(employeeId)) {
            return res.status(400).json({
                success: false,
                message: "Valid employee ID is required",
            });
        }
        return res.json({
            success: true,
            isSystemAdmin: await isSystemAdmin(employeeId),
        });
    } catch (error) {
        console.error("Get chat permissions error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load permissions",
        });
    }
}

// DELETE /api/chat/conversations/:id/participants/:participantId
// body: { employeeId }   (employeeId = the person doing the removal)
export async function removeGroupParticipant(req, res) {
    try {
        const conversationId = Number(req.params.id);
        const targetId = Number(req.params.participantId);
        const actorId = Number(req.body.employeeId);

        const actor = await requireGroupActor(res, conversationId, actorId);
        if (!actor) return;

        if (!validId(targetId)) {
            return res.status(400).json({
                success: false,
                message: "Valid member ID is required",
            });
        }
        if (targetId === actorId) {
            return res.status(400).json({
                success: false,
                message: "You cannot remove yourself from the group here",
            });
        }

        const target = await getMembership(conversationId, targetId);
        if (!target) {
            return res.status(404).json({
                success: false,
                message: "That person is not a member of this group",
            });
        }

        if (!canRemoveMember(actor.participant_role, target.participant_role)) {
            return res.status(403).json({
                success: false,
                message:
                    target.participant_role === "owner"
                        ? "The group owner cannot be removed"
                        : "You do not have permission to remove this member",
            });
        }

        // "left" is the removed state allowed by the existing check constraint.
        // The role is reset so a re-added person always comes back as a member.
        await pool.query(
            `
            UPDATE chat_participants
            SET
                participant_status = 'left',
                participant_role = 'member',
                updated_at = CURRENT_TIMESTAMP
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [conversationId, targetId]
        );

        await publish(conversationId, {
            type: "conversation.participant.removed",
            employeeId: targetId,
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Remove group participant error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove member",
        });
    }
}

// PATCH /api/chat/conversations/:id/participants/:participantId/role
// body: { employeeId, role: "member" | "admin" | "super_admin" }
export async function updateParticipantRole(req, res) {
    try {
        const conversationId = Number(req.params.id);
        const targetId = Number(req.params.participantId);
        const actorId = Number(req.body.employeeId);
        const newRole = String(req.body.role || "");

        const actor = await requireGroupActor(res, conversationId, actorId);
        if (!actor) return;

        if (!validId(targetId) || targetId === actorId) {
            return res.status(400).json({
                success: false,
                message: "You cannot change your own role",
            });
        }

        const target = await getMembership(conversationId, targetId);
        if (!target) {
            return res.status(404).json({
                success: false,
                message: "That person is not a member of this group",
            });
        }

        if (!canSetRole(actor.participant_role, target.participant_role, newRole)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to make this change",
            });
        }

        await pool.query(
            `
            UPDATE chat_participants
            SET participant_role = $3, updated_at = CURRENT_TIMESTAMP
            WHERE
                conversation_id = $1
                AND employee_id = $2
                AND participant_status = 'active'
            `,
            [conversationId, targetId, newRole]
        );

        await publish(conversationId, {
            type: "conversation.participant.role",
            employeeId: targetId,
            role: newRole,
        });

        return res.json({ success: true, employeeId: targetId, role: newRole });
    } catch (error) {
        console.error("Update participant role error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update role",
        });
    }
}

// PATCH /api/chat/conversations/:id
// body: { employeeId, title?, description?, onlyAdminsCanMessage? }
export async function updateGroupInfo(req, res) {
    try {
        const conversationId = Number(req.params.id);
        const actorId = Number(req.body.employeeId);

        const actor = await requireGroupActor(res, conversationId, actorId);
        if (!actor) return;

        if (!isStaff(actor.participant_role)) {
            return res.status(403).json({
                success: false,
                message: "Only admins can change group settings",
            });
        }

        const sets = [];
        const values = [conversationId];

        if (req.body.title !== undefined) {
            const title = String(req.body.title || "").trim();
            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: "Group name is required",
                });
            }
            values.push(title.slice(0, 100));
            sets.push(`title = $${values.length}`);
        }

        if (req.body.description !== undefined) {
            const description = String(req.body.description || "").trim();
            values.push(description ? description.slice(0, 500) : null);
            sets.push(`description = $${values.length}`);
        }

        if (req.body.onlyAdminsCanMessage !== undefined) {
            values.push(Boolean(req.body.onlyAdminsCanMessage));
            sets.push(`only_admins_can_message = $${values.length}`);
        }

        if (!sets.length) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update",
            });
        }

        await pool.query(
            `
            UPDATE chat_conversations
            SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            values
        );

        const conversation = await loadConversation(conversationId);
        await publish(conversationId, { type: "conversation.updated" });

        return res.json({ success: true, conversation });
    } catch (error) {
        console.error("Update group info error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update group",
        });
    }
}

// POST /api/chat/conversations/:id/avatar   (multipart: employeeId, avatar)
export async function uploadGroupAvatar(req, res) {
    const file = req.file;
    try {
        const conversationId = Number(req.params.id);
        const actorId = Number(req.body.employeeId);

        const actor = await requireGroupActor(res, conversationId, actorId);
        if (!actor) {
            removeUploadedFile(file);
            return;
        }
        if (!isStaff(actor.participant_role)) {
            removeUploadedFile(file);
            return res.status(403).json({
                success: false,
                message: "Only admins can change the group photo",
            });
        }
        if (!file) {
            return res.status(400).json({
                success: false,
                message: "Choose a photo",
            });
        }
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || "")) {
            removeUploadedFile(file);
            return res.status(400).json({
                success: false,
                message: "The group photo must be an image",
            });
        }
        if (file.size > 5 * 1024 * 1024) {
            removeUploadedFile(file);
            return res.status(400).json({
                success: false,
                message: "The group photo must be 5 MB or smaller",
            });
        }

        await pool.query(
            `UPDATE chat_conversations
             SET avatar = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [conversationId, `/uploads/chat/${file.filename}`]
        );

        const conversation = await loadConversation(conversationId);
        await publish(conversationId, { type: "conversation.updated" });

        return res.json({ success: true, conversation });
    } catch (error) {
        removeUploadedFile(file);
        console.error("Upload group avatar error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update group photo",
        });
    }
}

// DELETE /api/chat/conversations/:id/avatar   body: { employeeId }
export async function removeGroupAvatar(req, res) {
    try {
        const conversationId = Number(req.params.id);
        const actorId = Number(req.body.employeeId);

        const actor = await requireGroupActor(res, conversationId, actorId);
        if (!actor) return;

        if (!isStaff(actor.participant_role)) {
            return res.status(403).json({
                success: false,
                message: "Only admins can change the group photo",
            });
        }

        await pool.query(
            `UPDATE chat_conversations
             SET avatar = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [conversationId]
        );

        const conversation = await loadConversation(conversationId);
        await publish(conversationId, { type: "conversation.updated" });

        return res.json({ success: true, conversation });
    } catch (error) {
        console.error("Remove group avatar error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove group photo",
        });
    }
}