// frontend/src/components/chat/poll/PollComposer.jsx
//
// "Create poll" dialog. Adds, on top of the existing form:
//  - "=" drag handle on every option (drag to reorder)
//  - emoji button on the question and on every option

import { useState } from "react";
import { createPortal } from "react-dom";
import { Equal, Smile, X } from "lucide-react";

const MAX_OPTIONS = 12;

export default function PollComposer({
    question, setQuestion,
    options, setOptions,
    allowMultiple, setAllowMultiple,
    allowVoteChanges, setAllowVoteChanges,
    busy, onSubmit, onClose,
    EmojiPicker = null,
}) {
    const [picker, setPicker] = useState(null); // "question" | option index
    const [dragFrom, setDragFrom] = useState(null);
    const [dragOver, setDragOver] = useState(null);

    const insertEmoji = (emoji) => {
        if (picker === "question") setQuestion((v) => `${v}${emoji}`);
        else setOptions((prev) => prev.map((v, i) => (i === picker ? `${v}${emoji}` : v)));
    };

    const drop = (to) => {
        if (dragFrom === null || dragFrom === to) return;
        setOptions((prev) => {
            const next = [...prev];
            const [moved] = next.splice(dragFrom, 1);
            next.splice(to, 0, moved);
            return next;
        });
    };

    const EmojiButton = ({ target }) =>
        EmojiPicker ? (
            <button
                type="button"
                onClick={() => setPicker((cur) => (cur === target ? null : target))}
                aria-label="Add emoji"
                className={`shrink-0 rounded-xl p-2 transition ${
                    picker === target ? "bg-orange-50 text-orange-500" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                }`}
            >
                <Smile size={18} />
            </button>
        ) : null;

    const pickerBox = (target) =>
        EmojiPicker && picker === target ? (
            <div className="absolute right-0 top-full z-20 mt-1">
                <EmojiPicker onSelect={insertEmoji} onClose={() => setPicker(null)} />
            </div>
        ) : null;

    return createPortal(
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-chat-fade" data-chat-overlay-root>
            <div className="w-full max-w-[520px] rounded-[28px] bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Create poll</h3>
                        <p className="mt-1 text-xs text-gray-400">Ask the group a question and collect votes.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 py-5">
                    <div className="relative flex items-center gap-1">
                        <input
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Question"
                            maxLength={255}
                            autoFocus
                            className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300"
                        />
                        <EmojiButton target="question" />
                        {pickerBox("question")}
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-semibold text-gray-500">Options</p>
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div
                                    key={index}
                                    draggable
                                    onDragStart={() => setDragFrom(index)}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(index);
                                    }}
                                    onDrop={() => drop(index)}
                                    onDragEnd={() => {
                                        setDragFrom(null);
                                        setDragOver(null);
                                    }}
                                    className={`relative flex items-center gap-1 rounded-2xl transition ${
                                        dragOver === index && dragFrom !== null && dragFrom !== index
                                            ? "bg-orange-50 ring-2 ring-orange-200"
                                            : ""
                                    } ${dragFrom === index ? "opacity-50" : ""}`}
                                >
                                    <input
                                        value={option}
                                        onChange={(e) =>
                                            setOptions((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
                                        }
                                        placeholder={`Option ${index + 1}`}
                                        maxLength={100}
                                        draggable={false}
                                        className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300"
                                    />
                                    <EmojiButton target={index} />
                                    {options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                                            aria-label="Remove option"
                                            className="shrink-0 rounded-xl p-2 text-gray-400 hover:bg-gray-100"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <span
                                        title="Drag to reorder"
                                        className="shrink-0 cursor-grab touch-none rounded-xl p-2 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
                                    >
                                        <Equal size={18} />
                                    </span>
                                    {pickerBox(index)}
                                </div>
                            ))}
                        </div>
                    </div>

                    {options.length < MAX_OPTIONS && (
                        <button
                            type="button"
                            onClick={() => setOptions((prev) => [...prev, ""])}
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                        >
                            + Add option
                        </button>
                    )}

                    <label className="flex items-center gap-3 text-sm text-gray-700">
                        <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="h-4 w-4 accent-orange-500" />
                        Allow multiple answers
                    </label>
                    <label className="flex items-center gap-3 text-sm text-gray-700">
                        <input type="checkbox" checked={allowVoteChanges} onChange={(e) => setAllowVoteChanges(e.target.checked)} className="h-4 w-4 accent-orange-500" />
                        Allow vote changes
                    </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
                    <button type="button" onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100">
                        Cancel
                    </button>
                    <button type="button" disabled={busy} onClick={onSubmit} className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                        {busy ? "Sending…" : "Send poll"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
