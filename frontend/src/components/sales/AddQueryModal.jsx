/**
 * AddQueryModal.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/sales/AddQueryModal.jsx

import { useEffect, useState } from "react";
import { X } from "lucide-react";

function AddQueryModal({ onClose, onCreate, currentUser }) {
    const [customer, setCustomer] = useState("");
    const [contact, setContact] = useState("");
    const [email, setEmail] = useState("");
    const [requirement, setRequirement] = useState("");
    const [meeting, setMeeting] = useState("");
    const [primaryAmount, setPrimaryAmount] = useState("");
    const [secondaryAmount, setSecondaryAmount] = useState("");
    const [followUp, setFollowUp] = useState("");
    const [source, setSource] = useState("");

    // Assigned employee
    const [assignedTo, setAssignedTo] = useState("");

    // Employees list
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(true);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // ========================================================
    // LOAD EMPLOYEES
    // ========================================================

    useEffect(() => {
        async function loadEmployees() {
            try {
                setLoadingEmployees(true);

                const response = await fetch("/api/employees");
                const data = await response.json();

                if (!response.ok || !data.success) {
                    console.error(
                        "fetch employees error:",
                        data.message
                    );

                    setEmployees([]);
                    return;
                }

                setEmployees(data.employees || []);
            } catch (err) {
                console.error(
                    "fetch employees error:",
                    err
                );

                setEmployees([]);
            } finally {
                setLoadingEmployees(false);
            }
        }

        loadEmployees();
    }, []);

    // ========================================================
    // VALIDATION
    // ========================================================

    const canCreate =
        customer.trim() &&
        contact.trim() &&
        currentUser?.id;

    // ========================================================
    // CREATE
    // ========================================================

    async function handleCreate() {
        if (!canCreate || saving) return;

        setSaving(true);
        setError("");

        try {
            const response = await fetch(
                "/api/sales-queries",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        customer: customer.trim(),

                        contact: contact.trim(),

                        email:
                            email.trim() || null,

                        requirement:
                            requirement.trim() ||
                            null,

                        meeting_date:
                            meeting || null,

                        primary_amount:
                            Number(primaryAmount) ||
                            0,

                        secondary_amount:
                            Number(
                                secondaryAmount
                            ) || 0,

                        status: "New",

                        follow_up_date:
                            followUp || null,

                        source:
                            source.trim() ||
                            "Direct",

                        // ------------------------------------------------
                        // CREATED BY
                        // Logged-in user
                        // ------------------------------------------------

                        created_by:
                            currentUser.id,

                        // ------------------------------------------------
                        // ASSIGNED TO
                        // Selected employee
                        // Empty = unassigned
                        // ------------------------------------------------

                        assigned_to:
                            assignedTo
                                ? Number(assignedTo)
                                : null,
                    }),
                }
            );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {
                setError(
                    data.message ||
                        "Failed to create sales query."
                );

                return;
            }

            await onCreate();

            onClose();
        } catch (err) {
            console.error(
                "create sales query error:",
                err
            );

            setError(
                "Unable to connect to the server. Please try again."
            );
        } finally {
            setSaving(false);
        }
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 animate-scaleIn max-h-[90vh] overflow-y-auto">

                {/* HEADER */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900">
                        Add Query
                    </h2>

                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ERROR */}
                {error && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-4">

                    {/* CUSTOMER */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">
                                *
                            </span>{" "}
                            Customer Name
                        </label>

                        <input
                            type="text"
                            value={customer}
                            onChange={(e) =>
                                setCustomer(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            placeholder="Customer / Company name"
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* CONTACT */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">
                                *
                            </span>{" "}
                            Contact Number
                        </label>

                        <input
                            type="tel"
                            value={contact}
                            onChange={(e) =>
                                setContact(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            placeholder="9876543210"
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* EMAIL */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) =>
                                setEmail(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            placeholder="customer@example.com"
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* REQUIREMENT */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Requirement
                        </label>

                        <textarea
                            value={requirement}
                            onChange={(e) =>
                                setRequirement(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            rows={3}
                            placeholder="Enter customer requirement..."
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors resize-none disabled:bg-gray-50"
                        />
                    </div>

                    {/* MEETING DATE */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Meeting Date
                        </label>

                        <input
                            type="date"
                            value={meeting}
                            onChange={(e) =>
                                setMeeting(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* AMOUNTS */}
                    <div className="grid grid-cols-2 gap-3">

                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                Primary (₹)
                            </label>

                            <input
                                type="number"
                                min="0"
                                value={
                                    primaryAmount
                                }
                                onChange={(e) =>
                                    setPrimaryAmount(
                                        e.target.value
                                    )
                                }
                                disabled={saving}
                                placeholder="0"
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                Secondary (₹)
                            </label>

                            <input
                                type="number"
                                min="0"
                                value={
                                    secondaryAmount
                                }
                                onChange={(e) =>
                                    setSecondaryAmount(
                                        e.target.value
                                    )
                                }
                                disabled={saving}
                                placeholder="0"
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                            />
                        </div>

                    </div>

                    {/* FOLLOW-UP */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Follow-up Date
                        </label>

                        <input
                            type="date"
                            value={followUp}
                            onChange={(e) =>
                                setFollowUp(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* SOURCE */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Source
                        </label>

                        <input
                            type="text"
                            value={source}
                            onChange={(e) =>
                                setSource(
                                    e.target.value
                                )
                            }
                            disabled={saving}
                            placeholder="Referral, Website, Direct..."
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* ==================================================
                        ASSIGNED TO
                    ================================================== */}

                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Assigned To
                        </label>

                        <select
                            value={assignedTo}
                            onChange={(e) =>
                                setAssignedTo(
                                    e.target.value
                                )
                            }
                            disabled={
                                saving ||
                                loadingEmployees
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none bg-white focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        >
                            <option value="">
                                -- Unassigned --
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
                                        {employee.full_name ||
                                            `${employee.first_name || ""} ${employee.last_name || ""}`.trim()}
                                        {employee.role
                                            ? ` (${employee.role})`
                                            : ""}
                                    </option>
                                )
                            )}
                        </select>

                        <p className="text-xs text-gray-400 mt-1">
                            Select the employee who
                            should handle this query.
                        </p>
                    </div>

                    {/* CREATED BY */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Created By
                        </label>

                        <div className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                            {currentUser?.full_name ||
                                `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() ||
                                `Employee #${currentUser?.id}`}
                        </div>

                        <p className="text-xs text-gray-400 mt-1">
                            Automatically set to the
                            logged-in user.
                        </p>
                    </div>

                </div>

                {/* BUTTONS */}
                <div className="flex justify-end gap-3 mt-6">

                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleCreate}
                        disabled={
                            !canCreate ||
                            saving
                        }
                        className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving
                            ? "Adding..."
                            : "Add Query"}
                    </button>

                </div>
            </div>
        </div>
    );
}

export default AddQueryModal;