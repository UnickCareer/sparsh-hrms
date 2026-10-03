// src/components/dashboard/AttendanceCalendar.jsx
import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { useOutletContext } from "react-router-dom";

const statusStyles = {
    present: { label: "present", dot: "bg-green-500", chip: "bg-green-500 text-white" },
    late: { label: "late", dot: "bg-orange-500", chip: "bg-orange-500 text-white" },
    absent: { label: "absent", dot: "bg-red-500", chip: "bg-red-500 text-white" },
    "week off": { label: "week off", dot: "bg-gray-300", chip: "bg-gray-200 text-gray-500" },
};

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isCompanyOff(date) {
    const day = date.getDay();
    if (day === 0) return true;
    if (day === 6) {
        const occurrence = Math.ceil(date.getDate() / 7);
        if (occurrence === 2 || occurrence === 4) return true;
    }
    return false;
}

function AttendanceCalendar() {
    const { currentUser } = useOutletContext();
    const [viewMode, setViewMode] = useState("month");
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [records, setRecords] = useState({}); // { [day]: { status, in, out } }
    const [loading, setLoading] = useState(false);

    const today = new Date();
    const availableYears = [2024, 2025, 2026, 2027];

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);
        fetch(`/api/attendance/${currentUser.id}?month=${selectedMonth + 1}&year=${selectedYear}`)
            .then((res) => res.json())
            .then((data) => {
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
            })
            .finally(() => setLoading(false));
    }, [currentUser, selectedMonth, selectedYear]);

    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startOffset = firstDayOfMonth.getDay();

    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();
    const leadingCells = Array.from({ length: startOffset }, (_, i) => ({
        day: prevMonthDays - startOffset + i + 1,
        type: "prev",
    }));
    const currentCells = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, type: "current" }));
    const totalSoFar = leadingCells.length + currentCells.length;
    const trailingCount = (7 - (totalSoFar % 7)) % 7;
    const trailingCells = Array.from({ length: trailingCount }, (_, i) => ({ day: i + 1, type: "next" }));
    const calendarCells = [...leadingCells, ...currentCells, ...trailingCells];

    function goToAdjacentMonth(direction) {
        let newMonth = selectedMonth + direction;
        let newYear = selectedYear;
        if (newMonth < 0) { newMonth = 11; newYear -= 1; }
        else if (newMonth > 11) { newMonth = 0; newYear += 1; }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    }

    function handleCellClick(cell) {
        if (cell.type === "prev") goToAdjacentMonth(-1);
        if (cell.type === "next") goToAdjacentMonth(1);
    }

    function getCellStatus(cellDate, off) {
        if (off) return statusStyles["week off"];
        const rec = records[cellDate.getDate()];
        if (rec) return statusStyles[rec.status] || statusStyles.present;
        if (cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
            return statusStyles.absent;
        }
        return null;
    }

    return (
        <div className="bg-white rounded-xl p-5 shadow-sm w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Calendar size={18} />
                    My Attendance — {viewMode === "month" ? monthNames[selectedMonth] : ""} {selectedYear}
                    {loading && <span className="text-xs font-normal text-gray-400">loading…</span>}
                </h2>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {Object.values(statusStyles).map((s) => (
                    <span key={s.label} className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${s.chip}`}>
                        {s.label}
                    </span>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3 mb-4">
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none"
                >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>

                {viewMode === "month" && (
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none"
                    >
                        {monthShort.map((m, index) => <option key={m} value={index}>{m}</option>)}
                    </select>
                )}

                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setViewMode("month")}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "month" ? "text-orange-600 bg-orange-50" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => setViewMode("year")}
                        className={`px-3 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${viewMode === "year" ? "text-orange-600 bg-orange-50" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                        Year
                    </button>
                </div>
            </div>

            {viewMode === "month" && (
                <>
                    <div className="grid grid-cols-7 text-center text-gray-500 text-sm font-medium mb-2">
                        {weekdays.map((d) => <div key={d}>{d}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-y-1">
                        {calendarCells.map((cell, index) => {
                            const isCurrentMonth = cell.type === "current";
                            const isAdjacent = !isCurrentMonth;
                            const cellDate = isCurrentMonth ? new Date(selectedYear, selectedMonth, cell.day) : null;
                            const isToday = cellDate && cellDate.toDateString() === today.toDateString();
                            const off = isCurrentMonth ? isCompanyOff(cellDate) : false;
                            const rec = isCurrentMonth ? records[cell.day] : null;
                            const status = isCurrentMonth ? getCellStatus(cellDate, off) : null;

                            return (
                                <button
                                    key={`${cell.type}-${cell.day}-${index}`}
                                    onClick={() => handleCellClick(cell)}
                                    disabled={isCurrentMonth}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-200 ${
                                        isCurrentMonth ? "cursor-default hover:bg-gray-50 hover:scale-[1.03] hover:shadow-sm" : "cursor-pointer hover:bg-gray-100 hover:scale-[1.03]"
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                                            isToday ? "bg-orange-500 text-white font-semibold" : isAdjacent ? "text-gray-300" : off ? "text-gray-300" : "text-gray-800"
                                        }`}
                                    >
                                        {cell.day}
                                    </div>
                                    {isCurrentMonth && !off && status && <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />}
                                    {isCurrentMonth && !off && rec?.in && (
                                        <span className="text-[10px] text-gray-400 leading-tight">
                                            {rec.in}/{rec.out || "--"}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {viewMode === "year" && (
                <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                    {monthShort.map((m, index) => {
                        const isCurrentMonth = selectedYear === today.getFullYear() && index === today.getMonth();
                        const todayRec = isCurrentMonth ? records[today.getDate()] : null;
                        return (
                            <button
                                key={m}
                                onClick={() => { setSelectedMonth(index); setViewMode("month"); }}
                                className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-200 hover:scale-[1.03] ${
                                    isCurrentMonth ? "bg-orange-500 text-white font-semibold" : "text-gray-800 hover:bg-gray-50"
                                }`}
                            >
                                {m}
                                {isCurrentMonth && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                        <span className="text-[10px] opacity-90">
                                            {todayRec?.in || "--"}/{todayRec?.out || "--"}
                                        </span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default AttendanceCalendar;