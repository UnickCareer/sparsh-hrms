// src/components/topbar/NotificationsPanel.jsx

import {
    useState,
    useRef,
    useEffect,
} from "react";

import {
    useNavigate,
} from "react-router-dom";

import {
    Megaphone,
    Inbox as InboxIcon,
    Clock,
    Bell,
    CheckCircle2,
    XCircle,
    PartyPopper,
    Users,
    BriefcaseBusiness,
    Wrench,
    ClipboardCheck,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";


// ============================================================
// API
// ============================================================

const IT_API =
    "http://localhost:5000/api/it";


// ============================================================
// TIME AGO
// ============================================================

function timeAgo(dateStr) {
    const then = new Date(dateStr);
    const now = new Date();

    if (
        Number.isNaN(
            then.getTime()
        )
    ) {
        return "";
    }

    const diffMinutes =
        Math.floor(
            (now - then) /
                (1000 * 60)
        );

    if (diffMinutes < 1) {
        return "just now";
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
    }

    const diffHours =
        Math.floor(
            diffMinutes / 60
        );

    if (diffHours < 24) {
        return `${diffHours} ${
            diffHours === 1
                ? "hour"
                : "hours"
        } ago`;
    }

    const diffDays =
        Math.floor(
            diffHours / 24
        );

    if (diffDays === 1) {
        return "1 day ago";
    }

    if (diffDays < 30) {
        return `${diffDays} days ago`;
    }

    const months =
        Math.floor(
            diffDays / 30
        );

    if (months === 1) {
        return "a month ago";
    }

    return `${months} months ago`;
}


// ============================================================
// COMPONENT
// ============================================================

function NotificationsPanel({
    announcements,

    pendingLeavesCount = 0,
    pendingLeavesList = [],
    recentDecidedLeaves = [],
    unseenDecisionsCount = 0,
    onMarkLeaveDecisionSeen,

    pendingTaskReviewsCount = 0,
    pendingTaskReviewsList = [],
    myDecidedAssignments = [],
    teammateApprovals = [],
    taskCompletions = [],
    taskNotificationsUnreadCount = 0,

    onMarkAssignmentSeen,
    onMarkTeammateApprovalSeen,
    onMarkTaskCompletionSeen,

    salesQueryNotifications = [],
    salesQueryNotificationsUnreadCount = 0,
    onMarkSalesQuerySeen,
}) {
    const navigate =
        useNavigate();

    // ========================================================
    // AUTH
    // ========================================================

    const { employeeId } =
        useAuth();

    // ========================================================
    // UI STATE
    // ========================================================

    const [open, setOpen] =
        useState(false);

    const [tab, setTab] =
        useState("announcements");

    // ========================================================
    // IT NOTIFICATIONS
    // ========================================================

    const [itNotifications, setITNotifications] =
        useState([]);

    // ========================================================
    // PERFORMANCE NOTIFICATIONS
    // ========================================================

    const [performanceNotifications, setPerformanceNotifications] =
        useState([]);

    const containerRef =
        useRef(null);


    // ============================================================
    // LOAD IT NOTIFICATIONS
    // ============================================================

    async function loadITNotifications() {
        if (!employeeId) {
            setITNotifications([]);
            return;
        }

        try {
            const response =
                await fetch(
                    `${IT_API}/notifications?employeeId=${encodeURIComponent(
                        employeeId
                    )}`,
                    {
                        cache: "no-store",
                    }
                );

            if (!response.ok) {
                return;
            }

            const data =
                await response.json();

            if (
                data.success &&
                Array.isArray(
                    data.notifications
                )
            ) {
                setITNotifications(
                    data.notifications
                );
            }
        } catch (error) {
            console.error(
                "IT notification loading error:",
                error
            );
        }
    }


    // ============================================================
    // LIVE IT NOTIFICATIONS
    // ============================================================

    useEffect(() => {
        if (!employeeId) {
            setITNotifications([]);
            return;
        }

        loadITNotifications();

        const interval =
            setInterval(
                loadITNotifications,
                2000
            );

        return () =>
            clearInterval(
                interval
            );
    }, [employeeId]);


    // ============================================================
    // LOAD PERFORMANCE REVIEW NOTIFICATIONS
    // ============================================================

    async function loadPerformanceNotifications() {
        if (!employeeId) {
            setPerformanceNotifications([]);
            return;
        }

        try {
            const response =
                await fetch(
                    `/api/performance-reviews/notifications/${encodeURIComponent(
                        employeeId
                    )}`,
                    {
                        cache: "no-store",
                    }
                );

            if (!response.ok) {
                console.error(
                    "Performance notification request failed:",
                    response.status
                );

                return;
            }

            const data =
                await response.json();

            if (
                data.success &&
                Array.isArray(
                    data.notifications
                )
            ) {
                setPerformanceNotifications(
                    data.notifications.map(
                        (notification) => ({
                            ...notification,

                            isUnread:
                                notification.isUnread ??
                                !notification.is_read,
                        })
                    )
                );
            }
        } catch (error) {
            console.error(
                "Performance notification loading error:",
                error
            );
        }
    }


    // ============================================================
    // LIVE PERFORMANCE REVIEW NOTIFICATIONS
    // ============================================================

    useEffect(() => {
        if (!employeeId) {
            setPerformanceNotifications([]);
            return;
        }

        // --------------------------------------------------------
        // Load immediately when employee changes / component loads
        // --------------------------------------------------------

        loadPerformanceNotifications();

        // --------------------------------------------------------
        // Poll every 2 seconds for live notifications
        // --------------------------------------------------------

        const interval =
            setInterval(
                loadPerformanceNotifications,
                2000
            );

        return () =>
            clearInterval(
                interval
            );
    }, [employeeId]);


    // ============================================================
    // PERFORMANCE UNREAD COUNT
    // ============================================================

    const performanceNotificationsUnreadCount =
        performanceNotifications.filter(
            (notification) =>
                notification.isUnread
        ).length;


    // ============================================================
    // IT UNREAD COUNT
    // ============================================================

    const itUnreadCount =
        itNotifications.filter(
            (notification) =>
                !notification.is_read
        ).length;


    // ============================================================
    // TOTAL BELL BADGE
    // ============================================================

    const bellBadgeCount =
        pendingLeavesCount +
        unseenDecisionsCount +
        pendingTaskReviewsCount +
        taskNotificationsUnreadCount +
        salesQueryNotificationsUnreadCount +
        performanceNotificationsUnreadCount +
        itUnreadCount;


    const inboxBadgeCount =
        bellBadgeCount;


    // ============================================================
    // REFRESH WHEN OPENING NOTIFICATION PANEL
    // ============================================================

    useEffect(() => {
        if (!open || !employeeId) {
            return;
        }

        // Immediately refresh both server-backed
        // notification systems when the panel opens.

        loadPerformanceNotifications();
        loadITNotifications();
    }, [open, employeeId]);


    // ============================================================
    // CLOSE WHEN CLICKING OUTSIDE
    // ============================================================

    useEffect(() => {
        function handleClickOutside(e) {
            if (
                containerRef.current &&
                !containerRef.current.contains(
                    e.target
                )
            ) {
                setOpen(false);
            }
        }

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () =>
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
    }, []);


    // ============================================================
    // NAVIGATION
    // ============================================================

    function handleViewAll() {
        setOpen(false);

        navigate(
            "/announcements"
        );
    }


    function handleViewPendingApprovals() {
        setOpen(false);

        navigate(
            "/leaves",
            {
                state: {
                    openApprovals: true,
                },
            }
        );
    }


    function handleViewDecidedLeave(
        leaveId
    ) {
        if (
            onMarkLeaveDecisionSeen
        ) {
            onMarkLeaveDecisionSeen(
                leaveId
            );
        }

        setOpen(false);

        navigate(
            "/leaves"
        );
    }


    function handleViewTaskReviews() {
        setOpen(false);

        navigate(
            "/tasks",
            {
                state: {
                    openReviews: true,
                },
            }
        );
    }


    function handleViewMyAssignment(
        assignmentId
    ) {
        if (
            onMarkAssignmentSeen
        ) {
            onMarkAssignmentSeen(
                assignmentId
            );
        }

        setOpen(false);

        navigate(
            "/tasks"
        );
    }


    function handleViewTeammateApproval(
        assignmentId
    ) {
        if (
            onMarkTeammateApprovalSeen
        ) {
            onMarkTeammateApprovalSeen(
                assignmentId
            );
        }

        setOpen(false);

        navigate(
            "/tasks"
        );
    }


    function handleViewTaskCompletion(
        taskId
    ) {
        if (
            onMarkTaskCompletionSeen
        ) {
            onMarkTaskCompletionSeen(
                taskId
            );
        }

        setOpen(false);

        navigate(
            "/tasks"
        );
    }


    function handleViewSalesQuery(
        queryId
    ) {
        if (
            onMarkSalesQuerySeen
        ) {
            onMarkSalesQuerySeen(
                queryId
            );
        }

        setOpen(false);

        navigate(
            "/sales-query"
        );
    }


    // ============================================================
    // PERFORMANCE REVIEW NOTIFICATION CLICK
    // ============================================================

    async function handleViewPerformanceNotification(
        notificationId
    ) {
        if (!notificationId) {
            return;
        }

        try {
            const response =
                await fetch(
                    `/api/performance-reviews/notifications/${notificationId}/read`,
                    {
                        method: "PATCH",
                    }
                );

            if (!response.ok) {
                console.error(
                    "Failed to mark performance notification as read:",
                    response.status
                );
            }
        } catch (error) {
            console.error(
                "Mark performance notification read error:",
                error
            );
        }

        // --------------------------------------------------------
        // Immediately update local UI
        // --------------------------------------------------------

        setPerformanceNotifications(
            (previous) =>
                previous.map(
                    (notification) =>
                        Number(notification.id) ===
                        Number(notificationId)
                            ? {
                                  ...notification,

                                  isUnread: false,

                                  is_read: true,

                                  read_at:
                                      notification.read_at ||
                                      new Date().toISOString(),
                              }
                            : notification
                )
        );

        setOpen(false);

        navigate(
            "/performance-review"
        );
    }


    // ============================================================
    // IT NOTIFICATION CLICK
    // ============================================================

    async function handleViewITNotification(
        notification
    ) {
        try {
            await fetch(
                `${IT_API}/notifications/${notification.id}/read`,
                {
                    method: "PATCH",
                }
            );
        } catch (error) {
            console.error(
                "Mark IT notification read error:",
                error
            );
        }

        setITNotifications(
            (previous) =>
                previous.map(
                    (item) =>
                        Number(item.id) ===
                        Number(notification.id)
                            ? {
                                  ...item,
                                  is_read: true,
                              }
                            : item
                )
        );

        setOpen(false);

        navigate(
            "/it",
            {
                state: {
                    openTicketId:
                        notification.reference_id,
                },
            }
        );
    }


    // ============================================================
    // TABS
    // ============================================================

    const tabs = [
        {
            key: "announcements",
            label: "Announcements",
            icon: Megaphone,
            badge: 0,
        },

        {
            key: "inbox",
            label: "Inbox",
            icon: InboxIcon,
            badge: inboxBadgeCount,
        },

        {
            key: "reminders",
            label: "Reminders",
            icon: Clock,
            badge: 0,
        },
    ];


    // ============================================================
    // INBOX CONTENT CHECK
    // ============================================================

    const hasInboxContent =
        pendingLeavesList.length > 0 ||
        recentDecidedLeaves.length > 0 ||
        pendingTaskReviewsList.length > 0 ||
        myDecidedAssignments.length > 0 ||
        teammateApprovals.length > 0 ||
        taskCompletions.length > 0 ||
        salesQueryNotifications.length > 0 ||
        performanceNotifications.length > 0 ||
        itNotifications.length > 0;


    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div
            className="relative"
            ref={containerRef}
        >

            {/* ==================================================
                BELL
            ================================================== */}

            <button
                type="button"
                onClick={() =>
                    setOpen(
                        (previous) =>
                            !previous
                    )
                }
                className="relative group"
            >
                <Bell
                    size={20}
                    className="mt-1.5 text-gray-500 group-hover:text-gray-800 cursor-pointer transition-transform duration-300 group-hover:animate-bell-ring"
                />

                {bellBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                        {bellBadgeCount > 9
                            ? "9+"
                            : bellBadgeCount}
                    </span>
                )}
            </button>


            {/* ==================================================
                POPUP
            ================================================== */}

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-[420px] max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-fadeIn">

                    {/* ==================================================
                        TABS
                    ================================================== */}

                    <div className="flex items-stretch border-b border-gray-100 px-2 w-full">

                        {tabs.map(
                            (t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() =>
                                        setTab(
                                            t.key
                                        )
                                    }
                                    className={`relative flex items-center justify-center gap-1.5 flex-1 min-w-0 text-sm font-medium px-2 py-3 border-b-2 whitespace-nowrap transition-colors ${
                                        tab ===
                                        t.key
                                            ? "text-orange-600 border-orange-500"
                                            : "text-gray-400 border-transparent hover:text-gray-600"
                                    }`}
                                >
                                    <t.icon
                                        size={15}
                                        className="shrink-0"
                                    />

                                    <span>
                                        {t.label}
                                    </span>

                                    {t.badge >
                                        0 && (
                                        <span className="flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none shrink-0">
                                            {t.badge >
                                            9
                                                ? "9+"
                                                : t.badge}
                                        </span>
                                    )}
                                </button>
                            )
                        )}

                    </div>


                    {/* ==================================================
                        CONTENT
                    ================================================== */}

                    <div className="max-h-[420px] overflow-y-auto p-3 scrollbar-none">


                        {/* ==================================================
                            ANNOUNCEMENTS
                        ================================================== */}

                        {tab ===
                            "announcements" && (
                            <div className="flex flex-col gap-3">

                                {announcements
                                    .slice(
                                        0,
                                        3
                                    )
                                    .map(
                                        (a) => (
                                            <div
                                                key={
                                                    a.id
                                                }
                                                className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                            >
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        a.emoji
                                                    }{" "}
                                                    {
                                                        a.title
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                    {
                                                        a.message
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    {
                                                        a.date
                                                    }
                                                    {" · "}
                                                    {
                                                        a.location ||
                                                        "All"
                                                    }
                                                </p>
                                            </div>
                                        )
                                    )}

                            </div>
                        )}


                        {/* ==================================================
                            INBOX
                        ================================================== */}

                        {tab ===
                            "inbox" && (
                            <div className="flex flex-col gap-3">


                                {/* ==================================================
                                    IT NOTIFICATIONS
                                ================================================== */}

                                {itNotifications.map(
                                    (notification) => (
                                        <button
                                            key={`it-${notification.id}`}
                                            type="button"
                                            onClick={() =>
                                                handleViewITNotification(
                                                    notification
                                                )
                                            }
                                            className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                !notification.is_read
                                                    ? "border-l-4 border-orange-500 bg-orange-50 hover:bg-orange-100"
                                                    : "border border-gray-100 bg-white hover:bg-gray-50"
                                            }`}
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                                                <Wrench
                                                    size={17}
                                                    className="text-orange-600"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        notification.title
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                                    {
                                                        notification.message
                                                    }
                                                </p>

                                                <p className="text-[11px] text-gray-400 mt-1">

                                                    {timeAgo(
                                                        notification.created_at
                                                    )}

                                                    {!notification.is_read && (
                                                        <span className="ml-2 font-semibold text-orange-500">
                                                            New
                                                        </span>
                                                    )}

                                                </p>

                                            </div>
                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    PERFORMANCE REVIEW
                                ================================================== */}

                                {performanceNotifications.map(
                                    (notification) => (
                                        <button
                                            key={`performance-${notification.id}`}
                                            type="button"
                                            onClick={() =>
                                                handleViewPerformanceNotification(
                                                    notification.id
                                                )
                                            }
                                            className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                notification.isUnread
                                                    ? "border-l-4 border-purple-500 bg-purple-50 hover:bg-purple-100"
                                                    : "border border-gray-100 bg-white hover:bg-gray-50"
                                            }`}
                                        >

                                            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                                <ClipboardCheck
                                                    size={17}
                                                    className="text-purple-600"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        notification.title
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                                    {
                                                        notification.message
                                                    }
                                                </p>

                                                <p className="text-[11px] text-gray-400 mt-1">

                                                    {timeAgo(
                                                        notification.created_at
                                                    )}

                                                    {notification.isUnread && (
                                                        <span className="ml-2 font-semibold text-purple-500">
                                                            New
                                                        </span>
                                                    )}

                                                </p>

                                            </div>

                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    SALES QUERY
                                ================================================== */}

                                {salesQueryNotifications.map(
                                    (query) => (
                                        <button
                                            key={`sales-query-${query.id}`}
                                            type="button"
                                            onClick={() =>
                                                handleViewSalesQuery(
                                                    query.id
                                                )
                                            }
                                            className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                query.isUnread
                                                    ? "border-l-4 border-orange-400 bg-orange-50 hover:bg-orange-100"
                                                    : "border border-gray-100 bg-white hover:bg-gray-50"
                                            }`}
                                        >

                                            <BriefcaseBusiness
                                                size={17}
                                                className="text-gray-400 shrink-0"
                                            />

                                            <div className="flex-1 min-w-0">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    New Sales Query assigned to you
                                                </p>

                                                <p className="text-xs text-gray-600 mt-0.5 truncate">
                                                    Customer:{" "}
                                                    {
                                                        query.customer
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Assigned by{" "}
                                                    {
                                                        query.createdByName
                                                    }
                                                </p>

                                                <p className="text-[11px] text-gray-400 mt-1">
                                                    {timeAgo(
                                                        query.updatedAt ||
                                                        query.createdAt
                                                    )}
                                                </p>

                                            </div>

                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    LEAVES - PENDING APPROVALS
                                ================================================== */}

                                {pendingLeavesList.map(
                                    (leave) => (
                                        <button
                                            key={`pending-${leave.id}`}
                                            type="button"
                                            onClick={
                                                handleViewPendingApprovals
                                            }
                                            className="flex items-center gap-3 rounded-lg p-3 text-left border-l-4 border-orange-400 bg-orange-50 hover:bg-orange-100 transition-colors"
                                        >

                                            <Bell
                                                size={16}
                                                className="text-orange-500 shrink-0"
                                            />

                                            <div className="flex-1">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        leave.full_name
                                                    }{" "}
                                                    applied for{" "}
                                                    {
                                                        leave.leave_type
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-500">
                                                    Awaiting your approval
                                                </p>

                                            </div>

                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    LEAVE DECISIONS
                                ================================================== */}

                                {recentDecidedLeaves.map(
                                    (leave) => {
                                        const isApproved =
                                            leave.status ===
                                            "Approved";

                                        return (
                                            <button
                                                key={`decided-${leave.id}`}
                                                type="button"
                                                onClick={() =>
                                                    handleViewDecidedLeave(
                                                        leave.id
                                                    )
                                                }
                                                className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                    leave.isUnread
                                                        ? isApproved
                                                            ? "border-l-4 border-green-400 bg-green-50 hover:bg-green-100"
                                                            : "border-l-4 border-red-400 bg-red-50 hover:bg-red-100"
                                                        : "border border-gray-100 bg-white hover:bg-gray-50"
                                                }`}
                                            >

                                                {isApproved ? (
                                                    <CheckCircle2
                                                        size={16}
                                                        className="text-green-600 shrink-0"
                                                    />
                                                ) : (
                                                    <XCircle
                                                        size={16}
                                                        className="text-red-600 shrink-0"
                                                    />
                                                )}

                                                <div className="flex-1">

                                                    <p className="text-sm font-semibold text-gray-900">
                                                        Your{" "}
                                                        {
                                                            leave.type
                                                        }{" "}
                                                        leave was{" "}
                                                        {
                                                            leave.status.toLowerCase()
                                                        }
                                                    </p>

                                                    <p className="text-xs text-gray-500">
                                                        {
                                                            leave.from
                                                        }

                                                        {leave.from !==
                                                            leave.to
                                                            ? ` - ${leave.to}`
                                                            : ""}
                                                    </p>

                                                </div>

                                            </button>
                                        );
                                    }
                                )}


                                {/* ==================================================
                                    TASK REVIEWS
                                ================================================== */}

                                {pendingTaskReviewsList.map(
                                    (a) => (
                                        <button
                                            key={`task-pending-${a.id}`}
                                            type="button"
                                            onClick={
                                                handleViewTaskReviews
                                            }
                                            className="flex items-center gap-3 rounded-lg p-3 text-left border-l-4 border-orange-400 bg-orange-50 hover:bg-orange-100 transition-colors"
                                        >

                                            <Bell
                                                size={16}
                                                className="text-orange-500 shrink-0"
                                            />

                                            <div className="flex-1">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        a.employee_name
                                                    }{" "}
                                                    submitted work on "
                                                    {
                                                        a.task_title
                                                    }
                                                    "
                                                </p>

                                                <p className="text-xs text-gray-500">
                                                    Awaiting your review
                                                </p>

                                            </div>

                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    TASK DECISIONS
                                ================================================== */}

                                {myDecidedAssignments.map(
                                    (a) => {
                                        const isApproved =
                                            a.status ===
                                            "Approved";

                                        return (
                                            <button
                                                key={`my-assign-${a.assignment_id}`}
                                                type="button"
                                                onClick={() =>
                                                    handleViewMyAssignment(
                                                        a.assignment_id
                                                    )
                                                }
                                                className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                    a.isUnread
                                                        ? isApproved
                                                            ? "border-l-4 border-green-400 bg-green-50 hover:bg-green-100"
                                                            : "border-l-4 border-red-400 bg-red-50 hover:bg-red-100"
                                                        : "border border-gray-100 bg-white hover:bg-gray-50"
                                                }`}
                                            >

                                                {isApproved ? (
                                                    <CheckCircle2
                                                        size={16}
                                                        className="text-green-600 shrink-0"
                                                    />
                                                ) : (
                                                    <XCircle
                                                        size={16}
                                                        className="text-red-600 shrink-0"
                                                    />
                                                )}

                                                <div className="flex-1">

                                                    <p className="text-sm font-semibold text-gray-900">
                                                        Your work on "
                                                        {
                                                            a.taskTitle
                                                        }
                                                        " was{" "}
                                                        {
                                                            isApproved
                                                                ? "approved"
                                                                : "sent back for changes"
                                                        }
                                                    </p>

                                                </div>

                                            </button>
                                        );
                                    }
                                )}


                                {/* ==================================================
                                    TEAMMATE APPROVALS
                                ================================================== */}

                                {teammateApprovals.map(
                                    (a) => (
                                        <button
                                            key={`teammate-${a.assignment_id}`}
                                            type="button"
                                            onClick={() =>
                                                handleViewTeammateApproval(
                                                    a.assignment_id
                                                )
                                            }
                                            className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                a.isUnread
                                                    ? "border-l-4 border-blue-400 bg-blue-50 hover:bg-blue-100"
                                                    : "border border-gray-100 bg-white hover:bg-gray-50"
                                            }`}
                                        >

                                            <Users
                                                size={16}
                                                className="text-blue-500 shrink-0"
                                            />

                                            <div className="flex-1">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        a.full_name
                                                    }'s part on "
                                                    {
                                                        a.taskTitle
                                                    }"
                                                    was approved
                                                </p>

                                            </div>

                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    TASK COMPLETIONS
                                ================================================== */}

                                {taskCompletions.map(
                                    (t) => (
                                        <button
                                            key={`task-complete-${t.id}`}
                                            type="button"
                                            onClick={() =>
                                                handleViewTaskCompletion(
                                                    t.id
                                                )
                                            }
                                            className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                                t.isUnread
                                                    ? "border-l-4 border-purple-400 bg-purple-50 hover:bg-purple-100"
                                                    : "border border-gray-100 bg-white hover:bg-gray-50"
                                            }`}
                                        >

                                            <PartyPopper
                                                size={16}
                                                className="text-purple-500 shrink-0"
                                            />

                                            <div className="flex-1">

                                                <p className="text-sm font-semibold text-gray-900">
                                                    "{t.title}" is fully completed!
                                                </p>

                                                <p className="text-xs text-gray-500">
                                                    Every assignee's work was approved
                                                </p>

                                            </div>

                                        </button>
                                    )
                                )}


                                {/* ==================================================
                                    EMPTY
                                ================================================== */}

                                {!hasInboxContent && (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">

                                        <InboxIcon
                                            size={32}
                                            className="mb-3"
                                        />

                                        <p className="text-sm font-medium">
                                            No notifications yet.
                                        </p>

                                    </div>
                                )}

                            </div>
                        )}


                        {/* ==================================================
                            REMINDERS
                        ================================================== */}

                        {tab ===
                            "reminders" && (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">

                                <Clock
                                    size={32}
                                    className="mb-3"
                                />

                                <p className="text-sm font-medium">
                                    No reminders yet.
                                </p>

                            </div>
                        )}

                    </div>


                    {/* ==================================================
                        ANNOUNCEMENT FOOTER
                    ================================================== */}

                    {tab ===
                        "announcements" && (
                        <div className="border-t border-gray-100 p-3 text-center">

                            <button
                                type="button"
                                onClick={
                                    handleViewAll
                                }
                                className="text-sm font-medium cursor-pointer text-blue-600 hover:underline"
                            >
                                View All / Manage
                            </button>

                        </div>
                    )}

                </div>
            )}

        </div>
    );
}


export default NotificationsPanel;