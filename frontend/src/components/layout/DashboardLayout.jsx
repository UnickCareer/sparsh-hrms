// src/components/layout/DashboardLayout.jsx

import {
    useState,
    useEffect,
    useCallback,
} from "react";

import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import mockTickets from "../../data/mockTickets";
import mockAnnouncements from "../../data/mockAnnouncements";

import { useAuth } from "../../context/AuthContext";

function DashboardLayout() {
    const [collapsed, setCollapsed] =
        useState(false);

    const [applications, setApplications] =
        useState([]);

    const [tasks, setTasks] =
        useState([]);

    const [visitors, setVisitors] =
        useState([]);

    const [salesQueries, setSalesQueries] =
        useState([]);

    const [tickets, setTickets] =
        useState(mockTickets);

    const [announcements, setAnnouncements] =
        useState(mockAnnouncements);

    const [pendingLeavesList, setPendingLeavesList] =
        useState([]);

    const [seenLeaveIds, setSeenLeaveIds] =
        useState([]);

    const [pendingTaskReviewsList, setPendingTaskReviewsList] =
        useState([]);

    const [seenAssignmentIds, setSeenAssignmentIds] =
        useState([]);

    const [seenTeammateApprovalIds, setSeenTeammateApprovalIds] =
        useState([]);

    const [seenTaskCompletionIds, setSeenTaskCompletionIds] =
        useState([]);

    // ============================================================
    // SALES QUERY NOTIFICATIONS
    // ============================================================

    const [salesQueryNotifications, setSalesQueryNotifications] =
        useState([]);

    const [
        salesQueryNotificationsUnreadCount,
        setSalesQueryNotificationsUnreadCount,
    ] = useState(0);

    const { currentUser } = useAuth();
    const location = useLocation();

    // ============================================================
    // VISITORS
    // ============================================================

    const refreshVisitors = useCallback(async () => {
        try {
            const res = await fetch(
                "/api/visitors"
            );

            const data = await res.json();

            if (!res.ok || !data.success) {
                console.error(
                    "fetch visitors error:",
                    data.message ||
                        "Failed to fetch visitors"
                );

                return;
            }

            const mappedVisitors =
                data.visitors.map((v) => ({
                    id: v.id,
                    firstName: v.first_name,
                    lastName: v.last_name,
                    company: v.company,
                    mobile: v.mobile,
                    email: v.email,
                    purpose: v.purpose,
                    meetingDate: v.meeting_date
                        ? String(
                              v.meeting_date
                          ).split("T")[0]
                        : "",
                    remarks: v.remarks,
                    status: v.status,
                    createdBy:
                        v.created_by_name ||
                        "-",
                    hostEmployeeId:
                        v.host_employee_id ||
                        null,
                    hostEmployeeName:
                        v.host_employee_name ||
                        "-",
                    checkedInAt:
                        v.checked_in_at ||
                        null,
                    checkedOutAt:
                        v.checked_out_at ||
                        null,
                    checkedInBy:
                        v.checked_in_by_name ||
                        null,
                    checkedOutBy:
                        v.checked_out_by_name ||
                        null,
                    photo: null,
                }));

            setVisitors(mappedVisitors);
        } catch (err) {
            console.error(
                "fetch visitors error:",
                err
            );
        }
    }, []);

    useEffect(() => {
        refreshVisitors();
    }, [refreshVisitors]);

    // ============================================================
    // LOAD LOCAL NOTIFICATION / SEEN STATE
    // ============================================================

    useEffect(() => {
        if (!currentUser?.id) return;

        const storedLeaves =
            localStorage.getItem(
                `leaves_seen_ids_${currentUser.id}`
            );

        setSeenLeaveIds(
            storedLeaves
                ? JSON.parse(storedLeaves)
                : []
        );

        const storedAssign =
            localStorage.getItem(
                `task_assign_seen_${currentUser.id}`
            );

        setSeenAssignmentIds(
            storedAssign
                ? JSON.parse(storedAssign)
                : []
        );

        const storedTeammate =
            localStorage.getItem(
                `task_teammate_seen_${currentUser.id}`
            );

        setSeenTeammateApprovalIds(
            storedTeammate
                ? JSON.parse(
                      storedTeammate
                  )
                : []
        );

        const storedComplete =
            localStorage.getItem(
                `task_complete_seen_${currentUser.id}`
            );

        setSeenTaskCompletionIds(
            storedComplete
                ? JSON.parse(
                      storedComplete
                  )
                : []
        );
    }, [currentUser]);

    // ============================================================
    // SALES QUERIES
    // ============================================================

    const refreshSalesQueries =
        useCallback(async () => {
            try {
                const res = await fetch(
                    "/api/sales-queries"
                );

                const data =
                    await res.json();

                if (
                    !res.ok ||
                    !data.success
                ) {
                    console.error(
                        "fetch sales queries error:",
                        data.message ||
                            "Failed to fetch sales queries"
                    );

                    return;
                }

                const mappedQueries =
                    data.queries.map(
                        (q) => ({
                            id: q.id,

                            date: q.query_date
                                ? String(
                                      q.query_date
                                  ).split(
                                      "T"
                                  )[0]
                                : "",

                            customer:
                                q.customer ||
                                "",

                            contact:
                                q.contact ||
                                "",

                            email:
                                q.email ||
                                "",

                            requirement:
                                q.requirement ||
                                "",

                            meeting:
                                q.meeting_date
                                    ? String(
                                          q.meeting_date
                                      ).split(
                                          "T"
                                      )[0]
                                    : "",

                            primaryAmount:
                                Number(
                                    q.primary_amount
                                ) || 0,

                            secondaryAmount:
                                Number(
                                    q.secondary_amount
                                ) || 0,

                            status:
                                q.status ||
                                "New",

                            followUp:
                                q.follow_up_date
                                    ? String(
                                          q.follow_up_date
                                      ).split(
                                          "T"
                                      )[0]
                                    : "",

                            source:
                                q.source ||
                                "Direct",

                            assignedTo:
                                q.assigned_to ||
                                null,

                            assignedToName:
                                q.assigned_to_name ||
                                "",

                            createdBy:
                                q.created_by ||
                                null,

                            createdByName:
                                q.created_by_name ||
                                "",

                            createdAt:
                                q.created_at ||
                                null,

                            updatedAt:
                                q.updated_at ||
                                null,
                        })
                    );

                setSalesQueries(
                    mappedQueries
                );
            } catch (err) {
                console.error(
                    "fetch sales queries error:",
                    err
                );
            }
        }, []);

    useEffect(() => {
        refreshSalesQueries();
    }, [refreshSalesQueries]);

    // ============================================================
    // LIVE SALES QUERY NOTIFICATIONS
    //
    // Database notification table is checked every 1 second.
    //
    // This means:
    //
    // Employee A assigns
    //        ↓
    // Backend creates notification
    //        ↓
    // Employee B sees it within ~1 second
    //
    // No 10-second delay.
    // ============================================================

    const refreshSalesQueryNotifications =
        useCallback(async () => {
            if (!currentUser?.id) return;

            try {
                const res = await fetch(
                    `/api/sales-queries/notifications/${currentUser.id}`
                );

                const data =
                    await res.json();

                if (
                    !res.ok ||
                    !data.success
                ) {
                    console.error(
                        "fetch sales query notifications error:",
                        data.message ||
                            "Failed to fetch notifications"
                    );

                    return;
                }

                const mapped =
                    (
                        data.notifications ||
                        []
                    ).map((n) => ({
                        id: n.id,

                        salesQueryId:
                            n.sales_query_id,

                        recipientEmployeeId:
                            n.recipient_employee_id,

                        assignedBy:
                            n.assigned_by,

                        assignedByName:
                            n.assigned_by_name ||
                            "",

                        title:
                            n.title ||
                            "New Sales Query assigned to you",

                        message:
                            n.message ||
                            "",

                        customer:
                            n.customer ||
                            "",

                        contact:
                            n.contact ||
                            "",

                        queryStatus:
                            n.query_status ||
                            "",

                        createdAt:
                            n.created_at,

                        readAt:
                            n.read_at,

                        isUnread:
                            !n.read_at,
                    }));

                setSalesQueryNotifications(
                    mapped
                );

                setSalesQueryNotificationsUnreadCount(
                    Number(
                        data.unreadCount
                    ) || 0
                );
            } catch (err) {
                console.error(
                    "refresh sales query notifications error:",
                    err
                );
            }
        }, [currentUser?.id]);

    useEffect(() => {
        if (!currentUser?.id) return;

        refreshSalesQueryNotifications();

        const interval =
            setInterval(() => {
                refreshSalesQueryNotifications();
            }, 1000);

        return () =>
            clearInterval(interval);
    }, [
        currentUser?.id,
        refreshSalesQueryNotifications,
    ]);

    // ============================================================
    // MARK SALES QUERY NOTIFICATION AS READ
    // ============================================================

    const markSalesQuerySeen =
        useCallback(
            async (notificationId) => {
                if (!notificationId) return;

                try {
                    const res =
                        await fetch(
                            `/api/sales-queries/notifications/${notificationId}/read`,
                            {
                                method: "PATCH",
                            }
                        );

                    const data =
                        await res.json();

                    if (
                        !res.ok ||
                        !data.success
                    ) {
                        console.error(
                            "mark sales notification read error:",
                            data.message
                        );

                        return;
                    }

                    // Immediately change UI.
                    setSalesQueryNotifications(
                        (prev) =>
                            prev.map(
                                (notification) =>
                                    notification.id ===
                                    notificationId
                                        ? {
                                              ...notification,
                                              readAt:
                                                  data.notification
                                                      ?.read_at ||
                                                  new Date().toISOString(),
                                              isUnread:
                                                  false,
                                          }
                                        : notification
                            )
                    );

                    setSalesQueryNotificationsUnreadCount(
                        (prev) =>
                            Math.max(
                                0,
                                prev - 1
                            )
                    );
                } catch (err) {
                    console.error(
                        "mark sales notification read error:",
                        err
                    );
                }
            },
            []
        );

    // ============================================================
    // LEAVES
    // ============================================================

    useEffect(() => {
        if (!currentUser?.id) return;

        fetch(
            `/api/leaves/my/${currentUser.id}`
        )
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    const mapped =
                        data.leaves.map(
                            (l) => ({
                                id: l.id,
                                type:
                                    l.leave_type,
                                from: l.start_date.split(
                                    "T"
                                )[0],
                                to: l.end_date.split(
                                    "T"
                                )[0],
                                days: parseFloat(
                                    l.total_days
                                ),
                                reason:
                                    l.reason,
                                status:
                                    l.status,
                                decided_at:
                                    l.decided_at,
                            })
                        );

                    setApplications(
                        mapped
                    );
                }
            })
            .catch((err) =>
                console.error(
                    "fetch leaves error:",
                    err
                )
            );
    }, [currentUser]);

    const recentDecidedLeaves =
        applications
            .filter(
                (l) =>
                    l.status ===
                        "Approved" ||
                    l.status ===
                        "Rejected"
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.decided_at
                    ) -
                    new Date(
                        a.decided_at
                    )
            )
            .slice(0, 5)
            .map((l) => ({
                ...l,
                isUnread:
                    !seenLeaveIds.includes(
                        l.id
                    ),
            }));

    const unseenDecisionsCount =
        recentDecidedLeaves.filter(
            (l) => l.isUnread
        ).length;

    const markLeaveDecisionSeen =
        useCallback(
            (leaveId) => {
                if (!currentUser?.id)
                    return;

                setSeenLeaveIds(
                    (prev) => {
                        if (
                            prev.includes(
                                leaveId
                            )
                        ) {
                            return prev;
                        }

                        const updated = [
                            ...prev,
                            leaveId,
                        ];

                        localStorage.setItem(
                            `leaves_seen_ids_${currentUser.id}`,
                            JSON.stringify(
                                updated
                            )
                        );

                        return updated;
                    }
                );
            },
            [currentUser]
        );

    const refreshPendingLeavesCount =
        useCallback(() => {
            if (
                currentUser?.role !==
                "admin"
            ) {
                setPendingLeavesList(
                    []
                );
                return;
            }

            fetch("/api/leaves")
                .then((res) =>
                    res.json()
                )
                .then((data) => {
                    if (data.success) {
                        setPendingLeavesList(
                            data.leaves.filter(
                                (l) =>
                                    l.status ===
                                    "Pending"
                            )
                        );
                    }
                })
                .catch((err) =>
                    console.error(
                        "fetch pending leaves error:",
                        err
                    )
                );
        }, [currentUser]);

    useEffect(() => {
        refreshPendingLeavesCount();
    }, [refreshPendingLeavesCount]);

    const pendingLeavesCount =
        pendingLeavesList.length;

    // ============================================================
    // TASKS
    // ============================================================

    const refreshMyTasks =
        useCallback(() => {
            if (!currentUser?.id)
                return;

            fetch(
                `/api/tasks/my/${currentUser.id}`
            )
                .then((res) =>
                    res.json()
                )
                .then((data) => {
                    if (data.success) {
                        const mapped =
                            data.tasks.map(
                                (t) => {
                                    const total =
                                        parseInt(
                                            t.total_assignees,
                                            10
                                        ) || 0;

                                    const approved =
                                        parseInt(
                                            t.approved_assignees,
                                            10
                                        ) || 0;

                                    return {
                                        id: t.id,
                                        title:
                                            t.title,
                                        description:
                                            t.description,
                                        category:
                                            t.category ||
                                            "Uncategorized",
                                        priority:
                                            t.priority,
                                        status:
                                            t.status,
                                        start: t.start_date
                                            ? t.start_date.split(
                                                  "T"
                                              )[0]
                                            : "",
                                        end: t.end_date
                                            ? t.end_date.split(
                                                  "T"
                                              )[0]
                                            : "",
                                        createdBy:
                                            t.created_by,
                                        createdByName:
                                            t.created_by_name,
                                        assignments:
                                            t.assignments ||
                                            [],
                                        totalAssignees:
                                            total,
                                        approvedAssignees:
                                            approved,
                                        progressPercent:
                                            total >
                                            0
                                                ? Math.round(
                                                      (approved /
                                                          total) *
                                                          100
                                                  )
                                                : 0,
                                    };
                                }
                            );

                        setTasks(mapped);
                    }
                })
                .catch((err) =>
                    console.error(
                        "fetch tasks error:",
                        err
                    )
                );
        }, [currentUser]);

    useEffect(() => {
        refreshMyTasks();
    }, [refreshMyTasks]);

    const refreshPendingTaskReviews =
        useCallback(() => {
            if (
                currentUser?.role !==
                "admin"
            ) {
                setPendingTaskReviewsList(
                    []
                );
                return;
            }

            fetch(
                "/api/tasks/pending-review"
            )
                .then((res) =>
                    res.json()
                )
                .then((data) => {
                    if (data.success) {
                        setPendingTaskReviewsList(
                            data.assignments
                        );
                    }
                })
                .catch((err) =>
                    console.error(
                        "fetch pending task reviews error:",
                        err
                    )
                );
        }, [currentUser]);

    useEffect(() => {
        refreshPendingTaskReviews();
    }, [
        refreshPendingTaskReviews,
    ]);

    const pendingTaskReviewsCount =
        pendingTaskReviewsList.length;

    const myDecidedAssignments =
        tasks
            .flatMap((t) =>
                t.assignments
                    .filter(
                        (a) =>
                            a.employee_id ===
                                currentUser?.id &&
                            (a.status ===
                                "Approved" ||
                                a.status ===
                                    "Needs Rework") &&
                            a.reviewed_at
                    )
                    .map((a) => ({
                        ...a,
                        taskTitle: t.title,
                    }))
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.reviewed_at
                    ) -
                    new Date(
                        a.reviewed_at
                    )
            )
            .slice(0, 5)
            .map((a) => ({
                ...a,
                isUnread:
                    !seenAssignmentIds.includes(
                        a.assignment_id
                    ),
            }));

    const teammateApprovals =
        tasks
            .flatMap((t) =>
                t.assignments
                    .filter(
                        (a) =>
                            a.employee_id !==
                                currentUser?.id &&
                            a.status ===
                                "Approved" &&
                            a.reviewed_at
                    )
                    .map((a) => ({
                        ...a,
                        taskTitle: t.title,
                    }))
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.reviewed_at
                    ) -
                    new Date(
                        a.reviewed_at
                    )
            )
            .slice(0, 5)
            .map((a) => ({
                ...a,
                isUnread:
                    !seenTeammateApprovalIds.includes(
                        a.assignment_id
                    ),
            }));

    const taskCompletions =
        tasks
            .filter(
                (t) =>
                    t.status ===
                    "Completed"
            )
            .slice(0, 5)
            .map((t) => ({
                ...t,
                isUnread:
                    !seenTaskCompletionIds.includes(
                        t.id
                    ),
            }));

    const taskNotificationsUnreadCount =
        myDecidedAssignments.filter(
            (a) => a.isUnread
        ).length +
        teammateApprovals.filter(
            (a) => a.isUnread
        ).length +
        taskCompletions.filter(
            (t) => t.isUnread
        ).length;

    const markAssignmentSeen =
        useCallback(
            (assignmentId) => {
                if (!currentUser?.id)
                    return;

                setSeenAssignmentIds(
                    (prev) => {
                        if (
                            prev.includes(
                                assignmentId
                            )
                        ) {
                            return prev;
                        }

                        const updated = [
                            ...prev,
                            assignmentId,
                        ];

                        localStorage.setItem(
                            `task_assign_seen_${currentUser.id}`,
                            JSON.stringify(
                                updated
                            )
                        );

                        return updated;
                    }
                );
            },
            [currentUser]
        );

    const markTeammateApprovalSeen =
        useCallback(
            (assignmentId) => {
                if (!currentUser?.id)
                    return;

                setSeenTeammateApprovalIds(
                    (prev) => {
                        if (
                            prev.includes(
                                assignmentId
                            )
                        ) {
                            return prev;
                        }

                        const updated = [
                            ...prev,
                            assignmentId,
                        ];

                        localStorage.setItem(
                            `task_teammate_seen_${currentUser.id}`,
                            JSON.stringify(
                                updated
                            )
                        );

                        return updated;
                    }
                );
            },
            [currentUser]
        );

    const markTaskCompletionSeen =
        useCallback(
            (taskId) => {
                if (!currentUser?.id)
                    return;

                setSeenTaskCompletionIds(
                    (prev) => {
                        if (
                            prev.includes(
                                taskId
                            )
                        ) {
                            return prev;
                        }

                        const updated = [
                            ...prev,
                            taskId,
                        ];

                        localStorage.setItem(
                            `task_complete_seen_${currentUser.id}`,
                            JSON.stringify(
                                updated
                            )
                        );

                        return updated;
                    }
                );
            },
            [currentUser]
        );

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-gray-100">
            <Sidebar
                collapsed={collapsed}
            />

            <Topbar
                user={currentUser}
                collapsed={collapsed}
                onToggleSidebar={() =>
                    setCollapsed(
                        (prev) => !prev
                    )
                }

                announcements={
                    announcements
                }

                pendingLeavesCount={
                    pendingLeavesCount
                }

                pendingLeavesList={
                    pendingLeavesList
                }

                recentDecidedLeaves={
                    recentDecidedLeaves
                }

                unseenDecisionsCount={
                    unseenDecisionsCount
                }

                onMarkLeaveDecisionSeen={
                    markLeaveDecisionSeen
                }

                pendingTaskReviewsCount={
                    pendingTaskReviewsCount
                }

                pendingTaskReviewsList={
                    pendingTaskReviewsList
                }

                myDecidedAssignments={
                    myDecidedAssignments
                }

                teammateApprovals={
                    teammateApprovals
                }

                taskCompletions={
                    taskCompletions
                }

                taskNotificationsUnreadCount={
                    taskNotificationsUnreadCount
                }

                onMarkAssignmentSeen={
                    markAssignmentSeen
                }

                onMarkTeammateApprovalSeen={
                    markTeammateApprovalSeen
                }

                onMarkTaskCompletionSeen={
                    markTaskCompletionSeen
                }

                // SALES QUERY
                salesQueryNotifications={
                    salesQueryNotifications
                }

                salesQueryNotificationsUnreadCount={
                    salesQueryNotificationsUnreadCount
                }

                onMarkSalesQuerySeen={
                    markSalesQuerySeen
                }
            />

            <main
                className={`transition-all duration-300 ${
                    location.pathname === "/chat"
                        ? "p-0"
                        : "p-6"
                } ${
                    collapsed
                        ? "ml-20"
                        : "ml-64"
                }`}
            >
                <Outlet
                    context={{
                        currentUser,

                        applications,
                        setApplications,

                        tasks,
                        setTasks,

                        visitors,
                        setVisitors,
                        refreshVisitors,

                        salesQueries,
                        setSalesQueries,
                        refreshSalesQueries,

                        tickets,
                        setTickets,

                        announcements,
                        setAnnouncements,

                        pendingLeavesCount,
                        refreshPendingLeavesCount,

                        refreshMyTasks,
                        refreshPendingTaskReviews,

                        refreshSalesQueryNotifications,
                    }}
                />
            </main>
        </div>
    );
}

export default DashboardLayout;