// src/components/dashboard/LeaveRequestsPanel.jsx
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { useOutletContext } from "react-router-dom";

function LeaveRequestsPanel() {
    const navigate = useNavigate();
    const { applications } = useOutletContext();

    // Show most recent 2 on Dashboard, same as before
    const recent = applications.slice(0, 2);

    // Leave Color Status Based
    const statusStyles = {
    Pending: "text-orange-600 bg-orange-50 border-orange-200",
    Approved: "text-green-600 bg-green-50 border-green-200",
    Rejected: "text-red-600 bg-red-50 border-red-200",
};

    return (
        <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-gray-900 font-semibold">
                    <FileText size={18} />
                    My Leave Requests
                </h2>
                <button
                    onClick={() => navigate("/leaves", { state: { openApply: true } })}
                    className="text-blue-600 text-sm font-medium hover:underline"
                >
                    Apply
                </button>
            </div>

            <div className="flex flex-col gap-3">
                {recent.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="border border-gray-300 rounded-md px-2 py-1 text-xs font-semibold text-gray-600">
                                {leave.type}
                            </span>
                            <span className="text-sm text-gray-700">
                                {leave.from === leave.to ? leave.from : `${leave.from} - ${leave.to}`}
                            </span>
                        </div>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyles[leave.status]}`}>
                                {leave.status}
                            </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LeaveRequestsPanel;