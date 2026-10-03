// src/components/visitors/AddVisitorModal.jsx

import { useEffect, useRef, useState } from "react";
import { X, Upload, User, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

function AddVisitorModal({ onClose, onCreate }) {
    const { currentUser } = useAuth();

    const [firstName, setFirstName] =
        useState("");

    const [lastName, setLastName] =
        useState("");

    const [company, setCompany] =
        useState("");

    const [mobile, setMobile] =
        useState("");

    const [email, setEmail] =
        useState("");

    const [purpose, setPurpose] =
        useState("");

    const [meetingDate, setMeetingDate] =
        useState("");

    const [remarks, setRemarks] =
        useState("");

    const [hostEmployeeId, setHostEmployeeId] =
        useState("");

    const [employees, setEmployees] =
        useState([]);

    const [loadingEmployees, setLoadingEmployees] =
        useState(true);

    const [photoPreview, setPhotoPreview] =
        useState(null);

    const [submitting, setSubmitting] =
        useState(false);

    const fileInputRef =
        useRef(null);

    // ============================================================
    // LOAD ACTIVE EMPLOYEES
    // ============================================================

    useEffect(() => {
        async function loadEmployees() {
            try {
                setLoadingEmployees(true);

                const res = await fetch(
                    "/api/visitors/hosts"
                );

                const data =
                    await res.json();

                if (
                    !res.ok ||
                    !data.success
                ) {
                    toast.error(
                        data.message ||
                            "Failed to load employees"
                    );
                    return;
                }

                setEmployees(
                    data.employees || []
                );
            } catch (err) {
                console.error(
                    "load visitor hosts error:",
                    err
                );

                toast.error(
                    "Could not load employees"
                );
            } finally {
                setLoadingEmployees(false);
            }
        }

        loadEmployees();
    }, []);

    const canCreate =
        firstName.trim() &&
        mobile.trim() &&
        purpose.trim() &&
        hostEmployeeId;

    // ============================================================
    // PHOTO PREVIEW
    // ============================================================

    function handlePhotoChange(e) {
        const file =
            e.target.files?.[0];

        if (!file) return;

        const reader =
            new FileReader();

        reader.onload = () => {
            setPhotoPreview(
                reader.result
            );
        };

        reader.readAsDataURL(file);
    }

    // ============================================================
    // CREATE VISITOR
    // ============================================================

    async function handleCreate() {
        if (
            !canCreate ||
            submitting
        ) {
            return;
        }

        if (!currentUser?.id) {
            toast.error(
                "User session not found"
            );
            return;
        }

        try {
            setSubmitting(true);

            const res = await fetch(
                "/api/visitors",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        first_name:
                            firstName.trim(),

                        last_name:
                            lastName.trim(),

                        company:
                            company.trim(),

                        mobile:
                            mobile.trim(),

                        email:
                            email.trim(),

                        purpose:
                            purpose.trim(),

                        meeting_date:
                            meetingDate ||
                            null,

                        remarks:
                            remarks.trim(),

                        created_by:
                            currentUser.id,

                        host_employee_id:
                            Number(
                                hostEmployeeId
                            ),
                    }),
                }
            );

            const data =
                await res.json();

            if (
                !res.ok ||
                !data.success
            ) {
                toast.error(
                    data.message ||
                        "Failed to create visitor"
                );
                return;
            }

            toast.success(
                "Visitor added successfully"
            );

            onCreate();

            onClose();
        } catch (err) {
            console.error(
                "createVisitor error:",
                err
            );

            toast.error(
                "Could not connect to server"
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 animate-scaleIn max-h-[90vh] overflow-y-auto">

                {/* ====================================================
                    HEADER
                ==================================================== */}

                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            Add Visitor / Meeting
                        </h2>

                        <p className="text-xs text-gray-400 mt-1">
                            Register a visitor and select the employee
                            they are meeting.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ====================================================
                    PHOTO
                ==================================================== */}

                <div className="flex items-center gap-4 mb-5">
                    <div className="relative w-16 h-16 shrink-0">
                        {photoPreview ? (
                            <img
                                src={photoPreview}
                                alt="Visitor"
                                className="w-16 h-16 rounded-full object-cover ring-2 ring-orange-200"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center ring-2 ring-gray-200">
                                <User
                                    size={24}
                                    className="text-gray-400"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                            Visitor photo
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                fileInputRef.current?.click()
                            }
                            disabled={submitting}
                            className="flex items-center gap-2 text-xs font-medium text-orange-600 border border-orange-300 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        >
                            <Upload size={14} />
                            Upload Photo
                        </button>

                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={
                                handlePhotoChange
                            }
                            className="hidden"
                        />
                    </div>
                </div>

                {/* ====================================================
                    FORM
                ==================================================== */}

                <div className="grid grid-cols-2 gap-4">

                    {/* First Name */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">
                                *
                            </span>{" "}
                            First Name
                        </label>

                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) =>
                                setFirstName(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Last Name
                        </label>

                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) =>
                                setLastName(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Company */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Company
                        </label>

                        <input
                            type="text"
                            value={company}
                            onChange={(e) =>
                                setCompany(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Mobile */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">
                                *
                            </span>{" "}
                            Mobile
                        </label>

                        <input
                            type="tel"
                            value={mobile}
                            onChange={(e) =>
                                setMobile(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Email */}
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
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Purpose */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">
                                *
                            </span>{" "}
                            Purpose
                        </label>

                        <input
                            type="text"
                            value={purpose}
                            onChange={(e) =>
                                setPurpose(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Meeting Date */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            Meeting Date
                        </label>

                        <input
                            type="date"
                            value={meetingDate}
                            onChange={(e) =>
                                setMeetingDate(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors disabled:bg-gray-50"
                        />
                    </div>

                    {/* Meeting With */}
                    <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                            <span className="text-red-500">
                                *
                            </span>{" "}
                            Meeting With
                        </label>

                        <div className="relative mt-1">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                            />

                            <select
                                value={
                                    hostEmployeeId
                                }
                                onChange={(e) =>
                                    setHostEmployeeId(
                                        e.target.value
                                    )
                                }
                                disabled={
                                    submitting ||
                                    loadingEmployees
                                }
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors bg-white disabled:bg-gray-50"
                            >
                                <option value="">
                                    {loadingEmployees
                                        ? "Loading employees..."
                                        : "Select employee"}
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
                                            {
                                                employee.full_name
                                            }
                                            {employee.employee_code
                                                ? ` (${employee.employee_code})`
                                                : ""}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                            Remarks
                        </label>

                        <textarea
                            value={remarks}
                            onChange={(e) =>
                                setRemarks(
                                    e.target.value
                                )
                            }
                            disabled={
                                submitting
                            }
                            rows={3}
                            placeholder="Additional information..."
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors resize-none disabled:bg-gray-50"
                        />
                    </div>
                </div>

                {/* ====================================================
                    FOOTER
                ==================================================== */}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={
                            submitting
                        }
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={
                            !canCreate ||
                            submitting
                        }
                        className="px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting
                            ? "Saving..."
                            : "Add Visitor"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AddVisitorModal;