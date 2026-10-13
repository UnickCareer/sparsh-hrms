/**
 * chat.realtime.js
 *
 * Backend module for HRMS application
 */

// backend/src/realtime/chat.realtime.js
//
// Lightweight Server-Sent Events (SSE) hub for chat.
// It requires no additional npm dependency and gives the Chat UI
// server-pushed message/typing events.

import pool from "../config/db.js";

const subscribers = new Map();

function addSubscriber(employeeId, response) {
    const key = String(employeeId);
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }
    subscribers.get(key).add(response);
}

function removeSubscriber(employeeId, response) {
    const key = String(employeeId);
    const set = subscribers.get(key);
    if (!set) return;
    set.delete(response);
    if (set.size === 0) subscribers.delete(key);
}

export function subscribeEmployee(employeeId, response) {
    addSubscriber(employeeId, response);

    const heartbeat = setInterval(() => {
        try {
            response.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
            clearInterval(heartbeat);
            removeSubscriber(employeeId, response);
        }
    }, 25000);

    return () => {
        clearInterval(heartbeat);
        removeSubscriber(employeeId, response);
    };
}

export function publishToEmployees(employeeIds, payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;

    for (const employeeId of employeeIds) {
        const set = subscribers.get(String(employeeId));
        if (!set) continue;

        for (const response of set) {
            try {
                response.write(data);
            } catch {
                removeSubscriber(employeeId, response);
            }
        }
    }
}

export async function publishToConversation(
    conversationId,
    payload,
    { excludeEmployeeIds = [] } = {}
) {
    const result = await pool.query(
        `
        SELECT employee_id
        FROM chat_participants
        WHERE conversation_id = $1
          AND participant_status = 'active'
        `,
        [conversationId]
    );

    const excluded = new Set(
        excludeEmployeeIds.map((id) => String(id))
    );

    publishToEmployees(
        result.rows
            .map((row) => row.employee_id)
            .filter((id) => !excluded.has(String(id))),
        payload
    );
}
