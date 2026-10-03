// src/pages/IT.jsx

import { useEffect, useMemo, useState } from "react";

import {
    Plus,
    Inbox,
    Wrench,
    X,
    UserRound,
    CalendarDays,
    MessageSquare,
    Paperclip,
    ChevronDown,
    CheckCircle2,
    Clock3,
    AlertCircle,
    CircleDot,
    RefreshCw,
    Trash2,
} from "lucide-react";

import RaiseTicketModal from "../components/it/RaiseTicketModal";

const API_BASE = "http://localhost:5000/api/it";
const EMPLOYEE_API = "http://localhost:5000/api/employees";

const statuses = [
    "All",
    "Open",
    "In Progress",
    "Resolved",
    "Closed",
    "Reopened",
];

const statusStyles = {
    Open: "bg-blue-50 text-blue-600 border-blue-100",
    "In Progress": "bg-orange-50 text-orange-600 border-orange-100",
    Resolved: "bg-green-50 text-green-600 border-green-100",
    Closed: "bg-gray-100 text-gray-600 border-gray-200",
    Reopened: "bg-red-50 text-red-600 border-red-100",
};

const priorityStyles = {
    Low: "bg-gray-100 text-gray-600",
    Medium: "bg-blue-50 text-blue-600",
    High: "bg-red-50 text-red-600",
};

const statusIcons = {
    Open: CircleDot,
    "In Progress": Clock3,
    Resolved: CheckCircle2,
    Closed: CheckCircle2,
    Reopened: AlertCircle,
};


// ============================================================
// CURRENT USER
// ============================================================

function getCurrentUser() {
    try {
        const savedUser = localStorage.getItem("hrms_user");

        if (!savedUser) {
            return null;
        }

        return JSON.parse(savedUser);
    } catch (error) {
        console.error("Unable to read hrms_user:", error);
        return null;
    }
}


// ============================================================
// USER HELPERS
// ============================================================

function getUserName(user) {
    if (!user) return "";

    if (user.name) return String(user.name).trim();

    if (user.full_name) {
        return String(user.full_name).trim();
    }

    if (user.fullName) {
        return String(user.fullName).trim();
    }

    if (user.employee_name) {
        return String(user.employee_name).trim();
    }

    const firstName =
        user.first_name ||
        user.firstName ||
        "";

    const lastName =
        user.last_name ||
        user.lastName ||
        "";

    const combined =
        `${firstName} ${lastName}`.trim();

    if (combined) return combined;

    if (user.username) {
        return String(user.username).trim();
    }

    return "";
}


function getEmployeeId(employee) {
    return (
        employee?.employee_id ??
        employee?.employeeId ??
        employee?.emp_id ??
        employee?.id ??
        null
    );
}


function getEmployeeName(employee) {
    return getUserName(employee);
}


function getLoggedInEmployeeId(user) {
    return (
        user?.employee_id ??
        user?.employeeId ??
        user?.emp_id ??
        user?.id ??
        null
    );
}


function isAdminUser(user) {
    const role = String(
        user?.role ||
        user?.user_role ||
        user?.designation ||
        ""
    ).toLowerCase();

    return [
        "admin",
        "administrator",
        "owner",
        "hr",
        "manager",
    ].includes(role);
}


// ============================================================
// IT PAGE
// ============================================================

