/**
 * PollMessage.jsx
 *
 * Frontend component/module for HRMS application
 */

// frontend/src/components/chat/poll/PollMessage.jsx
//
// Poll inside a chat bubble (WhatsApp style):
//  - round tick, option text, up to 3 voter avatars + total vote count on the right
//  - slow, smooth progress bars (relative to the most-voted option)
//  - "View votes" footer button (PollViewVotesButton) rendered under the time

import { useEffect, useState } from "react";
import { CheckCheck, Check } from "lucide-react";
import toast from "react-hot-toast";
import { PollAvatar, fetchPollVoters, hasVoterData, mergeVoters, votersOf } from "./pollUtils";

export default function PollMessage({ message, currentId, own, onPollUpdated }) {
    const poll = message.poll;
    const options = poll?.options || [];
    const [busy, setBusy] = useState(false);
    const [mounted, setMounted] = useState(false);

    // start bars at 0 so they animate in on first render
    useEffect(() => {
        const frame = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
        return () => cancelAnimationFrame(frame);
    }, []);

    if (!poll) return null;

    const multiple = Boolean(poll.allowMultipleAnswers);
    const selectedIds = options.filter((o) => o.selected).map((o) => Number(o.id));
    const maxVotes = Math.max(1, ...options.map((o) => Number(o.voteCount || 0)));

    const vote = async (option) => {
        const id = Number(option.id);
        const isSelected = selectedIds.includes(id);
        if (busy) return;
        if (!multiple && isSelected) return;
        if (poll.allowVoteChanges === false && selectedIds.length) {
            toast("Votes can't be changed in this poll", { icon: "ℹ️" });
            return;
        }

        const next = multiple
            ? isSelected
                ? selectedIds.filter((x) => x !== id)
                : [...selectedIds, id]
            : [id];
        if (!next.length) return;

        // optimistic update so the bars start moving immediately
        const previous = poll;
        onPollUpdated?.(message.id, {
            ...poll,
            options: options.map((o) => {
                const was = selectedIds.includes(Number(o.id));
                const now = next.includes(Number(o.id));
                return {
                    ...o,
                    selected: now,
                    voteCount: Number(o.voteCount || 0) + (now && !was ? 1 : 0) - (!now && was ? 1 : 0),
                };
            }),
        });

        try {
            setBusy(true);
            const response = await fetch(`/api/chat/messages/${message.id}/poll-vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: currentId, optionIds: next }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to vote");

            let updated = data.poll;
            // the vote endpoint may not return voter lists - fetch them separately
            if (!hasVoterData(updated)) {
                try {
                    updated = mergeVoters(updated, await fetchPollVoters(message.id, currentId));
                } catch {
                    /* avatars are optional */
                }
            }
            onPollUpdated?.(message.id, updated);
        } catch (error) {
            onPollUpdated?.(message.id, previous);
            toast.error(error.message);
        } finally {
            setBusy(false);
        }
    };

    const tick = (selected) =>
        selected
            ? own
                ? "border-white bg-white text-orange-500"
                : "border-emerald-500 bg-emerald-500 text-white"
            : own
              ? "border-white/70"
              : "border-gray-300";

    return (
        <div className="mb-1 w-[290px] max-w-full mt-1 mr-1">
            <p className="break-words text-[15px] font-semibold leading-snug">{poll.question}</p>

            <p className={`mt-1 flex items-center gap-1 text-[11px] ${own ? "text-white/75" : "text-gray-500"}`}>
                <CheckCheck size={13} />
                {multiple ? "Select one or more" : "Select one"}
            </p>

            <div className="mt-3 space-y-3.5">
                {options.map((option) => {
                    const selected = selectedIds.includes(Number(option.id));
                    const count = Number(option.voteCount || 0);
                    const voters = votersOf(option);
                    const percent = mounted ? Math.round((count / maxVotes) * 100) : 0;

                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => vote(option)}
                            className="block w-full text-left"
                        >
                            <span className="flex items-center gap-2.5">
                                <span
                                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${tick(selected)}`}
                                >
                                    {selected && <Check size={13} strokeWidth={3.5} />}
                                </span>

                                <span className="min-w-0 flex-1 break-words text-sm">{option.optionText}</span>

                                <span className="flex shrink-0 items-center gap-1.5">
                                    {voters.length > 0 && (
                                        <span className="flex -space-x-1.5">
                                            {voters.slice(0, 3).map((v) => (
                                                <PollAvatar
                                                    key={v.employee_id}
                                                    name={v.full_name}
                                                    avatar={v.avatar}
                                                    size={20}
                                                />
                                            ))}
                                        </span>
                                    )}
                                    <span className="min-w-[10px] text-right text-xs tabular-nums opacity-80">
                                        {count}
                                    </span>
                                </span>
                            </span>

                            <span className="ml-8 mt-1.5 block h-[5px] overflow-hidden rounded-full bg-current/15">
                                <span
                                    className={`block h-full rounded-full transition-[width] duration-1000 ease-out ${
                                        own ? "bg-white" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${count ? Math.max(percent, 4) : 0}%` }}
                                />
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function PollViewVotesButton({ onClick, own }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`-mx-3 -mb-3 mt-1.5 block w-[calc(100%+1.5rem)] rounded-b-[14px] border-t py-2.5 text-center text-sm font-semibold transition ${
                own
                    ? "border-white/20 text-white hover:bg-white/10"
                    : "border-gray-100 text-emerald-600 hover:bg-gray-50"
            }`}
        >
            View votes
        </button>
    );
}