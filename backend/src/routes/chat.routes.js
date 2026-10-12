import express from "express";
import pool from "../config/db.js";
import { subscribeEmployee, publishToConversation } from "../realtime/chat.realtime.js";
import { chatUpload } from "../middleware/chatUpload.js";
import { createPoll, votePoll } from "../controllers/polls.controller.js";

import {
    // ========================================================
    // PHASE 2A — CONVERSATIONS & GROUPS
    // ========================================================

    getMyConversations,
    getConversationById,
    createDirectChat,
    createGroup,

    // ========================================================
    // PHASE 2B — MESSAGES
    // ========================================================

    getMessages,
    markConversationRead,
    sendMessage,
    editMessage,
    deleteMessage,

    // ========================================================
    // PHASE 2C — REPLY & FORWARD
    // ========================================================

    replyToMessage,
    forwardMessage,


    // ========================================================
    // PHASE 2D — MESSAGE REACTIONS
    // ========================================================

    reactToMessage,
    getMessageReactions,
    removeMessageReaction,
    getLatestConversationActivity,
    clearConversation,
    deleteConversation,

    // ========================================================
    // PHASE 2E — MESSAGE ACTIONS
    // ========================================================
    pinMessage,
    unpinMessage,
    getPinnedMessages,
    getStarredMessages,
    starMessage,
    unstarMessage,
    reportMessage,
    
    // ========================================================
    // PHASE 2F — MESSAGE ATTACHMENTS
    // ========================================================
    getMessageAttachments,
    uploadMessageAttachments,
    sendMessageWithAttachments,
    getConversationInfoContent,
    getPersonChatInfo,
    addGroupParticipant
} from "../controllers/chat.controller.js";

import {
    getChatPermissions,
    removeGroupParticipant,
    updateParticipantRole,
    updateGroupInfo,
    uploadGroupAvatar,
    removeGroupAvatar,
} from "../controllers/chat.group.controller.js";



const router = express.Router();

// ============================================================
// CHAT REAL-TIME EVENT STREAM
// ============================================================

router.get("/events", async (req, res) => {
    const employeeId = Number(req.query.employeeId);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Valid employee ID is required",
        });
    }

    const employee = await pool.query(
        "SELECT id FROM employees WHERE id = $1 LIMIT 1",
        [employeeId]
    );

    if (!employee.rows.length) {
        return res.status(404).json({
            success: false,
            message: "Employee not found",
        });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(`retry: 2000\n\n`);

    const unsubscribe = subscribeEmployee(employeeId, res);

    req.on("close", () => {
        unsubscribe();
    });
});

// ============================================================
// TYPING INDICATOR
// ============================================================

router.post("/conversations/:id/typing", async (req, res) => {
    try {
        const conversationId = Number(req.params.id);
        const employeeId = Number(req.body.employeeId);
        const isTyping = Boolean(req.body.isTyping);

        if (
            !Number.isInteger(conversationId) ||
            conversationId <= 0 ||
            !Number.isInteger(employeeId) ||
            employeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid conversation and employee IDs are required",
            });
        }

        const participant = await pool.query(
            `
            SELECT
                p.employee_id,
                e.full_name
            FROM chat_participants p
            INNER JOIN employees e ON e.id = p.employee_id
            WHERE p.conversation_id = $1
              AND p.employee_id = $2
              AND p.participant_status = 'active'
            LIMIT 1
            `,
            [conversationId, employeeId]
        );

        if (!participant.rows.length) {
            return res.status(403).json({
                success: false,
                message: "You are not a participant of this conversation",
            });
        }

        await publishToConversation(
            conversationId,
            {
                type: "typing",
                conversationId,
                employeeId,
                employeeName: participant.rows[0].full_name,
                isTyping,
            },
            { excludeEmployeeIds: [employeeId] }
        );

        return res.json({ success: true });
    } catch (error) {
        console.error("Chat typing event error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update typing status",
        });
    }
});


// ============================================================
// PHASE 2A — CONVERSATIONS & GROUPS
// ============================================================


// ============================================================
// GET MY CONVERSATIONS
// ============================================================
//
// GET /api/chat/conversations?employeeId=44
//
// ============================================================

router.get(
    "/conversations",
    getMyConversations
);


// ============================================================
// GET SINGLE CONVERSATION
// ============================================================
//
// GET /api/chat/conversations/1?employeeId=44
//
// ============================================================

router.get(
    "/conversations/:id",
    getConversationById
);


// ============================================================
// CREATE DIRECT CHAT
// ============================================================
//
// POST /api/chat/conversations/direct
//
// Body:
//
// {
//     "employeeId": 44,
//     "otherEmployeeId": 36
// }
//
// ============================================================

router.post(
    "/conversations/direct",
    createDirectChat
);


// ============================================================
// CREATE GROUP
// ============================================================
//
// POST /api/chat/conversations/group
//
// Body:
//
// {
//     "employeeId": 44,
//     "title": "Sales Team",
//     "description": "Sales discussion",
//     "participantIds": [36, 37, 38]
// }
//
// ============================================================

router.post(
    "/conversations/group",
    createGroup
);


// ============================================================
// PHASE 2B — MESSAGES
// ============================================================


// ============================================================
// GET MESSAGES
// ============================================================
//
// GET /api/chat/conversations/1/messages?employeeId=44
//
// ============================================================

router.get(
    "/conversations/:id/messages",
    getMessages
);

router.get(
    "/conversations/:id/latest-activity",
    getLatestConversationActivity
);