function IT() {

    const [currentUser, setCurrentUser] =
        useState(() => getCurrentUser());

    const requesterName = useMemo(
        () => getUserName(currentUser),
        [currentUser]
    );

    const currentEmployeeId = useMemo(
        () => getLoggedInEmployeeId(currentUser),
        [currentUser]
    );

    const isAdmin = useMemo(
        () => isAdminUser(currentUser),
        [currentUser]
    );


    const [tickets, setTickets] =
        useState([]);

    const [employees, setEmployees] =
        useState([]);

    const [statusFilter, setStatusFilter] =
        useState("All");

    const [showModal, setShowModal] =
        useState(false);

    const [selectedTicket, setSelectedTicket] =
        useState(null);

    const [updateText, setUpdateText] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [loadingEmployees, setLoadingEmployees] =
        useState(true);

    const [error, setError] =
        useState("");

    const [saving, setSaving] =
        useState(false);


    // ============================================================
    // REFRESH USER FROM LOCAL STORAGE
    // ============================================================

    useEffect(() => {

        function refreshUser() {
            setCurrentUser(getCurrentUser());
        }

        window.addEventListener(
            "storage",
            refreshUser
        );

        return () => {
            window.removeEventListener(
                "storage",
                refreshUser
            );
        };

    }, []);


    // ============================================================
    // LOAD TICKETS
    // ============================================================

    async function loadTickets() {

        if (!currentEmployeeId) {

            setError(
                "Unable to identify the logged-in employee."
            );

            setLoading(false);

            return;
        }

        try {

            setLoading(true);
            setError("");

            const params =
                new URLSearchParams({
                    employeeId:
                        String(currentEmployeeId),

                    isAdmin:
                        String(isAdmin),
                });

            const response =
                await fetch(
                    `${API_BASE}/tickets?${params.toString()}`
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to load tickets"
                );
            }

            setTickets(
                Array.isArray(data.tickets)
                    ? data.tickets
                    : []
            );

        } catch (err) {

            console.error(
                "Load IT tickets error:",
                err
            );

            setError(
                "Unable to load IT tickets. Please check that the backend is running."
            );

        } finally {

            setLoading(false);

        }
    }


    // ============================================================
    // LOAD EMPLOYEES
    // ============================================================

    async function loadEmployees() {

        try {

            setLoadingEmployees(true);

            const response =
                await fetch(
                    EMPLOYEE_API
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to load employees"
                );
            }

            const list =
                Array.isArray(data)
                    ? data
                    : data.employees ||
                      data.data ||
                      [];

            const normalized =
                list
                    .map((employee) => {

                        const id =
                            getEmployeeId(
                                employee
                            );

                        const name =
                            getEmployeeName(
                                employee
                            );

                        if (!id || !name) {
                            return null;
                        }

                        return {
                            id,
                            name,
                        };
                    })
                    .filter(Boolean);

            setEmployees(normalized);

        } catch (err) {

            console.error(
                "Employee loading error:",
                err
            );

            setEmployees([]);

        } finally {

            setLoadingEmployees(false);

        }
    }


    useEffect(() => {

        loadTickets();
        loadEmployees();

    }, [
        currentEmployeeId,
        isAdmin,
    ]);


    // ============================================================
    // FILTER
    // ============================================================

    const filteredTickets =
        tickets.filter(
            (ticket) =>
                statusFilter === "All" ||
                ticket.status === statusFilter
        );


    // ============================================================
    // SUMMARY
    // ============================================================

    const totalTickets =
        tickets.length;

    const openTickets =
        tickets.filter(
            (ticket) =>
                ticket.status === "Open"
        ).length;

    const inProgressTickets =
        tickets.filter(
            (ticket) =>
                ticket.status === "In Progress"
        ).length;

    const resolvedTickets =
        tickets.filter(
            (ticket) =>
                ticket.status === "Resolved"
        ).length;


    // ============================================================
    // CREATE TICKET
    // ============================================================

    async function handleCreateTicket(ticketData) {

        if (
            !currentEmployeeId ||
            !requesterName
        ) {

            alert(
                "Unable to identify the logged-in employee. Please log in again."
            );

            return;
        }

        try {

            setSaving(true);

            const response =
                await fetch(
                    `${API_BASE}/tickets`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({

                            ...ticketData,

                            requesterEmployeeId:
                                currentEmployeeId,

                            requesterName:
                                requesterName,
                        }),
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to create ticket"
                );
            }

            setShowModal(false);

            await loadTickets();

        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                "Failed to create IT ticket."
            );

        } finally {

            setSaving(false);

        }
    }


    // ============================================================
    // UPDATE TICKET
    // ============================================================

    async function updateTicket(changes) {

        if (!selectedTicket) {
            return;
        }

        try {

            setSaving(true);

            const response =
                await fetch(
                    `${API_BASE}/tickets/${selectedTicket.id}`,
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({

                            ...changes,

                            currentUser,
                        }),
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to update ticket"
                );
            }

            setSelectedTicket(
                (prev) => ({
                    ...prev,
                    ...data.ticket,
                })
            );

            await loadTickets();

        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                "Failed to update ticket."
            );

        } finally {

            setSaving(false);

        }
    }


    // ============================================================
    // LOAD DETAILS
    // ============================================================

    async function loadTicketDetails(id) {

        try {

            const response =
                await fetch(
                    `${API_BASE}/tickets/${id}`
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to load ticket"
                );
            }

            setSelectedTicket(
                data.ticket
            );

        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                "Failed to load ticket details."
            );
        }
    }


    // ============================================================
    // ADD UPDATE
    // ============================================================

    async function handleAddUpdate() {

        if (
            !selectedTicket ||
            !updateText.trim() ||
            !requesterName
        ) {
            return;
        }

        try {

            setSaving(true);

            const response =
                await fetch(
                    `${API_BASE}/tickets/${selectedTicket.id}/updates`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({

                            authorName:
                                requesterName,

                            currentUser,

                            comment:
                                updateText.trim(),
                        }),
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to add update"
                );
            }

            setUpdateText("");

            await loadTicketDetails(
                selectedTicket.id
            );

            await loadTickets();

        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                "Failed to add update."
            );

        } finally {

            setSaving(false);

        }
    }


    // ============================================================
    // DELETE
    // ============================================================

    async function handleDeleteTicket() {

        if (!selectedTicket) {
            return;
        }

        const confirmed =
            window.confirm(
                `Delete ${selectedTicket.ticket_number}? This cannot be undone.`
            );

        if (!confirmed) {
            return;
        }

        try {

            setSaving(true);

            const response =
                await fetch(
                    `${API_BASE}/tickets/${selectedTicket.id}`,
                    {
                        method: "DELETE",
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to delete ticket"
                );
            }

            setSelectedTicket(null);

            await loadTickets();

        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                "Failed to delete ticket."
            );

        } finally {

            setSaving(false);

        }
    }


    function closeDetails() {

        setSelectedTicket(null);
        setUpdateText("");

    }


    // ============================================================
    // RENDER
    // ============================================================

    return (

        <div className="pb-8">

            {/* HEADER */}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">

                <div>

                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">

                        <Wrench size={22} />

                        IT Helpdesk

                    </h1>

                    <p className="text-sm text-gray-500 mt-1">
                        Manage employee IT support requests and tickets.
                    </p>

                    {requesterName && (

                        <p className="text-xs text-gray-400 mt-1">

                            Logged in as{" "}

                            <span className="font-medium text-gray-600">
                                {requesterName}
                            </span>

                        </p>

                    )}

                </div>


                <div className="flex items-center gap-2">

                    <button
                        type="button"
                        onClick={() => {
                            loadTickets();
                            loadEmployees();
                        }}
                        disabled={loading}
                        className="p-2.5 rounded-lg border border-gray-300 bg-white text-gray-500 hover:text-orange-500 hover:border-orange-300 transition-colors"
                        title="Refresh"
                    >

                        <RefreshCw
                            size={16}
                            className={
                                loading
                                    ? "animate-spin"
                                    : ""
                            }
                        />

                    </button>


                    <button
                        type="button"
                        onClick={() =>
                            setShowModal(true)
                        }
                        className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-sm"
                    >

                        <Plus size={16} />

                        Raise a Ticket

                    </button>

                </div>

            </div>


            {/* ERROR */}

            {error && (

                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>

            )}


            {/* SUMMARY */}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

                <SummaryCard
                    label="Total Tickets"
                    value={totalTickets}
                    icon={Inbox}
                    iconClass="bg-gray-100 text-gray-600"
                />

                <SummaryCard
                    label="Open"
                    value={openTickets}
                    icon={CircleDot}
                    iconClass="bg-blue-50 text-blue-600"
                />

                <SummaryCard
                    label="In Progress"
                    value={inProgressTickets}
                    icon={Clock3}
                    iconClass="bg-orange-50 text-orange-600"
                />

                <SummaryCard
                    label="Resolved"
                    value={resolvedTickets}
                    icon={CheckCircle2}
                    iconClass="bg-green-50 text-green-600"
                />

            </div>


            {/* FILTERS */}

            <div className="flex flex-wrap gap-2 mb-4">

                {statuses.map((status) => (

                    <button
                        key={status}
                        type="button"
                        onClick={() =>
                            setStatusFilter(status)
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            statusFilter === status
                                ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                                : "bg-white border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-600"
                        }`}
                    >
                        {status}
                    </button>

                ))}

            </div>


            {/* TABLE */}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                <div className="overflow-x-auto">

                    <table className="w-full text-sm min-w-[1000px]">

                        <thead>

                            <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50/70">

                                <th className="py-3 px-4 font-medium">
                                    Ticket
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Subject
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Requester
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Category
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Priority
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Status
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Assignee
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Updates
                                </th>

                                <th className="py-3 px-4 font-medium">
                                    Raised
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {loading ? (

                                <tr>

                                    <td
                                        colSpan="9"
                                        className="py-16 text-center text-gray-400"
                                    >
                                        Loading IT tickets...
                                    </td>

                                </tr>

                            ) : (

                                filteredTickets.map(
                                    (ticket) => {

                                        const StatusIcon =
                                            statusIcons[
                                                ticket.status
                                            ] ||
                                            CircleDot;

                                        return (

                                            <tr
                                                key={ticket.id}
                                                onClick={() =>
                                                    loadTicketDetails(
                                                        ticket.id
                                                    )
                                                }
                                                className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors cursor-pointer"
                                            >

                                                <td className="py-3 px-4">
                                                    <span className="text-gray-500 font-mono text-xs">
                                                        {ticket.ticket_number}
                                                    </span>
                                                </td>

                                                <td className="py-3 px-4">

                                                    <div className="font-medium text-gray-800 max-w-[220px] truncate">
                                                        {ticket.subject}
                                                    </div>

                                                </td>

                                                <td className="py-3 px-4 text-gray-600">
                                                    {ticket.requester_name}
                                                </td>

                                                <td className="py-3 px-4 text-gray-600">
                                                    {ticket.category}
                                                </td>

                                                <td className="py-3 px-4">

                                                    <span
                                                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                            priorityStyles[
                                                                ticket.priority
                                                            ] ||
                                                            priorityStyles.Medium
                                                        }`}
                                                    >
                                                        {ticket.priority}
                                                    </span>

                                                </td>

                                                <td className="py-3 px-4">

                                                    <span
                                                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                                            statusStyles[
                                                                ticket.status
                                                            ] ||
                                                            statusStyles.Open
                                                        }`}
                                                    >

                                                        <StatusIcon
                                                            size={12}
                                                        />

                                                        {ticket.status}

                                                    </span>

                                                </td>

                                                <td className="py-3 px-4 text-gray-500">
                                                    {ticket.assignee_name ||
                                                        "Unassigned"}
                                                </td>

                                                <td className="py-3 px-4">

                                                    <span className="inline-flex items-center gap-1 text-gray-500">

                                                        <MessageSquare
                                                            size={13}
                                                        />

                                                        {ticket.updates}

                                                    </span>

                                                </td>

                                                <td className="py-3 px-4 text-gray-500">
                                                    {formatDate(
                                                        ticket.created_at
                                                    )}
                                                </td>

                                            </tr>

                                        );

                                    }
                                )

                            )}

                        </tbody>

                    </table>

                </div>


                {!loading &&
                    filteredTickets.length === 0 && (

                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">

                            <Inbox
                                size={32}
                                className="mb-2"
                            />

                            <p className="text-sm font-medium">
                                No tickets found.
                            </p>

                            <p className="text-xs mt-1">
                                Try another status filter or raise a new ticket.
                            </p>

                        </div>

                    )}

            </div>


            {/* CREATE MODAL */}

            {showModal && (

                <RaiseTicketModal
                    employees={employees}
                    loadingEmployees={loadingEmployees}
                    onClose={() =>
                        setShowModal(false)
                    }
                    onCreate={
                        handleCreateTicket
                    }
                    saving={saving}
                />

            )}


            {/* DETAILS */}

            {selectedTicket && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">

                        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">

                            <div>

                                <div className="flex items-center gap-2 mb-1">

                                    <span className="font-mono text-xs text-gray-400">
                                        {selectedTicket.ticket_number}
                                    </span>

                                    <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                                            statusStyles[
                                                selectedTicket.status
                                            ] ||
                                            statusStyles.Open
                                        }`}
                                    >
                                        {selectedTicket.status}
                                    </span>

                                </div>

                                <h2 className="text-lg font-bold text-gray-900">
                                    {selectedTicket.subject}
                                </h2>

                            </div>

                            <button
                                type="button"
                                onClick={closeDetails}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            >
                                <X size={20} />
                            </button>

                        </div>


                        <div className="overflow-y-auto max-h-[calc(90vh-150px)] px-6 py-5">

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">

                                <InfoItem
                                    icon={UserRound}
                                    label="Requester"
                                    value={
                                        selectedTicket.requester_name
                                    }
                                />

                                <InfoItem
                                    icon={Wrench}
                                    label="Category"
                                    value={
                                        selectedTicket.category
                                    }
                                />

                                <InfoItem
                                    icon={AlertCircle}
                                    label="Priority"
                                    value={
                                        selectedTicket.priority
                                    }
                                />

                                <InfoItem
                                    icon={CalendarDays}
                                    label="Raised"
                                    value={formatDate(
                                        selectedTicket.created_at
                                    )}
                                />

                                <InfoItem
                                    icon={MessageSquare}
                                    label="Updates"
                                    value={
                                        selectedTicket.updates
                                    }
                                />


                                {/* ASSIGNEE */}

                                <div>

                                    <p className="text-xs text-gray-400 mb-1">
                                        Assignee
                                    </p>

                                    <select
                                        value={
                                            selectedTicket.assignee_employee_id
                                                ? String(
                                                      selectedTicket.assignee_employee_id
                                                  )
                                                : ""
                                        }
                                        disabled={
                                            saving ||
                                            loadingEmployees
                                        }
                                        onChange={(e) => {

                                            const employee =
                                                employees.find(
                                                    (item) =>
                                                        String(
                                                            item.id
                                                        ) ===
                                                        e.target.value
                                                );

                                            updateTicket({

                                                assigneeEmployeeId:
                                                    employee?.id ||
                                                    null,

                                                assigneeName:
                                                    employee?.name ||
                                                    null,
                                            });

                                        }}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
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

                                </div>

                            </div>


                            {/* STATUS */}

                            <div className="mb-6">

                                <p className="text-sm font-semibold text-gray-800 mb-2">
                                    Ticket Status
                                </p>

                                <div className="relative w-full md:w-64">

                                    <select
                                        value={
                                            selectedTicket.status
                                        }
                                        disabled={
                                            saving
                                        }
                                        onChange={(e) =>
                                            updateTicket({
                                                status:
                                                    e.target.value,
                                            })
                                        }
                                        className="w-full appearance-none px-3 py-2.5 pr-9 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
                                    >

                                        {statuses
                                            .filter(
                                                (status) =>
                                                    status !==
                                                    "All"
                                            )
                                            .map(
                                                (status) => (

                                                    <option
                                                        key={
                                                            status
                                                        }
                                                        value={
                                                            status
                                                        }
                                                    >
                                                        {status}
                                                    </option>

                                                )
                                            )}

                                    </select>

                                    <ChevronDown
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                    />

                                </div>

                            </div>


                            {/* DESCRIPTION */}

                            <div className="mb-6">

                                <p className="text-sm font-semibold text-gray-800 mb-2">
                                    Issue Description
                                </p>

                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-600 leading-relaxed">

                                    {selectedTicket.description ||
                                        "No description was provided."}

                                </div>

                            </div>


                            {/* ATTACHMENT */}

                            {selectedTicket.attachment_name && (

                                <div className="mb-6">

                                    <p className="text-sm font-semibold text-gray-800 mb-2">
                                        Attachment
                                    </p>

                                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">

                                        <Paperclip size={15} />

                                        {
                                            selectedTicket.attachment_name
                                        }

                                    </div>

                                </div>

                            )}


                            {/* UPDATES */}

                            <div>

                                <div className="flex items-center justify-between mb-3">

                                    <p className="text-sm font-semibold text-gray-800">
                                        Ticket Updates
                                    </p>

                                    <span className="text-xs text-gray-400">

                                        {selectedTicket.updates}{" "}
                                        update
                                        {selectedTicket.updates ===
                                        1
                                            ? ""
                                            : "s"}

                                    </span>

                                </div>


                                <div className="space-y-3 mb-4">

                                    {selectedTicket
                                        .updateHistory
                                        ?.length > 0 ? (

                                        selectedTicket.updateHistory.map(
                                            (update) => (

                                                <div
                                                    key={
                                                        update.id
                                                    }
                                                    className="bg-gray-50 border border-gray-100 rounded-xl p-3"
                                                >

                                                    <div className="flex items-center justify-between mb-1">

                                                        <span className="text-xs font-semibold text-gray-700">
                                                            {
                                                                update.author_name
                                                            }
                                                        </span>

                                                        <span className="text-[11px] text-gray-400">
                                                            {formatDateTime(
                                                                update.created_at
                                                            )}
                                                        </span>

                                                    </div>

                                                    <p className="text-sm text-gray-600">
                                                        {
                                                            update.comment
                                                        }
                                                    </p>

                                                </div>

                                            )
                                        )

                                    ) : (

                                        <div className="text-sm text-gray-400 py-3">
                                            No updates yet.
                                        </div>

                                    )}

                                </div>


                                <div className="flex gap-2">

                                    <input
                                        value={
                                            updateText
                                        }
                                        disabled={
                                            saving
                                        }
                                        onChange={(e) =>
                                            setUpdateText(
                                                e.target.value
                                            )
                                        }
                                        onKeyDown={(e) => {

                                            if (
                                                e.key ===
                                                    "Enter" &&
                                                !e.shiftKey
                                            ) {

                                                e.preventDefault();

                                                handleAddUpdate();

                                            }

                                        }}
                                        placeholder="Add an update or comment..."
                                        className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400"
                                    />

                                    <button
                                        type="button"
                                        onClick={
                                            handleAddUpdate
                                        }
                                        disabled={
                                            saving ||
                                            !updateText.trim()
                                        }
                                        className="px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Add
                                    </button>

                                </div>

                            </div>


                            {/* DELETE */}

                            <div className="mt-7 pt-5 border-t border-gray-100 flex justify-end">

                                <button
                                    type="button"
                                    onClick={
                                        handleDeleteTicket
                                    }
                                    disabled={
                                        saving
                                    }
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                >

                                    <Trash2 size={15} />

                                    Delete Ticket

                                </button>

                            </div>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}


// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
    label,
    value,
    icon: Icon,
    iconClass,
}) {

    return (

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">

            <div className="flex items-center justify-between">

                <div>

                    <p className="text-xs text-gray-400 mb-1">
                        {label}
                    </p>

                    <p className="text-2xl font-bold text-gray-900">
                        {value}
                    </p>

                </div>

                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}
                >
                    <Icon size={19} />
                </div>

            </div>

        </div>
    );
}


// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({
    icon: Icon,
    label,
    value,
}) {

    return (

        <div>

            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">

                <Icon size={12} />

                {label}

            </p>

            <p className="text-sm font-medium text-gray-700">
                {value || "-"}
            </p>

        </div>
    );
}


// ============================================================
// DATE
// ============================================================

function formatDate(dateString) {

    if (!dateString) return "-";

    const date =
        new Date(dateString);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateString;
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
}


// ============================================================
// DATE TIME
// ============================================================

function formatDateTime(dateString) {

    if (!dateString) return "";

    const date =
        new Date(dateString);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateString;
    }

    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}


export default IT;