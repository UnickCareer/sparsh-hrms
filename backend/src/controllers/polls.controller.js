/**
 * polls.controller.js
 *
 * Enterprise-grade chat component/module.
 */

import pool from "../config/db.js";
import { getMessageById } from "./chat.controller.js";
import { attachPolls } from "./chat.polls.helper.js";
import { publishToConversation } from "../realtime/chat.realtime.js";
import { getMembership, isStaff } from "./chat.permissions.js";

async function isActiveParticipant(client, employeeId, conversationId) {
    const r = await client.query(
        `SELECT 1 FROM chat_participants
          WHERE conversation_id = $1 AND employee_id = $2 AND participant_status = 'active' LIMIT 1`,
        [conversationId, employeeId]
    );
    return r.rows.length > 0;
}

/**
 * Create a poll in conversation
 * POST /api/chat/conversations/:id/polls
 * @param {object} req - Express request
 * @param {object} res - Express response
 * body: { employeeId, question, options: [...], allowMultipleAnswers, allowVoteChanges }
 */
export async function createPoll(req, res) {
    const client = await pool.connect();
    let started = false;
    try {
        const conversationId = Number(req.params.id);
        const senderId = Number(req.body.employeeId);
        const question = String(req.body.question || "").trim();
        const options = (Array.isArray(req.body.options) ? req.body.options : [])
            .map((o) => String(o || "").trim())
            .filter(Boolean);

        if (!senderId || !conversationId) {
            return res.status(400).json({ success: false, message: "Valid employee and conversation are required" });
        }
        if (!question) return res.status(400).json({ success: false, message: "Enter a poll question." });
        if (options.length < 2) return res.status(400).json({ success: false, message: "Add at least two poll options." });
        if (options.length > 12) return res.status(400).json({ success: false, message: "A poll can have at most 12 options." });

        if (!(await isActiveParticipant(client, senderId, conversationId))) {
            return res.status(403).json({ success: false, message: "You are not a participant of this conversation" });
        }

        const membership = await getMembership(conversationId, senderId, client);
        if (
            membership?.conversation_type === "group" &&
            !isStaff(membership.participant_role)
        ) {
            return res.status(403).json({
                success: false,
                message: "Only admins can create polls in groups",
            });
        }

        await client.query("BEGIN");
        started = true;

        const msg = await client.query(
            `INSERT INTO chat_messages (conversation_id, sender_employee_id, message, message_type)
             VALUES ($1, $2, $3, 'poll') RETURNING id`,
            [conversationId, senderId, question.slice(0, 255)]
        );
        const messageId = msg.rows[0].id;

        const poll = await client.query(
            `INSERT INTO chat_polls (message_id, question, allow_multiple_answers, allow_vote_changes, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [messageId, question, Boolean(req.body.allowMultipleAnswers), req.body.allowVoteChanges !== false, senderId]
        );
        for (let i = 0; i < options.length; i++) {
            await client.query(
                `INSERT INTO chat_poll_options (poll_id, option_text, position) VALUES ($1, $2, $3)`,
                [poll.rows[0].id, options.slice(0, 12)[i].slice(0, 100), i]
            );
        }

        await client.query(
            `UPDATE chat_conversations
                SET last_message_id = $1, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2`,
            [messageId, conversationId]
        );
        await client.query(
            `UPDATE chat_participants SET deleted_chat_at = NULL
              WHERE conversation_id = $1 AND employee_id = $2 AND participant_status = 'active'`,
            [conversationId, senderId]
        );

        await client.query("COMMIT");
        started = false;

        const full = await getMessageById(messageId, pool, senderId);
        try {
            await publishToConversation(
                conversationId,
                { type: "message.created", conversationId, message: full },
                { excludeEmployeeIds: [senderId] }
            );
        } catch (e) {
            console.error("Poll publish error:", e);
        }
        return res.status(201).json({ success: true, message: full });
    } catch (error) {
        if (started) await client.query("ROLLBACK");
        console.error("Create poll error:", error);
        return res.status(500).json({ success: false, message: "Failed to create poll" });
    } finally {
        client.release();
    }
}

/**
 * Vote in a poll
 * POST /api/chat/messages/:messageId/poll-vote
 * @param {object} req - Express request
 * @param {object} res - Express response
 * body: { employeeId, optionIds: [...] }
 */
export async function votePoll(req, res) {
    const client = await pool.connect();
    let started = false;
    try {
        const messageId = Number(req.params.messageId);
        const employeeId = Number(req.body.employeeId);
        const optionIds = [...new Set((Array.isArray(req.body.optionIds) ? req.body.optionIds : []).map(Number))]
            .filter((n) => Number.isInteger(n) && n > 0);

        if (!messageId || !employeeId || !optionIds.length) {
            return res.status(400).json({ success: false, message: "Choose at least one option" });
        }

        const pollResult = await client.query(
            `SELECT p.id, p.allow_multiple_answers, p.allow_vote_changes, m.conversation_id, m.deleted_at
               FROM chat_polls p JOIN chat_messages m ON m.id = p.message_id
              WHERE p.message_id = $1`,
            [messageId]
        );
        const poll = pollResult.rows[0];
        if (!poll) return res.status(404).json({ success: false, message: "Poll not found" });
        if (poll.deleted_at) return res.status(400).json({ success: false, message: "This poll was deleted" });

        if (!(await isActiveParticipant(client, employeeId, poll.conversation_id))) {
            return res.status(403).json({ success: false, message: "You are not a participant of this conversation" });
        }
        if (!poll.allow_multiple_answers && optionIds.length > 1) {
            return res.status(400).json({ success: false, message: "Only one answer is allowed" });
        }

        const valid = await client.query(
            `SELECT id FROM chat_poll_options WHERE poll_id = $1 AND id = ANY($2::integer[])`,
            [poll.id, optionIds]
        );
        if (valid.rows.length !== optionIds.length) {
            return res.status(400).json({ success: false, message: "Invalid option" });
        }

        const existing = await client.query(
            `SELECT option_id FROM chat_poll_votes WHERE poll_id = $1 AND employee_id = $2`,
            [poll.id, employeeId]
        );
        const had = existing.rows.map((r) => r.option_id);
        const changed =
            had.length !== optionIds.length || had.some((id) => !optionIds.includes(id));
        if (had.length && changed && !poll.allow_vote_changes) {
            return res.status(403).json({ success: false, message: "Vote changes are not allowed in this poll" });
        }

        await client.query("BEGIN");
        started = true;
        // keep votes that stay selected (so their time doesn't reset), remove the rest, add new ones
        await client.query(
            `DELETE FROM chat_poll_votes
              WHERE poll_id = $1 AND employee_id = $2 AND NOT (option_id = ANY($3::integer[]))`,
            [poll.id, employeeId, optionIds]
        );
        for (const optionId of optionIds) {
            await client.query(
                `INSERT INTO chat_poll_votes (poll_id, option_id, employee_id)
                 VALUES ($1, $2, $3) ON CONFLICT (option_id, employee_id) DO NOTHING`,
                [poll.id, optionId, employeeId]
            );
        }
        await client.query("COMMIT");
        started = false;

        const holder = [{ id: messageId, message_type: "poll" }];
        await attachPolls(holder, employeeId, pool);
        return res.json({ success: true, poll: holder[0].poll });
    } catch (error) {
        if (started) await client.query("ROLLBACK");
        console.error("Vote poll error:", error);
        return res.status(500).json({ success: false, message: "Failed to vote" });
    } finally {
        client.release();
    }
}
