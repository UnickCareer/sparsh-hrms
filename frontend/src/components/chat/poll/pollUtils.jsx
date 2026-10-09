// frontend/src/components/chat/poll/pollUtils.jsx

export function normVoter(v = {}) {
    return {
        employee_id: Number(v.employee_id ?? v.employeeId ?? v.id),
        full_name: v.full_name ?? v.fullName ?? v.name ?? "Employee",
        avatar: v.avatar ?? null,
        voted_at: v.voted_at ?? v.votedAt ?? v.created_at ?? null,
    };
}

export const votersOf = (option) =>
    Array.isArray(option?.voters) ? option.voters.map(normVoter) : [];

export const hasVoterData = (poll) =>
    (poll?.options || []).length > 0 &&
    (poll.options || []).every((option) => Array.isArray(option.voters));

export function formatVoteTime(value) {
    if (!value) return "";
    const date = new Date(value);
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return `Today at ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
    return `${date.toLocaleDateString([], { day: "2-digit", month: "short" })} at ${time}`;
}

/* Merge voter lists returned by GET /messages/:id/poll-votes into a poll */
export function mergeVoters(poll, optionsWithVoters = []) {
    const byId = new Map(optionsWithVoters.map((o) => [Number(o.id), o.voters || []]));
    return {
        ...poll,
        options: (poll.options || []).map((option) => ({
            ...option,
            voters: byId.has(Number(option.id)) ? byId.get(Number(option.id)) : option.voters,
        })),
    };
}

export async function fetchPollVoters(messageId, employeeId) {
    const response = await fetch(`/api/chat/messages/${messageId}/poll-votes?employeeId=${employeeId}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Failed to load votes");
    return data.options || [];
}

const PALETTE = ["bg-orange-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-rose-500", "bg-indigo-500"];

export function PollAvatar({ name = "", avatar, size = 20 }) {
    const initials =
        name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
    const color = PALETTE[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];
    const style = { width: size, height: size, fontSize: size * 0.42 };

    return avatar ? (
        <img
            src={avatar}
            alt={name}
            style={style}
            className="shrink-0 rounded-full object-cover ring-1 ring-black/10"
        />
    ) : (
        <span
            style={style}
            className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-black/10 ${color}`}
        >
            {initials}
        </span>
    );
}
