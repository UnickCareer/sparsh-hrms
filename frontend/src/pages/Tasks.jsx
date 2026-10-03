// src/pages/Tasks.jsx
import { useState, useEffect } from "react";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { Search, Plus, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import NewTaskModal from "../components/tasks/NewTaskModal";
import SubmitReportModal from "../components/tasks/SubmitReportModal";
import PendingTaskReviews from "../components/tasks/PendingTaskReviews";

const priorityStyles = {
    Low: "bg-gray-100 text-gray-600",
    Medium: "bg-blue-50 text-blue-600",
    High: "bg-red-50 text-red-600",
};

const taskStatusStyles = {
    "Not Started": "bg-gray-100 text-gray-600",
    "In Progress": "bg-orange-50 text-orange-600",
    Completed: "bg-green-50 text-green-600",
};

const assigneeStatusStyles = {
    "Not Started": "bg-gray-100 text-gray-500",
    "In Progress": "bg-orange-50 text-orange-600",
    Submitted: "bg-blue-50 text-blue-600",
    "Needs Rework": "bg-red-50 text-red-600",
    Approved: "bg-green-50 text-green-600",
};

function TaskCategoryChip({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 hover:scale-105 whitespace-nowrap ${
                active
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600"
            }`}
        >
            {label}
        </button>
    );
}

function ProgressBar({ percent }) {
    return (
        <div className="flex items-center gap-2 min-w-[90px]">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs font-medium text-gray-500 w-8 text-right">{percent}%</span>
        </div>
    );
}

function Tasks() {
    const { tasks, currentUser, refreshMyTasks, refreshPendingTaskReviews } = useOutletContext();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("mytasks"); // "mytasks" | "reviews"
    const [activeCategory, setActiveCategory] = useState("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [showModal, setShowModal] = useState(false);
    const [submittingAssignment, setSubmittingAssignment] = useState(null);

    useEffect(() => {
        if (location.state?.openReviews && currentUser.role === "admin") {
            setActiveTab("reviews");
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state]);

    function handleDecisionMade() {
        refreshMyTasks();
        if (refreshPendingTaskReviews) refreshPendingTaskReviews();
    }

    const categories = ["All", ...new Set(tasks.map((t) => t.category))];

    const filtered = tasks.filter((t) => {
        const matchesCategory = activeCategory === "All" || t.category === activeCategory;
        const matchesSearch =
            t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.assignments.some((a) => a.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "All" || t.status === statusFilter;
        const matchesPriority = priorityFilter === "All" || t.priority === priorityFilter;
        return matchesCategory && matchesSearch && matchesStatus && matchesPriority;
    });

    async function handleStart(assignmentId) {
        try {
            const res = await fetch(`/api/tasks/assignments/${assignmentId}/status`, {
                method: "PATCH",
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.message || "Failed to start task");
                return;
            }
            toast.success("Task started");
            refreshMyTasks();
        } catch (err) {
            console.error("handleStart error:", err);
            toast.error("Could not connect to server");
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus size={16} />
                    New Task
                </button>
            </div>

            <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab("mytasks")}
                    className={`font-medium text-sm pb-3 border-b-2 transition-colors ${
                        activeTab === "mytasks"
                            ? "text-orange-600 border-orange-500"
                            : "text-gray-400 border-transparent"
                    }`}
                >
                    My Tasks
                </button>
                {currentUser.role === "admin" && (
                    <button
                        onClick={() => setActiveTab("reviews")}
                        className={`font-medium text-sm pb-3 border-b-2 transition-colors ${
                            activeTab === "reviews"
                                ? "text-orange-600 border-orange-500"
                                : "text-gray-400 border-transparent"
                        }`}
                    >
                        Review Submissions
                    </button>
                )}
            </div>

            {activeTab === "mytasks" && (
                <>
                    <div className="flex flex-wrap gap-2 mb-5">
                        {categories.map((cat) => (
                            <TaskCategoryChip
                                key={cat}
                                label={cat}
                                active={activeCategory === cat}
                                onClick={() => setActiveCategory(cat)}
                            />
                        ))}
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search title, assignee, category..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none"
                        >
                            <option value="All">Status</option>
                            <option value="Not Started">Not Started</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none"
                        >
                            <option value="All">Priority</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-3">
                        {filtered.map((task) => {
                            const myAssignment = task.assignments.find((a) => a.employee_id === currentUser.id);

                            return (
                                <div key={task.id} className="bg-white rounded-xl shadow-sm p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                                            <p className="text-xs text-gray-400">
                                                {task.category} · Assigned by <span className="font-medium">{task.createdByName}</span>
                                                {task.end && ` · Due ${task.end}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priorityStyles[task.priority]}`}>
                                                {task.priority}
                                            </span>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${taskStatusStyles[task.status]}`}>
                                                {task.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <ProgressBar percent={task.progressPercent} />
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {task.assignments.map((a) => (
                                            <span
                                                key={a.assignment_id}
                                                className={`text-xs font-medium px-2.5 py-1 rounded-full ${assigneeStatusStyles[a.status]}`}
                                            >
                                                {a.full_name}: {a.status}
                                            </span>
                                        ))}
                                    </div>

                                    {myAssignment && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                            {myAssignment.status === "Not Started" && (
                                                <button
                                                    onClick={() => handleStart(myAssignment.assignment_id)}
                                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                                                >
                                                    Start My Part
                                                </button>
                                            )}
                                            {(myAssignment.status === "In Progress" || myAssignment.status === "Needs Rework") && (
                                                <button
                                                    onClick={() =>
                                                        setSubmittingAssignment({
                                                            assignmentId: myAssignment.assignment_id,
                                                            taskTitle: task.title,
                                                            status: myAssignment.status,
                                                            reviewNote: myAssignment.review_note,
                                                        })
                                                    }
                                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                                >
                                                    Submit My Report
                                                </button>
                                            )}
                                            {myAssignment.status === "Submitted" && (
                                                <span className="text-xs text-gray-400">Your submission is awaiting review</span>
                                            )}
                                            {myAssignment.status === "Approved" && (
                                                <span className="text-xs text-green-600 font-medium">✓ Your part is approved</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {filtered.length === 0 && (
                            <div className="bg-white rounded-xl shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
                                <Inbox size={32} className="mb-2" />
                                <p className="text-sm">No tasks found.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === "reviews" && currentUser.role === "admin" && (
                <div className="bg-white rounded-xl p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Review Submissions</h2>
                    <p className="text-gray-400 text-sm mb-5">Approve each person's work or send it back for changes</p>
                    <PendingTaskReviews currentUser={currentUser} onDecisionMade={handleDecisionMade} />
                </div>
            )}

            {showModal && (
                <NewTaskModal
                    onClose={() => setShowModal(false)}
                    onCreate={refreshMyTasks}
                    currentUser={currentUser}
                />
            )}

            {submittingAssignment && (
                <SubmitReportModal
                    assignment={submittingAssignment}
                    onClose={() => setSubmittingAssignment(null)}
                    onSubmitted={refreshMyTasks}
                />
            )}
        </div>
    );
}

export default Tasks;