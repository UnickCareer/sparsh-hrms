/**
 * NewTaskModal.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/tasks/NewTaskModal.jsx
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

const categories = [
    "Development", "Firmware Testing & Validation", "QMS & Compliance Documentation",
    "Production Coordination", "Software Installations", "IT", "HR",
];
const priorities = ["Low", "Medium", "High"];

function NewTaskModal({ onClose, onCreate, currentUser }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [employees, setEmployees] = useState([]);
    const [selectedIds, setSelectedIds] = useState([currentUser.id]); // default: assigned to self
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch("/api/employees")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setEmployees(data.employees);
            })
            .catch((err) => console.error("fetch employees error:", err));
    }, []);

    const canCreate = title.trim().length > 0 && selectedIds.length > 0;

    function toggleAssignee(id) {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }

    const filteredEmployees = employees.filter((e) =>
        e.full_name.toLowerCase().includes(employeeSearch.toLowerCase())
    );

    async function handleCreate() {
        if (!canCreate || submitting) return;

        try {
            setSubmitting(true);
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    category: category || "Uncategorized",
                    priority,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    created_by: currentUser.id,
                    assignee_ids: selectedIds,
                }),
            });

            const data = await res.json();

            if (!data.success) {
                toast.error(data.message || "Failed to create task");
                return;
            }

            toast.success("Task created");
            onCreate();
            onClose();
        } catch (err) {
            console.error("createTask error:", err);
            toast.error("Could not connect to server");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-scaleIn max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900">New Task</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">*</span> Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Describe the task..."
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                        >
                            <option value="">Select category</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Date Range</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Priority</label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                        >
                            {priorities.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">*</span> Assign To
                        </label>
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="w-full mt-1 mb-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                        />
                        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                            {filteredEmployees.map((emp) => (
                                <label
                                    key={emp.id}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(emp.id)}
                                        onChange={() => toggleAssignee(emp.id)}
                                        className="accent-orange-500"
                                    />
                                    {emp.full_name}
                                    {emp.id === currentUser.id && (
                                        <span className="text-xs text-gray-400">(you)</span>
                                    )}
                                </label>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <p className="text-xs text-gray-400 px-3 py-2">No employees found.</p>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {selectedIds.length} employee{selectedIds.length !== 1 ? "s" : ""} selected
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!canCreate || submitting}
                        className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Creating..." : "Create"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NewTaskModal;