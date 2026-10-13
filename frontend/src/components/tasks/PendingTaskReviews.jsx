/**
 * PendingTaskReviews.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/tasks/PendingTaskReviews.jsx
import { useState, useEffect } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

function PendingTaskReviews({ currentUser, onDecisionMade }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actingId, setActingId] = useState(null);
    const [reworkNoteFor, setReworkNoteFor] = useState(null);
    const [reworkNote, setReworkNote] = useState("");

    useEffect(() => {
        fetchPendingReviews();
    }, []);

    async function fetchPendingReviews() {
        try {
            setLoading(true);
            const res = await fetch("/api/tasks/pending-review");
            const data = await res.json();
            if (data.success) {
                setAssignments(data.assignments);
            } else {
                toast.error("Failed to load pending reviews");
            }
        } catch (err) {
            console.error("fetchPendingReviews error:", err);
            toast.error("Could not connect to server");
        } finally {
            setLoading(false);
        }
    }

    async function handleDecision(assignmentId, decision, note) {
        try {
            setActingId(assignmentId);
            const res = await fetch(`/api/tasks/assignments/${assignmentId}/review`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    decision,
                    reviewed_by: currentUser.id,
                    review_note: note || null,
                }),
            });
            const data = await res.json();

            if (!data.success) {
                toast.error(data.message || "Failed to update task");
                return;
            }

            setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
            toast.success(decision === "Approved" ? "Approved" : "Sent back for rework");
            setReworkNoteFor(null);
            setReworkNote("");
            if (onDecisionMade) onDecisionMade();
        } catch (err) {
            console.error("handleDecision error:", err);
            toast.error("Could not connect to server");
        } finally {
            setActingId(null);
        }
    }

    if (loading) {
        return <p className="text-gray-400 text-sm py-8 text-center">Loading pending reviews...</p>;
    }

    if (assignments.length === 0) {
        return <p className="text-gray-400 text-sm py-8 text-center">No submissions awaiting review.</p>;
    }

    return (
        <div className="flex flex-col gap-4">
            {assignments.map((a) => (
                <div key={a.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">{a.task_title}</p>
                            <p className="text-xs text-gray-400">
                                {a.employee_name} · {a.category} · Assigned by {a.created_by_name}
                            </p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 whitespace-nowrap">
                            Awaiting Review
                        </span>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Submission report:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.submission_report}</p>
                    </div>

                    {reworkNoteFor === a.id ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={reworkNote}
                                onChange={(e) => setReworkNote(e.target.value)}
                                rows={2}
                                placeholder="What needs to change?"
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors resize-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setReworkNoteFor(null); setReworkNote(""); }}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDecision(a.id, "Rework", reworkNote)}
                                    disabled={!reworkNote.trim() || actingId === a.id}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
                                >
                                    Send Back
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleDecision(a.id, "Approved")}
                                disabled={actingId === a.id}
                                className="flex items-center gap-1 bg-green-50 text-green-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40"
                            >
                                <CheckCircle2 size={14} />
                                Approve
                            </button>
                            <button
                                onClick={() => setReworkNoteFor(a.id)}
                                disabled={actingId === a.id}
                                className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
                            >
                                <RotateCcw size={14} />
                                Send Back
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default PendingTaskReviews;