/**
 * Dashboard.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/Dashboard.jsx  (only the stats-related part shown — rest unchanged)
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, XCircle, FileText, Clock } from "lucide-react";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import AttendanceCalendar from "../components/dashboard/AttendanceCalendar";
import LeaveRequestsPanel from "../components/dashboard/LeaveRequestsPanel";
import MyAssetsPanel from "../components/dashboard/MyAssetsPanel";
import AnnouncementsPanel from "../components/dashboard/AnnouncementsPanel";
import AttendanceWidget from "../components/dashboard/AttendanceWidget";

function getGreeting(hour) {
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
}

function isCompanyOff(date) {
    const day = date.getDay();
    if (day === 0) return true;
    if (day === 6) {
        const occurrence = Math.ceil(date.getDate() / 7);
        if (occurrence === 2 || occurrence === 4) return true;
    }
    return false;
}

function dayFromDateField(dateVal) {
    const iso = typeof dateVal === "string" ? dateVal : new Date(dateVal).toISOString();
    return Number(iso.split("T")[0].split("-")[2]);
}

function StatCard({ label, value, icon: Icon, colorClass }) {
    return (
        <div className={`bg-white border-t-4 ${colorClass.border} rounded-xl p-4 shadow-sm`}>
            <p className="text-gray-500 text-sm mb-2">{label}</p>
            <div className={`flex items-center gap-2 text-xl font-bold ${colorClass.text}`}>
                <Icon size={20} />
                {value}
            </div>
        </div>
    );
}

function AttendanceRing({ percentage }) {
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
                <circle
                    cx="40" cy="40" r={radius} fill="none" stroke="#22c55e" strokeWidth="6"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    transform="rotate(-90 40 40)" className="transition-all duration-700 ease-out"
                />
                <text x="40" y="45" textAnchor="middle" className="text-sm font-bold fill-gray-900">{percentage}%</text>
            </svg>
        </div>
    );
}

function Dashboard() {
    const context = useOutletContext();
    const currentUser = context?.currentUser;
    const [stats, setStats] = useState({ present: 0, absent: 0, onLeave: 0, pendingLeaves: 0, attendancePercentage: 0 });

    useEffect(() => {
        if (!currentUser) return;
        const now = new Date();
        fetch(`/api/attendance/${currentUser.id}?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) return;
                const map = {};
                data.attendance.forEach((r) => { map[dayFromDateField(r.date)] = r; });

                let present = 0, absent = 0;
                for (let day = 1; day <= now.getDate(); day++) {
                    const date = new Date(now.getFullYear(), now.getMonth(), day);
                    if (isCompanyOff(date)) continue;
                    const rec = map[day];
                    if (rec && rec.check_in) present++;
                    else if (day < now.getDate()) absent++;
                }
                const workingSoFar = present + absent;
                const attendancePercentage = workingSoFar > 0 ? Math.round((present / workingSoFar) * 100) : 0;

                setStats((s) => ({ ...s, present, absent, attendancePercentage }));
                // onLeave / pendingLeaves stay 0 until a Leaves API exists
            });
    }, [currentUser]);

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-gray-500 font-medium">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2"></div>
                <p className="text-sm">Initializing Sparsh Hub dashboard profile...</p>
            </div>
        );
    }

    const now = new Date();
    const greeting = getGreeting(now.getHours());
    const formattedDate = now.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const formattedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const firstName = currentUser.fullName ? currentUser.fullName.split(" ")[0] : "Employee";

    return (
        <div>
            <div className="bg-white border-l-4 border-orange-500 rounded-xl p-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center rounded-xl p-2.5 ">
                        <ProfileAvatar fullName={currentUser.fullName} size="w-14 h-14" textSize="text-xl" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{greeting}, {firstName}!</h1>
                        <p className="text-gray-500 text-sm">{formattedDate} • {formattedTime}</p>
                        <p className="text-gray-400 text-sm">{currentUser.designation} · {currentUser.department}</p>
                    </div>
                </div>
                <AttendanceWidget />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
                <StatCard label="Present" value={stats.present} icon={CheckCircle2} colorClass={{ border: "border-green-500", text: "text-green-600" }} />
                <StatCard label="Absent" value={stats.absent} icon={XCircle} colorClass={{ border: "border-red-500", text: "text-red-600" }} />
                <StatCard label="On Leave" value={stats.onLeave} icon={FileText} colorClass={{ border: "border-blue-500", text: "text-blue-600" }} />
                <StatCard label="Pending Leaves" value={stats.pendingLeaves} icon={Clock} colorClass={{ border: "border-orange-500", text: "text-orange-600" }} />
                <AttendanceRing percentage={stats.attendancePercentage} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-stretch">
                <div className="lg:col-span-2 flex">
                    <AttendanceCalendar />
                </div>
                <div className="flex flex-col gap-6">
                    <LeaveRequestsPanel />
                    <MyAssetsPanel />
                    <AnnouncementsPanel />
                </div>
            </div>
        </div>
    );
}

export default Dashboard;