router.post(
    "/conversations/:id/clear",
    clearConversation
);

router.delete(
    "/conversations/:id",
    deleteConversation
);

router.post("/conversations/:id/read", markConversationRead);


// ============================================================
// SEND MESSAGE
// ============================================================
//
// POST /api/chat/conversations/1/messages
//
// Body:
//
// {
//     "employeeId": 44,
//     "message": "Hello"
// }
//
// Optional:
//
// {
//     "employeeId": 44,
//     "message": "Hello",
//     "messageType": "text",
//     "replyToMessageId": 10
// }
//
// ============================================================

router.post(
    "/conversations/:id/messages",
    sendMessage
);


// ============================================================
// EDIT MESSAGE
// ============================================================
//
// PATCH /api/chat/messages/1
//
// Body:
//
// {
//     "employeeId": 44,
//     "message": "Edited text"
// }
//
// ============================================================

router.patch(
    "/messages/:id",
    editMessage
);


// ============================================================
// DELETE MESSAGE
// ============================================================
//
// DELETE /api/chat/messages/1
//
// Body:
//
// {
//     "employeeId": 44
// }
//
// ============================================================

router.delete(
    "/messages/:id",
    deleteMessage
);


// ============================================================
// PHASE 2C — REPLY & FORWARD
// ============================================================


// ============================================================
// REPLY TO MESSAGE
// ============================================================
//
// POST /api/chat/messages/1/reply
//
// Body:
//
// {
//     "employeeId": 44,
//     "message": "My reply"
// }
//
// ============================================================

router.post(
    "/messages/:messageId/reply",
    replyToMessage
);


// ============================================================
// FORWARD MESSAGE
// ============================================================
//
// POST /api/chat/messages/1/forward
//
// Body:
//
// {
//     "employeeId": 44,
//     "conversationIds": [2, 3]
// }
//
// ============================================================

router.post(
    "/messages/:id/forward",
    forwardMessage
);


// ============================================================
// PHASE 2D — REACTIONS
// ============================================================
//
// NOT IMPLEMENTED YET.
//
// Later we will add routes such as:
//
// POST   /messages/:id/reactions
// DELETE /messages/:id/reactions/:reaction
//
// Do NOT add them yet.
//
// ============================================================

// ============================================================
// PHASE 2D — MESSAGE REACTIONS
// ============================================================


// ------------------------------------------------------------
// ADD / CHANGE / TOGGLE REACTION
// ------------------------------------------------------------
//
// POST
// /api/chat/messages/5/reaction
//
// Body:
//
// {
//     "employeeId": 44,
//     "emoji": "👍"
// }
//
// Behavior:
//
// No reaction       → Add
// Different emoji   → Change
// Same emoji        → Remove
//
// ------------------------------------------------------------

router.post(
    "/messages/:messageId/reaction",
    reactToMessage
);


// ------------------------------------------------------------
// GET MESSAGE REACTIONS
// ------------------------------------------------------------
//
// GET
// /api/chat/messages/5/reactions?employeeId=44
//
// Returns reactions grouped by emoji.
//
// ------------------------------------------------------------

router.get(
    "/messages/:messageId/reactions",
    getMessageReactions
);


// ------------------------------------------------------------
// REMOVE REACTION
// ------------------------------------------------------------
//
// DELETE
// /api/chat/messages/5/reaction
//
// Body:
//
// {
//     "employeeId": 44
// }
//
// ------------------------------------------------------------

router.delete(
    "/messages/:messageId/reaction",
    removeMessageReaction
);


// ============================================================
// PHASE 2E
// ============================================================
//
// Future Chat features will be added here.
//
// ============================================================




// ============================================================
// PHASE 2E — MESSAGE ACTIONS
// ============================================================

router.post("/messages/:id/pin", pinMessage);
router.delete("/messages/:id/pin", unpinMessage);
router.get("/conversations/:conversationId/pins", getPinnedMessages);

router.get("/starred-messages", getStarredMessages);
router.post("/messages/:id/star", starMessage);
router.delete("/messages/:id/star", unstarMessage);

router.post("/messages/:id/report", reportMessage);


// ============================================================
// CHAT ATTACHMENTS
// ============================================================


// Send a new message containing images/videos/documents.
router.post(
    "/conversations/:id/attachments",
    chatUpload.array("files", 10),
    sendMessageWithAttachments
);

// Upload images / files / videos
router.post(
    "/messages/:messageId/attachments",
    chatUpload.array("files", 10),
    uploadMessageAttachments
);

// Get attachments belonging to a message
router.get(
    "/messages/:messageId/attachments",
    getMessageAttachments
);

router.get(
    "/conversations/:id/info-content",
    getConversationInfoContent
);

router.get(
    "/people/:employeeId/info",
    getPersonChatInfo
);

router.post(
    "/conversations/:id/participants",
    addGroupParticipant
);

router.get("/permissions", getChatPermissions);
router.patch("/conversations/:id", updateGroupInfo);
router.post("/conversations/:id/avatar", chatUpload.single("avatar"), uploadGroupAvatar);
router.delete("/conversations/:id/avatar", removeGroupAvatar);
router.patch("/conversations/:id/participants/:participantId/role", updateParticipantRole);
router.delete("/conversations/:id/participants/:participantId", removeGroupParticipant);

router.post("/conversations/:id/polls", createPoll);
router.post("/messages/:messageId/poll-vote", votePoll);



export default router;