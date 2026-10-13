/**
 * PollVotesPanel.jsx
 *
 * Frontend component/module for HRMS application
 */

// frontend/src/components/chat/poll/PollVotesPanel.jsx
//
// Right-hand "View votes" panel. One header per option with a single chip showing
// that option's total votes; the chip gets a star when the poll CREATOR voted for it.
// Voters are listed under the option they chose (so Yes / No voters are separated).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Star, X } from "lucide-react";
import { PollAvatar, fetchPollVoters, formatVoteTime, hasVoterData, mergeVoters, votersOf } from "./pollUtils";

export default function PollVotesPanel({ message, currentId, onPollUpdated, onClose, boundaryRef = null }) {
    const poll = message?.poll;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!poll || hasVoterData(poll)) return;
        let cancelled = false;
        setLoading(true);
        fetchPollVoters(message.id, currentId)
            .then((options) => !cancelled && onPollUpdated?.(message.id, mergeVoters(poll, options)))
            .catch((e) => !cancelled && setError(e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message?.id]);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!poll) return null;
    const creatorId = Number(message.sender_employee_id);

    const portalTarget = boundaryRef?.current || document.body;

    return createPortal(
        <aside
            data-chat-overlay-root
            className="absolute inset-y-0 right-0 z-[240] flex w-full max-w-[460px] flex-col border-l border-gray-200 bg-white shadow-2xl animate-chat-slide"
        >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Poll votes</p>
                    <h3 className="mt-1 break-words text-lg font-semibold text-gray-900">{poll.question}</h3>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                    <X size={19} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 chat-scrollbar">
                {loading && (
                    <div className="flex items-center gap-2 py-6 text-xs text-gray-500">
                        <Loader2 size={15} className="animate-spin" /> Loading votes...
                    </div>
                )}
                {error && <p className="py-4 text-xs text-red-500">{error}</p>}

                {(poll.options || []).map((option) => {
                    const voters = votersOf(option).sort(
                        (a, b) => new Date(b.voted_at || 0) - new Date(a.voted_at || 0)
                    );
                    const total = Number(option.voteCount ?? voters.length);
                    const creatorVoted = voters.some((v) => v.employee_id === creatorId);

                    return (
                        <section key={option.id} className="mb-6">
                            <div className="flex items-center justify-between gap-3">
                                <h4 className="min-w-0 break-words text-[15px] font-semibold text-gray-900">
                                    {option.optionText}
                                </h4>
                                <span
                                    className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                                        creatorVoted
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-gray-100 text-gray-600"
                                    }`}
                                    title={creatorVoted ? "Includes the poll creator's vote" : undefined}
                                >
                                    {total} {total === 1 ? "vote" : "votes"}
                                    {creatorVoted && <Star size={11} fill="currentColor" />}
                                </span>
                            </div>

                            <div className="mt-2 space-y-1">
                                {voters.map((v) => (
                                    <div key={v.employee_id} className="flex items-center gap-3 rounded-xl py-2">
                                        <PollAvatar name={v.full_name} avatar={v.avatar} size={40} />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-gray-800">
                                                {v.employee_id === Number(currentId) ? "You" : v.full_name}
                                            </p>
                                            <p className="text-xs text-gray-400">{formatVoteTime(v.voted_at)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </aside>,
        portalTarget
    );
}
