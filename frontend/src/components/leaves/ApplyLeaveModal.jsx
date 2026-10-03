// src/components/leaves/ApplyLeaveModal.jsx
import { useState, useMemo } from "react";
import { X, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";

const leaveTypes = [
    { code: "SL", label: "Sick Leave" },
    { code: "CL", label: "Casual Leave" },
    { code: "EL", label: "Earned Leave" },
    { code: "LWP", label: "Leave Without Pay" },
];

function countWorkingDays(from, to, isHalfDay) {
    if (!from || !to) return 0;
    const start = new Date(from);
    const end = new Date(to);
    if (end < start) return 0;

    let count = 0;
    let current = new Date(start);

    while (current <= end) {
        if (current.getDay() !== 0) {
            count += 1;
        }
        current.setDate(current.getDate() + 1);
    }

    return isHalfDay ? count * 0.5 : count;
}

function ApplyLeaveModal({ onClose, onSubmit, currentUser }) {
    const [leaveType, setLeaveType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [halfDay, setHalfDay] = useState(false);
    const [reason, setReason] = useState("");
    const [pulse, setPulse] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const totalDays = useMemo(() => {
        return countWorkingDays(fromDate, toDate, halfDay);
    }, [fromDate, toDate, halfDay]);

    const canSubmit = leaveType && fromDate && toDate && reason.trim() && totalDays > 0;

    function handleDateOrHalfDayChange(setter) {
        return (value) => {
            setter(value);
            setPulse(true);
            setTimeout(() => setPulse(false), 300);
        };
    }

    async function handleSubmit() {
        if (!canSubmit || submitting) return;

        try {
            setSubmitting(true);

            const res = await fetch("/api/leaves", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employee_id: currentUser.id,
                    leave_type: leaveType,
                    start_date: fromDate,
                    end_date: toDate,
                    is_half_day: halfDay,
                    reason: reason.trim(),
                }),
            });

            const data = await res.json();

            if (res.status === 409) {
                toast.error(data.message || "You already have a leave for these dates");
                return;
            }

            if (!data.success) {
                toast.error(data.message || "Failed to apply leave");
                return;
            }

            // Shape matches what Leaves.jsx / LeaveRequestsPanel already expect.
            // Using the local fromDate/toDate strings directly (not the server's
            // returned timestamps) avoids the timezone-shift issue we saw in Postman.
            onSubmit({
                id: data.leave.id,
                type: leaveType,
                from: fromDate,
                to: toDate,
                days: parseFloat(data.leave.total_days),
                reason: reason.trim(),
                status: data.leave.status,
            });

            toast.success("Leave applied successfully");
            onClose();
        } catch (err) {
            console.error("applyLeave error:", err);
            toast.error("Could not connect to server");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-[fadeIn_0.15s_ease-out]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-[scaleIn_0.2s_ease-out]">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900">Apply Leave</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Leave Type */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">*</span> Leave Type
                        </label>
                        <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                        >
                            <option value="">Select a leave type</option>
                            {leaveTypes.map((t) => (
                                <option key={t.code} value={t.code}>
                                    {t.label} ({t.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">*</span> Date Range
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => handleDateOrHalfDayChange(setFromDate)(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => handleDateOrHalfDayChange(setToDate)(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Half day toggle */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">Half day only</label>
                        <select
                            value={halfDay ? "half" : "full"}
                            onChange={(e) => handleDateOrHalfDayChange(setHalfDay)(e.target.value === "half")}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                        >
                            <option value="full">Full day</option>
                            <option value="half">Half day (0.5)</option>
                        </select>
                    </div>

                    {/* Total days */}
                    <div
                        className={`flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 transition-transform duration-300 ${
                            pulse ? "scale-[1.02]" : "scale-100"
                        }`}
                    >
                        <CalendarDays size={16} className="text-green-600" />
                        <span className="text-sm font-semibold text-gray-800">
                            Total days: <span className="text-green-600">{totalDays}</span>
                        </span>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">*</span> Reason
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="Why do you need the leave?"
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors resize-none"
                        />
                    </div>

                    <p className="text-xs text-gray-400">
                        Sundays inside the range are skipped automatically. Select "Half day" for 0.5-day adjustments.
                    </p>
                </div>

                <div className="flex justify-end gap-3 mt-6">
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
                        {submitting ? "Submitting..." : "OK"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ApplyLeaveModal;