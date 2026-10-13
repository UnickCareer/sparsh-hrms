/**
 * Topbar.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/layout/Topbar.jsx

import { Link } from "react-router-dom";
import {
    Menu,
    Users,
    Moon,
    MessageSquare,
} from "lucide-react";

import ProfileDropdown from "./ProfileDropdown";
import NotificationsPanel from "../topbar/NotificationsPanel";

function TopbarIcon({
    icon: Icon,
    label,
    to,
    onClick,
    animateClass,
}) {
    const content = (
        <div className="relative group">
            <Icon
                size={20}
                className={`text-gray-500 cursor-pointer hover:text-gray-800 transition-transform duration-300 ${
                    animateClass || ""
                }`}
            />

            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                {label}
            </span>
        </div>
    );

    if (to) {
        return (
            <Link to={to}>
                {content}
            </Link>
        );
    }

    return (
        <div onClick={onClick}>
            {content}
        </div>
    );
}

function Topbar({
    user,
    collapsed,
    onToggleSidebar,

    announcements,

    pendingLeavesCount,
    pendingLeavesList,
    recentDecidedLeaves,
    unseenDecisionsCount,
    onMarkLeaveDecisionSeen,

    pendingTaskReviewsCount,
    pendingTaskReviewsList,
    myDecidedAssignments,
    teammateApprovals,
    taskCompletions,
    taskNotificationsUnreadCount,

    onMarkAssignmentSeen,
    onMarkTeammateApprovalSeen,
    onMarkTaskCompletionSeen,

    // ============================================================
    // SALES QUERY NOTIFICATIONS
    // ============================================================

    salesQueryNotifications = [],
    salesQueryNotificationsUnreadCount = 0,
    onMarkSalesQuerySeen,
}) {
    return (
        <header
            className={`h-16 bg-white flex items-center justify-between px-6 border-b border-gray-200 transition-all duration-300 ${
                collapsed
                    ? "ml-20"
                    : "ml-64"
            }`}
        >
            {/* Hamburger */}
            <div className="relative group">
                <Menu
                    size={22}
                    className="text-gray-600 cursor-pointer hover:text-gray-900 transition-transform duration-300 group-hover:scale-110"
                    onClick={onToggleSidebar}
                />

                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                    Toggle Sidebar
                </span>
            </div>

            <div className="flex items-center gap-6">

                <TopbarIcon
                    icon={Users}
                    label="Phone Directory"
                    to="/directory"
                    animateClass="group-hover:scale-110"
                />

                <TopbarIcon
                    icon={Moon}
                    label="Toggle Theme"
                    animateClass="group-hover:animate-wobble"
                />

                <TopbarIcon
                    icon={MessageSquare}
                    label="Chat"
                    to="/chat"
                    animateClass="group-hover:animate-bounce-soft"
                />

                <NotificationsPanel
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
                        onMarkLeaveDecisionSeen
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
                        onMarkAssignmentSeen
                    }

                    onMarkTeammateApprovalSeen={
                        onMarkTeammateApprovalSeen
                    }

                    onMarkTaskCompletionSeen={
                        onMarkTaskCompletionSeen
                    }

                    // ====================================================
                    // SALES QUERY
                    // ====================================================

                    salesQueryNotifications={
                        salesQueryNotifications
                    }

                    salesQueryNotificationsUnreadCount={
                        salesQueryNotificationsUnreadCount
                    }

                    onMarkSalesQuerySeen={
                        onMarkSalesQuerySeen
                    }
                />

                <ProfileDropdown
                    user={user}
                />
            </div>
        </header>
    );
}

export default Topbar;