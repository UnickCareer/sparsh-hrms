/**
 * SubmitReportModal.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/tasks/SubmitReportModal.jsx
import { useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

// assignment: { assignmentId, taskTitle, status, reviewNote }
function SubmitReportModal({ assignment, onClose, onSubmitted }) {
    const [report, setReport] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = report.trim().length > 0;

    async function handleSubmit() {
        if (!canSubmit || submitting) return;

        try {
            setSubmitting(true);
            const res = await fetch(`/api/tasks/assignments/${assignment.assignmentId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submission_report: report.trim() }),
            });
            const data = await res.json();

            if (!data.success) {
                toast.error(data.message || "Failed to submit report");
                return;
            }

            toast.success("Report submitted for review");
            onSubmitted();
            onClose();
        } catch (err) {
            console.error("submitAssignment error:", err);
            toast.error("Could not connect to server");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-scaleIn">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Submit Your Report</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-3">
                    Task: <span className="font-medium text-gray-800">{assignment.taskTitle}</span>
                </p>

                {assignment.reviewNote && assignment.status === "Needs Rework" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-red-700 mb-1">Admin requested changes:</p>
                        <p className="text-sm text-red-600">{assignment.reviewNote}</p>
                    </div>
                )}

                <label className="text-sm font-medium text-gray-700">
                    <span className="text-red-500">*</span> Your Report
                </label>
                <textarea
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                    rows={6}
                    placeholder="Describe what you completed. Include any links (GitHub repo, Drive folder, deployed URL, etc.)..."
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors resize-none"
                />

                <div className="flex justify-end gap-3 mt-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Submitting..." : "Submit for Review"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SubmitReportModal;