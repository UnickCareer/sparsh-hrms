// src/pages/Attendance.jsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import MonthYearPicker from "../components/ui/MonthYearPicker";
import AttendanceTable from "../components/attendance/AttendanceTable";

function isCompanyOff(date) {
    const day = date.getDay();
    if (day === 0) return true;
    if (day === 6) {
        const occurrence = Math.ceil(date.getDate() / 7);
        if (occurrence === 2 || occurrence === 4) return true;
    }
    return false;
}

function Attendance() {
    const { currentUser } = useOutletContext();
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [hasSearched, setHasSearched] = useState(false);
    const [records, setRecords] = useState({});
    const [loading, setLoading] = useState(false);

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let presentCount = 0, absentCount = 0, leaveCount = 0, weekOffCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        if (isCompanyOff(date)) { weekOffCount++; continue; }
        const rec = records[day];
        if (rec) {
            if (rec.status === "present" || rec.status === "late") presentCount++;
            if (rec.status === "on leave") leaveCount++;
        } else if (date < todayMidnight) {
            absentCount++;
        }
    }

    function handleDateChange(year, month) {
        setSelectedYear(year);
        setSelectedMonth(month);
        setHasSearched(false);
    }

    async function handleSearch() {
        setLoading(true);
        const res = await fetch(`/api/attendance/${currentUser.id}?month=${selectedMonth + 1}&year=${selectedYear}`);
        const data = await res.json();
        const map = {};
        if (data.success) {
            data.attendance.forEach((r) => {
                // date_str is a plain "YYYY-MM-DD" string from the backend — no timezone conversion risk
                const day = Number(r.date_str.split("-")[2]);
                map[day] = {
                    status: (r.status || "present").toLowerCase(),
                    in: r.check_in ? r.check_in.slice(0, 5) : null,
                    out: r.check_out ? r.check_out.slice(0, 5) : null,
                };
            });
        }
        setRecords(map);
        setLoading(false);
        setHasSearched(true);
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Attendance</h1>
            <p className="text-orange-600 text-sm font-medium border-b-2 border-orange-500 inline-block pb-2 mb-6">
                My Attendance
            </p>

            <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <MonthYearPicker year={selectedYear} month={selectedMonth} onChange={handleDateChange} />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </div>

                {hasSearched && (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">Present: {presentCount}</span>
                            <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">Absent: {absentCount}</span>
                            <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">Leave: {leaveCount}</span>
                            <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">WO: {weekOffCount}</span>
                            <span className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">Total Days: {daysInMonth}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Present</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" /> Absent</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" /> Leave</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-300" /> Weekly Off</span>
                            <span className="text-green-600 font-medium">+ = Over</span>
                            <span className="text-red-600 font-medium">- = Under 9:30</span>
                        </div>

                        <AttendanceTable year={selectedYear} month={selectedMonth} records={records} />
                    </>
                )}

                {!hasSearched && (
                    <p className="text-gray-400 text-sm text-center py-10">
                        Select a month and year, then click Search to view attendance.
                    </p>
                )}
            </div>
        </div>
    );
}

export default Attendance;