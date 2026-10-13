/**
 * SalesQuery.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/SalesQuery.jsx

import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
    Briefcase,
    Gauge,
    Search as SearchIcon,
    Users,
    CalendarClock,
    Plus,
    Inbox,
} from "lucide-react";

import AddQueryModal from "../components/sales/AddQueryModal";

const statusStyles = {
    New: "bg-orange-50 text-orange-600",
    Open: "bg-blue-50 text-blue-600",
    Leads: "bg-green-50 text-green-600",
    Closed: "bg-gray-100 text-gray-600",
};

function formatCurrency(amount) {
    return `₹${Number(amount || 0).toLocaleString(
        "en-IN"
    )}`;
}

function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function StatBox({
    label,
    value,
    icon: Icon,
    colorClass,
}) {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${colorClass.bg}`}
            >
                <Icon
                    size={20}
                    className={colorClass.text}
                />
            </div>

            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    {label}
                </p>

                <p
                    className={`text-xl font-bold ${colorClass.text}`}
                >
                    {value}
                </p>
            </div>
        </div>
    );
}

// ============================================================
// DASHBOARD TAB
// ============================================================

function DashboardTab({ queries }) {
    const totalQueries = queries.length;

    const primaryTotal = queries.reduce(
        (sum, q) =>
            sum + Number(q.primaryAmount || 0),
        0
    );

    const secondaryTotal = queries.reduce(
        (sum, q) =>
            sum + Number(q.secondaryAmount || 0),
        0
    );

    const uniqueCustomers = new Set(
        queries.map((q) => q.customer)
    ).size;

    const grandTotal =
        primaryTotal + secondaryTotal;

    const primaryPct =
        grandTotal > 0
            ? Math.round(
                  (primaryTotal /
                      grandTotal) *
                      100
              )
            : 0;

    return (
        <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
                Sales Overview
            </h2>

            <p className="text-gray-400 text-sm mb-4">
                This month
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                <StatBox
                    label="Total Queries"
                    value={totalQueries}
                    icon={SearchIcon}
                    colorClass={{
                        bg: "bg-blue-50",
                        text: "text-blue-600",
                    }}
                />

                <StatBox
                    label="Primary Sales"
                    value={formatCurrency(
                        primaryTotal
                    )}
                    icon={Briefcase}
                    colorClass={{
                        bg: "bg-green-50",
                        text: "text-green-600",
                    }}
                />

                <StatBox
                    label="Secondary Sales"
                    value={formatCurrency(
                        secondaryTotal
                    )}
                    icon={Gauge}
                    colorClass={{
                        bg: "bg-teal-50",
                        text: "text-teal-600",
                    }}
                />

                <StatBox
                    label="Customers"
                    value={uniqueCustomers}
                    icon={Users}
                    colorClass={{
                        bg: "bg-pink-50",
                        text: "text-pink-600",
                    }}
                />

            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">

                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Revenue Split
                </h3>

                <div className="flex items-center gap-8">

                    <div className="relative w-32 h-32 shrink-0">

                        <svg
                            width="128"
                            height="128"
                            viewBox="0 0 128 128"
                        >
                            <circle
                                cx="64"
                                cy="64"
                                r="54"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="14"
                            />

                            {grandTotal > 0 && (
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="54"
                                    fill="none"
                                    stroke="#22c55e"
                                    strokeWidth="14"
                                    strokeDasharray={
                                        2 *
                                        Math.PI *
                                        54
                                    }
                                    strokeDashoffset={
                                        2 *
                                        Math.PI *
                                        54 *
                                        (1 -
                                            primaryPct /
                                                100)
                                    }
                                    strokeLinecap="round"
                                    transform="rotate(-90 64 64)"
                                    className="transition-all duration-700 ease-out"
                                />
                            )}
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(
                                    grandTotal
                                )}
                            </span>

                            <span className="text-xs text-gray-400">
                                TOTAL
                            </span>
                        </div>

                    </div>

                    <div className="flex flex-col gap-2">

                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-sm bg-green-500" />

                            Primary —{" "}
                            {formatCurrency(
                                primaryTotal
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-sm bg-blue-400" />

                            Secondary —{" "}
                            {formatCurrency(
                                secondaryTotal
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// SALES QUERIES TAB
// ============================================================

function SalesQueriesTab({
    queries,
    refreshSalesQueries,
    currentUser,
}) {
    const [statusFilter, setStatusFilter] =
        useState("All");

    const [searchTerm, setSearchTerm] =
        useState("");

    const [showModal, setShowModal] =
        useState(false);

    const statusCounts = {
        All: queries.length,

        New: queries.filter(
            (q) => q.status === "New"
        ).length,

        Open: queries.filter(
            (q) => q.status === "Open"
        ).length,

        Leads: queries.filter(
            (q) => q.status === "Leads"
        ).length,

        Closed: queries.filter(
            (q) => q.status === "Closed"
        ).length,
    };

    const filtered = queries.filter((q) => {
        const matchesStatus =
            statusFilter === "All" ||
            q.status === statusFilter;

        const customer =
            q.customer?.toLowerCase() ||
            "";

        const contact =
            q.contact?.toString() || "";

        const assigned =
            q.assignedToName?.toLowerCase() ||
            "";

        const created =
            q.createdByName?.toLowerCase() ||
            "";

        const search =
            searchTerm.toLowerCase();

        const matchesSearch =
            customer.includes(search) ||
            contact.includes(search) ||
            assigned.includes(search) ||
            created.includes(search);

        return (
            matchesStatus &&
            matchesSearch
        );
    });

    async function handleAddQuery() {
        await refreshSalesQueries();
    }

    const primaryTotal = filtered.reduce(
        (sum, q) =>
            sum +
            Number(
                q.primaryAmount || 0
            ),
        0
    );

    const secondaryTotal =
        filtered.reduce(
            (sum, q) =>
                sum +
                Number(
                    q.secondaryAmount || 0
                ),
            0
        );

    return (
        <div>

            {/* SEARCH + ADD */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">

                <div className="relative w-full lg:w-80">

                    <SearchIcon
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                        type="text"
                        placeholder="Search customer, phone, assigned..."
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(
                                e.target.value
                            )
                        }
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                    />

                </div>

                <button
                    onClick={() =>
                        setShowModal(true)
                    }
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                    <Plus size={16} />
                    Add Query
                </button>

            </div>

            {/* STATUS FILTERS */}
            <div className="flex flex-wrap gap-2 mb-4">

                {Object.entries(
                    statusCounts
                ).map(
                    ([status, count]) => (
                        <button
                            key={status}
                            onClick={() =>
                                setStatusFilter(
                                    status
                                )
                            }
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 hover:scale-105 ${
                                statusFilter ===
                                status
                                    ? "bg-orange-500 border-orange-500 text-white"
                                    : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                            }`}
                        >
                            {status}

                            <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    statusFilter ===
                                    status
                                        ? "bg-white/20"
                                        : "bg-gray-100"
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    )
                )}

            </div>

            {/* SUMMARY */}
            <p className="text-sm text-gray-500 mb-3">
                {filtered.length} queries •
                Primary:{" "}
                {formatCurrency(
                    primaryTotal
                )}{" "}
                • Secondary:{" "}
                {formatCurrency(
                    secondaryTotal
                )}
            </p>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">

                <table className="w-full text-sm">

                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">

                            <th className="py-3 px-4 font-medium">
                                Date
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Customer
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Contact
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Assigned To
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Created By
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Meeting
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Primary ₹
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Secondary ₹
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Follow-up
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Status
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Source
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Created At
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Updated At
                            </th>

                        </tr>
                    </thead>

                    <tbody>

                        {filtered.map(
                            (q) => (
                                <tr
                                    key={q.id}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >

                                    <td className="py-3 px-4 text-gray-600">
                                        {q.date ||
                                            "-"}
                                    </td>

                                    <td className="py-3 px-4 text-gray-800 font-medium">
                                        {q.customer}
                                    </td>

                                    <td className="py-3 px-4 text-gray-600">
                                        {q.contact}
                                    </td>

                                    {/* ASSIGNED TO */}
                                    <td className="py-3 px-4">

                                        {q.assignedToName ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                                                {
                                                    q.assignedToName
                                                }
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">
                                                Unassigned
                                            </span>
                                        )}

                                    </td>

                                    {/* CREATED BY */}
                                    <td className="py-3 px-4">

                                        <span className="text-gray-700 font-medium">
                                            {q.createdByName ||
                                                "-"}
                                        </span>

                                    </td>

                                    <td className="py-3 px-4 text-gray-500">
                                        {q.meeting ||
                                            "-"}
                                    </td>

                                    <td className="py-3 px-4 text-gray-700">
                                        {formatCurrency(
                                            q.primaryAmount
                                        )}
                                    </td>

                                    <td className="py-3 px-4 text-gray-700">
                                        {formatCurrency(
                                            q.secondaryAmount
                                        )}
                                    </td>

                                    <td className="py-3 px-4 text-gray-500">
                                        {q.followUp ||
                                            "-"}
                                    </td>

                                    <td className="py-3 px-4">

                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                statusStyles[
                                                    q.status
                                                ] ||
                                                "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {q.status}
                                        </span>

                                    </td>

                                    <td className="py-3 px-4 text-gray-500">
                                        {q.source ||
                                            "-"}
                                    </td>

                                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                                        {formatDateTime(
                                            q.createdAt
                                        )}
                                    </td>

                                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                                        {formatDateTime(
                                            q.updatedAt
                                        )}
                                    </td>

                                </tr>
                            )
                        )}

                    </tbody>

                </table>

                {filtered.length ===
                    0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">

                        <Inbox
                            size={32}
                            className="mb-2"
                        />

                        <p className="text-sm">
                            No queries found.
                        </p>

                    </div>
                )}

            </div>

            {/* ADD MODAL */}
            {showModal && (
                <AddQueryModal
                    onClose={() =>
                        setShowModal(
                            false
                        )
                    }
                    onCreate={
                        handleAddQuery
                    }
                    currentUser={
                        currentUser
                    }
                />
            )}

        </div>
    );
}

// ============================================================
// CUSTOMERS TAB
// ============================================================

function CustomersTab({ queries }) {
    const [searchTerm, setSearchTerm] =
        useState("");

    const customerMap = {};

    queries.forEach((q) => {
        if (!customerMap[q.customer]) {
            customerMap[q.customer] = {
                name: q.customer,
                phone: q.contact,
                visits: 0,
                lastVisit: q.date,
            };
        }

        customerMap[q.customer].visits +=
            1;

        if (
            q.date >
            customerMap[q.customer]
                .lastVisit
        ) {
            customerMap[q.customer]
                .lastVisit = q.date;
        }
    });

    const customers =
        Object.values(customerMap).filter(
            (c) =>
                c.name
                    .toLowerCase()
                    .includes(
                        searchTerm.toLowerCase()
                    )
        );

    return (
        <div>

            <div className="flex items-center gap-3 mb-4">

                <div className="relative flex-1 max-w-sm">

                    <SearchIcon
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                        type="text"
                        placeholder="Search name, phone, company..."
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(
                                e.target.value
                            )
                        }
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none focus:border-orange-400 transition-colors"
                    />

                </div>

                <span className="text-sm text-gray-500">
                    {customers.length}{" "}
                    customers
                </span>

            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">

                <table className="w-full text-sm">

                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">

                            <th className="py-3 px-4 font-medium">
                                Name
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Phone
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Visits
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Last Visit
                            </th>

                        </tr>
                    </thead>

                    <tbody>

                        {customers.map(
                            (c) => (
                                <tr
                                    key={c.name}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >

                                    <td className="py-3 px-4 text-gray-800 font-medium">
                                        {c.name}
                                    </td>

                                    <td className="py-3 px-4 text-gray-600">
                                        {c.phone}
                                    </td>

                                    <td className="py-3 px-4 text-gray-600">
                                        {c.visits}
                                    </td>

                                    <td className="py-3 px-4 text-gray-500">
                                        {c.lastVisit}
                                    </td>

                                </tr>
                            )
                        )}

                    </tbody>

                </table>

                {customers.length ===
                    0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">

                        <Inbox
                            size={32}
                            className="mb-2"
                        />

                        <p className="text-sm">
                            No customers found.
                        </p>

                    </div>
                )}

            </div>

        </div>
    );
}

// ============================================================
// FOLLOW-UPS TAB
// ============================================================

function FollowUpsTab({ queries }) {
    const today = new Date()
        .toISOString()
        .slice(0, 10);

    const withFollowUp =
        queries.filter(
            (q) => q.followUp
        );

    const overdue =
        withFollowUp.filter(
            (q) =>
                q.followUp < today
        ).length;

    const dueToday =
        withFollowUp.filter(
            (q) =>
                q.followUp === today
        ).length;

    const upcoming =
        withFollowUp.filter(
            (q) =>
                q.followUp > today
        ).length;

    return (
        <div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

                <div className="bg-white rounded-xl p-5 shadow-sm text-center">

                    <p className="text-sm text-gray-400 mb-1">
                        Overdue
                    </p>

                    <p className="text-2xl font-bold text-red-500">
                        {overdue}
                    </p>

                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm text-center">

                    <p className="text-sm text-gray-400 mb-1">
                        Today
                    </p>

                    <p className="text-2xl font-bold text-orange-500">
                        {dueToday}
                    </p>

                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm text-center">

                    <p className="text-sm text-gray-400 mb-1">
                        Upcoming
                    </p>

                    <p className="text-2xl font-bold text-green-500">
                        {upcoming}
                    </p>

                </div>

            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">

                <table className="w-full text-sm">

                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">

                            <th className="py-3 px-4 font-medium">
                                Date
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Customer
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Phone
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Assigned To
                            </th>

                            <th className="py-3 px-4 font-medium">
                                Status
                            </th>

                        </tr>
                    </thead>

                    <tbody>

                        {withFollowUp.map(
                            (q) => (
                                <tr
                                    key={q.id}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >

                                    <td className="py-3 px-4 text-gray-600">
                                        {q.followUp}
                                    </td>

                                    <td className="py-3 px-4 text-gray-800 font-medium">
                                        {q.customer}
                                    </td>

                                    <td className="py-3 px-4 text-gray-600">
                                        {q.contact}
                                    </td>

                                    <td className="py-3 px-4">

                                        {q.assignedToName ? (
                                            <span className="text-blue-600 font-medium">
                                                {
                                                    q.assignedToName
                                                }
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">
                                                Unassigned
                                            </span>
                                        )}

                                    </td>

                                    <td className="py-3 px-4">

                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                statusStyles[
                                                    q.status
                                                ] ||
                                                "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {q.status}
                                        </span>

                                    </td>

                                </tr>
                            )
                        )}

                    </tbody>

                </table>

                {withFollowUp.length ===
                    0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">

                        <Inbox
                            size={32}
                            className="mb-2"
                        />

                        <p className="text-sm">
                            No follow-ups found.
                        </p>

                    </div>
                )}

            </div>

        </div>
    );
}

// ============================================================
// MAIN PAGE
// ============================================================

function SalesQuery() {
    const {
        salesQueries,
        refreshSalesQueries,
        currentUser,
    } = useOutletContext();

    const [activeTab, setActiveTab] =
        useState("queries");

    const tabs = [
        {
            key: "dashboard",
            label: "Dashboard",
            icon: Gauge,
        },
        {
            key: "queries",
            label: "Sales Queries",
            icon: SearchIcon,
        },
        {
            key: "customers",
            label: "Customers",
            icon: Users,
        },
        {
            key: "followups",
            label: "Follow-ups",
            icon: CalendarClock,
        },
    ];

    return (
        <div>

            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mb-6">
                <Briefcase size={22} />
                Sales Query
            </h1>

            <div className="bg-white rounded-xl shadow-sm p-5">

                <div className="flex items-center gap-6 border-b border-gray-200 mb-5">

                    {tabs.map(
                        (tab) => (
                            <button
                                key={tab.key}
                                onClick={() =>
                                    setActiveTab(
                                        tab.key
                                    )
                                }
                                className={`flex items-center gap-1.5 text-sm font-medium pb-3 border-b-2 transition-colors ${
                                    activeTab ===
                                    tab.key
                                        ? "text-orange-600 border-orange-500"
                                        : "text-gray-400 border-transparent hover:text-gray-600"
                                }`}
                            >
                                <tab.icon
                                    size={15}
                                />

                                {
                                    tab.label
                                }
                            </button>
                        )
                    )}

                </div>

                {activeTab ===
                    "dashboard" && (
                    <DashboardTab
                        queries={
                            salesQueries
                        }
                    />
                )}

                {activeTab ===
                    "queries" && (
                    <SalesQueriesTab
                        queries={
                            salesQueries
                        }
                        refreshSalesQueries={
                            refreshSalesQueries
                        }
                        currentUser={
                            currentUser
                        }
                    />
                )}

                {activeTab ===
                    "customers" && (
                    <CustomersTab
                        queries={
                            salesQueries
                        }
                    />
                )}

                {activeTab ===
                    "followups" && (
                    <FollowUpsTab
                        queries={
                            salesQueries
                        }
                    />
                )}

            </div>
        </div>
    );
}

export default SalesQuery;