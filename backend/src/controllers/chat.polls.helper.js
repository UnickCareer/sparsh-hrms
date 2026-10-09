import pool from "../config/db.js";

// Adds a `poll` object (options, vote counts, voters, my selection) to every
// message whose message_type is 'poll'. Mutates and returns the same array.
export async function attachPolls(messages, viewerEmployeeId, client = pool) {
    const pollMessages = messages.filter((m) => m.message_type === "poll");
    if (!pollMessages.length) return messages;

    const ids = pollMessages.map((m) => Number(m.id));
    const viewerId = Number(viewerEmployeeId) || 0;

    const pollsResult = await client.query(
        `SELECT id, message_id, question, allow_multiple_answers, allow_vote_changes
           FROM chat_polls WHERE message_id = ANY($1::integer[])`,
        [ids]
    );
    const pollIds = pollsResult.rows.map((p) => p.id);
    if (!pollIds.length) return messages;

    const optionsResult = await client.query(
        `SELECT id, poll_id, option_text FROM chat_poll_options
          WHERE poll_id = ANY($1::integer[]) ORDER BY position, id`,
        [pollIds]
    );
    const votesResult = await client.query(
        `SELECT v.poll_id, v.option_id, v.employee_id, v.created_at AS voted_at,
                e.full_name, e.avatar
           FROM chat_poll_votes v
           JOIN employees e ON e.id = v.employee_id
          WHERE v.poll_id = ANY($1::integer[])
          ORDER BY v.created_at DESC, v.id DESC`,
        [pollIds]
    );

    const votesByOption = new Map();
    for (const v of votesResult.rows) {
        if (!votesByOption.has(v.option_id)) votesByOption.set(v.option_id, []);
        votesByOption.get(v.option_id).push({
            employee_id: v.employee_id,
            full_name: v.full_name,
            avatar: v.avatar,
            voted_at: v.voted_at,
        });
    }

    const pollByMessage = new Map();
    for (const p of pollsResult.rows) {
        pollByMessage.set(p.message_id, {
            id: p.id,
            question: p.question,
            allowMultipleAnswers: p.allow_multiple_answers,
            allowVoteChanges: p.allow_vote_changes,
            options: optionsResult.rows
                .filter((o) => o.poll_id === p.id)
                .map((o) => {
                    const voters = votesByOption.get(o.id) || [];
                    return {
                        id: o.id,
                        optionText: o.option_text,
                        voteCount: voters.length,
                        selected: voters.some((v) => Number(v.employee_id) === viewerId),
                        voters,
                    };
                }),
        });
    }

    for (const m of pollMessages) m.poll = pollByMessage.get(Number(m.id)) || null;
    return messages;
}
