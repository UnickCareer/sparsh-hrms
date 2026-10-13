/**
 * Visitors.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/Visitors.jsx

import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
    Plus,
    Inbox,
    User,
    LogIn,
    LogOut,
    XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import AddVisitorModal from "../components/visitors/AddVisitorModal";

const statusStyles = {
    Scheduled: "bg-blue-50 text-blue-600",
    "Checked In": "bg-green-50 text-green-600",
    "Checked Out": "bg-gray-100 text-gray-600",
    Cancelled: "bg-red-50 text-red-600",
};

function Visitors() {
    const {
        visitors,
        refreshVisitors,
        currentUser,
    } = useOutletContext();

    const [showModal, setShowModal] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    function handleAddVisitor() {
        refreshVisitors();
    }

    async function updateStatus(visitor, newStatus) {
        if (!currentUser?.id) {
            toast.error("User session not found");
            return;
        }

        try {
            setUpdatingId(visitor.id);

            const res = await fetch(
                `/api/visitors/${visitor.id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: newStatus,
                        employee_id: currentUser.id,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok || !data.success) {
                toast.error(
                    data.message ||
                        "Failed to update visitor status"
                );
                return;
            }

            const successMessages = {
                "Checked In":
                    "Visitor checked in successfully",
                "Checked Out":
                    "Visitor checked out successfully",
                Cancelled:
                    "Visitor cancelled successfully",
            };

            toast.success(
                successMessages[newStatus] ||
                    "Visitor status updated"
            );

            await refreshVisitors();
        } catch (err) {
            console.error(
                "update visitor status error:",
                err
            );

            toast.error(
                "Could not connect to server"
            );
        } finally {
            setUpdatingId(null);
        }
    }

    function handleStatusClick(visitor, status) {
        if (status === "Checked In") {
            const confirmed = window.confirm(
                `Check in ${visitor.firstName} ${visitor.lastName}?`
            );

            if (!confirmed) return;
        }

        if (status === "Checked Out") {
            const confirmed = window.confirm(
                `Check out ${visitor.firstName} ${visitor.lastName}?`
            );

            if (!confirmed) return;
        }

        if (status === "Cancelled") {
            const confirmed = window.confirm(
                `Cancel the visit for ${visitor.firstName} ${visitor.lastName}?`
            );

            if (!confirmed) return;
        }

        updateStatus(visitor, status);
    }

    return (
        <div>
            {/* ====================================================
                HEADER
            ==================================================== */}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Visitor Management
                    </h1>

                    <p className="text-sm text-gray-500 mt-1">
                        Manage visitors, meetings and visit status.
                    </p>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus size={16} />
                    Add Visitor
                </button>
            </div>

            {/* ====================================================
                TABLE
            ==================================================== */}

            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                            <th className="py-3 px-4 font-medium">
                                Visitor
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Company
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Mobile
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Purpose
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Meeting With
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Meeting Date
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Status
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Action
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {visitors.map((v) => {
                            const isUpdating =
                                updatingId === v.id;

                            return (
                                <tr
                                    key={v.id}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                    {/* Visitor */}
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            {v.photo ? (
                                                <img
                                                    src={v.photo}
                                                    alt={v.firstName}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                    <User
                                                        size={14}
                                                        className="text-gray-400"
                                                    />
                                                </div>
                                            )}

                                            <div>
                                                <p className="text-gray-800 font-medium">
                                                    {v.firstName}{" "}
                                                    {v.lastName}
                                                </p>

                                                {v.email && (
                                                    <p className="text-xs text-gray-400">
                                                        {v.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Company */}
                                    <td className="py-3 px-4 text-gray-600">
                                        {v.company || "-"}
                                    </td>

                                    {/* Mobile */}
                                    <td className="py-3 px-4 text-gray-600">
                                        {v.mobile || "-"}
                                    </td>

                                    {/* Purpose */}
                                    <td className="py-3 px-4 text-gray-600">
                                        {v.purpose || "-"}
                                    </td>

                                    {/* Host */}
                                    <td className="py-3 px-4 text-gray-600">
                                        {v.hostEmployeeName || "-"}
                                    </td>

                                    {/* Meeting date */}
                                    <td className="py-3 px-4 text-gray-500">
                                        {v.meetingDate || "-"}
                                    </td>

                                    {/* Status */}
                                    <td className="py-3 px-4">
                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                statusStyles[
                                                    v.status
                                                ] ||
                                                "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {v.status}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="py-3 px-4">
                                        {v.status ===
                                            "Scheduled" && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        handleStatusClick(
                                                            v,
                                                            "Checked In"
                                                        )
                                                    }
                                                    disabled={
                                                        isUpdating
                                                    }
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors disabled:opacity-50"
                                                    title="Check In"
                                                >
                                                    <LogIn
                                                        size={13}
                                                    />
                                                    Check In
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        handleStatusClick(
                                                            v,
                                                            "Cancelled"
                                                        )
                                                    }
                                                    disabled={
                                                        isUpdating
                                                    }
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors disabled:opacity-50"
                                                    title="Cancel Visit"
                                                >
                                                    <XCircle
                                                        size={13}
                                                    />
                                                    Cancel
                                                </button>
                                            </div>
                                        )}

                                        {v.status ===
                                            "Checked In" && (
                                            <button
                                                onClick={() =>
                                                    handleStatusClick(
                                                        v,
                                                        "Checked Out"
                                                    )
                                                }
                                                disabled={
                                                    isUpdating
                                                }
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium transition-colors disabled:opacity-50"
                                                title="Check Out"
                                            >
                                                <LogOut
                                                    size={13}
                                                />
                                                Check Out
                                            </button>
                                        )}

                                        {(v.status ===
                                            "Checked Out" ||
                                            v.status ===
                                                "Cancelled") && (
                                            <span className="text-xs text-gray-400">
                                                Visit closed
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {visitors.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Inbox
                            size={32}
                            className="mb-2"
                        />

                        <p className="text-sm">
                            No visitors found.
                        </p>
                    </div>
                )}
            </div>

            {/* ====================================================
                ADD VISITOR MODAL
            ==================================================== */}

            {showModal && (
                <AddVisitorModal
                    onClose={() =>
                        setShowModal(false)
                    }
                    onCreate={
                        handleAddVisitor
                    }
                />
            )}
        </div>
    );
}

export default Visitors;