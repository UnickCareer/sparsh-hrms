/**
 * Leaves.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/Leaves.jsx
import { useState, useEffect } from "react";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { Search, CalendarDays, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";
import ApplyLeaveModal from "../components/leaves/ApplyLeaveModal.jsx";
import PendingApprovals from "../components/leaves/PendingApprovals";

const statusStyles = {
    Pending: "bg-orange-50 text-orange-600",
    Approved: "bg-green-50 text-green-600",
    Rejected: "bg-red-50 text-red-600",
    Cancelled: "bg-gray-100 text-gray-500",
};

function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

function StatCard({ label, value, icon: Icon, colorClass, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
                active ? "ring-2 ring-orange-400" : ""
            }`}
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass.bg}`}>
                <Icon size={18} className={colorClass.text} />
            </div>
            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-xl font-bold ${colorClass.text}`}>{value}</p>
            </div>
        </button>
    );
}

function Leaves() {
    const { applications, setApplications, currentUser, pendingLeavesCount, refreshPendingLeavesCount } = useOutletContext();
    const location = useLocation();
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState("applications"); // "applications" | "approvals"

    // Auto-open modal if navigated here with that intent (e.g. from Dashboard's Apply button)
    useEffect(() => {
        if (location.state?.openApply) {
            setShowModal(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
        if (location.state?.openApprovals && currentUser.role === "admin") {
            setActiveTab("approvals");
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state]);

    const filtered = applications.filter((app) => {
        const matchesSearch =
            app.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.reason.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "All" || app.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const total = applications.length;
    const pending = applications.filter((a) => a.status === "Pending").length;
    const approved = applications.filter((a) => a.status === "Approved").length;
    const rejected = applications.filter((a) => a.status === "Rejected").length;

    function handleNewApplication(newApp) {
        setApplications((prev) => [newApp, ...prev]);
    }

    function handleStatCardClick(status) {
        setStatusFilter((prev) => (prev === status ? "All" : status));
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Leave Management</h1>

            <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab("applications")}
                    className={`font-medium text-sm pb-3 border-b-2 transition-colors ${
                        activeTab === "applications"
                            ? "text-orange-600 border-orange-500"
                            : "text-gray-400 border-transparent"
                    }`}
                >
                    Applications
                </button>
                {currentUser.role === "admin" && (
                    <button
                        onClick={() => setActiveTab("approvals")}
                        className={`flex items-center gap-1.5 font-medium text-sm pb-3 border-b-2 transition-colors ${
                            activeTab === "approvals"
                                ? "text-orange-600 border-orange-500"
                                : "text-gray-400 border-transparent"
                        }`}
                    >
                        Approvals
                        {pendingLeavesCount > 0 && (
                            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                                {pendingLeavesCount > 9 ? "9+" : pendingLeavesCount}
                            </span>
                        )}
                    </button>
                )}
                <button className="text-gray-400 font-medium text-sm pb-3 cursor-not-allowed">
                    WFH
                </button>
                <button className="text-gray-400 font-medium text-sm pb-3 cursor-not-allowed">
                    Comp Off
                </button>
            </div>

            {activeTab === "applications" && (
                <div className="bg-white rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Leave Applications</h2>
                            <p className="text-gray-400 text-sm">Your leave applications</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search type or reason..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors w-full sm:w-56"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none"
                            >
                                <option value="All">All statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>

                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                            >
                                <Plus size={16} />
                                Apply Leave
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            label="Total"
                            value={total}
                            icon={CalendarDays}
                            colorClass={{ bg: "bg-blue-50", text: "text-blue-600" }}
                            active={statusFilter === "All"}
                            onClick={() => setStatusFilter("All")}
                        />
                        <StatCard
                            label="Pending"
                            value={pending}
                            icon={Clock}
                            colorClass={{ bg: "bg-orange-50", text: "text-orange-600" }}
                            active={statusFilter === "Pending"}
                            onClick={() => handleStatCardClick("Pending")}
                        />
                        <StatCard
                            label="Approved"
                            value={approved}
                            icon={CheckCircle2}
                            colorClass={{ bg: "bg-green-50", text: "text-green-600" }}
                            active={statusFilter === "Approved"}
                            onClick={() => handleStatCardClick("Approved")}
                        />
                        <StatCard
                            label="Rejected"
                            value={rejected}
                            icon={XCircle}
                            colorClass={{ bg: "bg-red-50", text: "text-red-600" }}
                            active={statusFilter === "Rejected"}
                            onClick={() => handleStatCardClick("Rejected")}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                    <th className="py-2 pr-4 font-medium">Type</th>
                                    <th className="py-2 pr-4 font-medium">Period</th>
                                    <th className="py-2 pr-4 font-medium">Reason</th>
                                    <th className="py-2 pr-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((app) => (
                                    <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="py-3 pr-4">
                                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-1 rounded-md">
                                                {app.type}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4 text-gray-700">
                                            {formatDateLabel(app.from)}
                                            {app.from !== app.to && ` - ${formatDateLabel(app.to)}`}
                                            <div className="text-xs text-gray-400">{app.days} day{app.days !== 1 ? "s" : ""}</div>
                                        </td>
                                        <td className="py-3 pr-4 text-gray-600 max-w-xs truncate">{app.reason}</td>
                                        <td className="py-3 pr-4">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[app.status]}`}>
                                                {app.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400">
                                            No leave applications found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === "approvals" && currentUser.role === "admin" && (
                <div className="bg-white rounded-xl p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Pending Approvals</h2>
                    <p className="text-gray-400 text-sm mb-5">Review and act on employee leave requests</p>
                    <PendingApprovals currentUser={currentUser} onDecisionMade={refreshPendingLeavesCount} />
                </div>
            )}

            {showModal && (
                <ApplyLeaveModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleNewApplication}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
}

export default Leaves;