/**
 * RaiseTicketModal.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/it/RaiseTicketModal.jsx

import {
    useRef,
    useState,
} from "react";

import {
    X,
    Upload,
    Paperclip,
    UserRound,
} from "lucide-react";

const categories = [
    "Hardware",
    "Software",
    "Network",
    "Access/Login",
    "Other",
];

const priorities = [
    "Low",
    "Medium",
    "High",
];

function RaiseTicketModal({
    onClose,
    onCreate,
    saving = false,
    employees = [],
    loadingEmployees = false,
}) {

    const [subject, setSubject] =
        useState("");

    const [category, setCategory] =
        useState("Other");

    const [priority, setPriority] =
        useState("Medium");

    const [assigneeId, setAssigneeId] =
        useState("");

    const [description, setDescription] =
        useState("");

    const [fileName, setFileName] =
        useState("");

    const fileInputRef =
        useRef(null);

    const canCreate =
        subject.trim().length > 0 &&
        !saving;

    function handleFileChange(e) {

        const file =
            e.target.files?.[0];

        if (file) {
            setFileName(
                file.name
            );
        }
    }

    function handleCreate() {

        if (!canCreate) {
            return;
        }

        const selectedEmployee =
            employees.find(
                (employee) =>
                    String(employee.id) ===
                    String(assigneeId)
            );

        onCreate({

            subject:
                subject.trim(),

            category,

            priority,

            description:
                description.trim(),

            attachmentName:
                fileName || null,

            assigneeEmployeeId:
                selectedEmployee?.id ||
                null,

            assigneeName:
                selectedEmployee?.name ||
                null,
        });
    }

    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

                {/* HEADER */}

                <div className="flex items-center justify-between px-6 pt-6 mb-5">

                    <div>

                        <h2 className="text-lg font-bold text-gray-900">
                            Raise IT Ticket
                        </h2>

                        <p className="text-xs text-gray-400 mt-1">
                            Submit an issue to the IT support team.
                        </p>

                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>

                </div>

                <div className="px-6 pb-6">

                    <div className="flex flex-col gap-4">

                        {/* SUBJECT */}

                        <div>

                            <label className="text-sm font-medium text-gray-700">

                                <span className="text-red-500">
                                    *
                                </span>{" "}
                                Subject

                            </label>

                            <input
                                type="text"
                                value={subject}
                                disabled={saving}
                                onChange={(e) =>
                                    setSubject(
                                        e.target.value
                                    )
                                }
                                placeholder="e.g. Outlook not opening"
                                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400"
                            />

                        </div>

                        {/* CATEGORY + PRIORITY */}

                        <div className="grid grid-cols-2 gap-3">

                            <div>

                                <label className="text-sm font-medium text-gray-700">
                                    Category
                                </label>

                                <select
                                    value={category}
                                    disabled={saving}
                                    onChange={(e) =>
                                        setCategory(
                                            e.target.value
                                        )
                                    }
                                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white"
                                >

                                    {categories.map(
                                        (item) => (

                                            <option
                                                key={item}
                                                value={item}
                                            >
                                                {item}
                                            </option>

                                        )
                                    )}

                                </select>

                            </div>

                            <div>

                                <label className="text-sm font-medium text-gray-700">
                                    Priority
                                </label>

                                <select
                                    value={priority}
                                    disabled={saving}
                                    onChange={(e) =>
                                        setPriority(
                                            e.target.value
                                        )
                                    }
                                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white"
                                >

                                    {priorities.map(
                                        (item) => (

                                            <option
                                                key={item}
                                                value={item}
                                            >
                                                {item}
                                            </option>

                                        )
                                    )}

                                </select>

                            </div>

                        </div>

                        {/* ASSIGN TO */}

                        <div>

                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">

                                <UserRound
                                    size={14}
                                />

                                Assign To

                            </label>

                            <select
                                value={assigneeId}
                                disabled={
                                    saving ||
                                    loadingEmployees
                                }
                                onChange={(e) =>
                                    setAssigneeId(
                                        e.target.value
                                    )
                                }
                                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-700 outline-none focus:border-orange-400"
                            >

                                <option value="">
                                    Unassigned
                                </option>

                                {employees.map(
                                    (employee) => (

                                        <option
                                            key={
                                                employee.id
                                            }
                                            value={
                                                employee.id
                                            }
                                        >
                                            {employee.name}
                                        </option>

                                    )
                                )}

                            </select>

                            {loadingEmployees && (

                                <p className="text-xs text-gray-400 mt-1">
                                    Loading employees...
                                </p>

                            )}

                        </div>

                        {/* DESCRIPTION */}

                        <div>

                            <label className="text-sm font-medium text-gray-700">
                                Describe the issue
                            </label>

                            <textarea
                                value={description}
                                disabled={saving}
                                onChange={(e) =>
                                    setDescription(
                                        e.target.value
                                    )
                                }
                                rows={4}
                                placeholder="Steps to reproduce, error message, or anything that helps IT respond faster."
                                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm resize-none outline-none focus:border-orange-400"
                            />

                        </div>

                        {/* ATTACHMENT */}

                        <div>

                            <label className="text-sm font-medium text-gray-700">

                                Attachment{" "}

                                <span className="font-normal text-gray-400">
                                    (optional)
                                </span>

                            </label>

                            <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                                className="flex items-center gap-2 mt-1 text-xs font-medium text-gray-600 border border-gray-300 px-3 py-2.5 rounded-lg"
                            >

                                {fileName ? (
                                    <Paperclip size={14} />
                                ) : (
                                    <Upload size={14} />
                                )}

                                <span className="max-w-[250px] truncate">
                                    {fileName ||
                                        "Choose file"}
                                </span>

                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={
                                    handleFileChange
                                }
                                className="hidden"
                            />

                            <p className="text-xs text-gray-400 mt-1">
                                Screenshot / log file, max 15 MB
                            </p>

                        </div>

                    </div>

                    {/* FOOTER */}

                    <div className="flex justify-end gap-3 mt-6">

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!canCreate}
                            className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40"
                        >
                            {saving
                                ? "Creating..."
                                : "Create Ticket"}
                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
}

export default RaiseTicketModal;