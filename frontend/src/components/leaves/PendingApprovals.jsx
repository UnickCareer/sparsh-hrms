/**
 * PendingApprovals.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/leaves/PendingApprovals.jsx
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

function PendingApprovals({ currentUser, onDecisionMade }) {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actingId, setActingId] = useState(null); // disables buttons on the row being acted on

    useEffect(() => {
        fetchAllLeaves();
    }, []);

    async function fetchAllLeaves() {
        try {
            setLoading(true);
            const res = await fetch("/api/leaves");
            const data = await res.json();
            if (data.success) {
                setLeaves(data.leaves.filter((l) => l.status === "Pending"));
            } else {
                toast.error("Failed to load pending leaves");
            }
        } catch (err) {
            console.error("fetchAllLeaves error:", err);
            toast.error("Could not connect to server");
        } finally {
            setLoading(false);
        }
    }

    async function handleDecision(leaveId, status) {
        try {
            setActingId(leaveId);
            const res = await fetch(`/api/leaves/${leaveId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, approved_by: currentUser.id }),
            });
            const data = await res.json();

            if (!data.success) {
                toast.error(data.message || "Failed to update leave");
                return;
            }

            // Remove it from the pending list — it's been decided
            setLeaves((prev) => prev.filter((l) => l.id !== leaveId));
            toast.success(`Leave ${status.toLowerCase()}`);

            // Let DashboardLayout know so the bell/tab badge count updates immediately
            if (onDecisionMade) onDecisionMade();
        } catch (err) {
            console.error("handleDecision error:", err);
            toast.error("Could not connect to server");
        } finally {
            setActingId(null);
        }
    }

    if (loading) {
        return <p className="text-gray-400 text-sm py-8 text-center">Loading pending approvals...</p>;
    }

    if (leaves.length === 0) {
        return <p className="text-gray-400 text-sm py-8 text-center">No pending leave requests.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                        <th className="py-2 pr-4 font-medium">Employee</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 font-medium">Period</th>
                        <th className="py-2 pr-4 font-medium">Reason</th>
                        <th className="py-2 pr-4 font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {leaves.map((leave) => (
                        <tr key={leave.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4">
                                <div className="text-gray-800 font-medium">{leave.full_name}</div>
                                <div className="text-xs text-gray-400">{leave.department}</div>
                            </td>
                            <td className="py-3 pr-4">
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-1 rounded-md">
                                    {leave.leave_type}
                                </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                                {formatDateLabel(leave.start_date)}
                                {leave.start_date !== leave.end_date && ` - ${formatDateLabel(leave.end_date)}`}
                                <div className="text-xs text-gray-400">
                                    {leave.total_days} day{parseFloat(leave.total_days) !== 1 ? "s" : ""}
                                </div>
                            </td>
                            <td className="py-3 pr-4 text-gray-600 max-w-xs truncate">{leave.reason}</td>
                            <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDecision(leave.id, "Approved")}
                                        disabled={actingId === leave.id}
                                        className="flex items-center gap-1 bg-green-50 text-green-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-40"
                                    >
                                        <CheckCircle2 size={14} />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleDecision(leave.id, "Rejected")}
                                        disabled={actingId === leave.id}
                                        className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
                                    >
                                        <XCircle size={14} />
                                        Reject
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default PendingApprovals;