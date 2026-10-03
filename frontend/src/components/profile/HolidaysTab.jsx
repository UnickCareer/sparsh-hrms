// src/components/profile/HolidaysTab.jsx
import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import mockHolidays from "../../data/mockHolidays";

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const availableYears = [2024, 2025, 2026, 2027];

function pad(n) {
    return String(n).padStart(2, "0");
}

function HolidaysTab() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState(2026);
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

    const holidaysThisYear = mockHolidays[selectedYear] || [];
    const holidayMap = new Map(holidaysThisYear.map((h) => [h.date, h]));

    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startOffset = firstDayOfMonth.getDay();
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();

    const leadingCells = Array.from({ length: startOffset }, (_, i) => ({
        day: prevMonthDays - startOffset + i + 1,
        type: "prev",
    }));
    const currentCells = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        type: "current",
    }));
    const totalSoFar = leadingCells.length + currentCells.length;
    const trailingCount = (7 - (totalSoFar % 7)) % 7;
    const trailingCells = Array.from({ length: trailingCount }, (_, i) => ({
        day: i + 1,
        type: "next",
    }));
    const calendarCells = [...leadingCells, ...currentCells, ...trailingCells];

    function goToAdjacentMonth(direction) {
        let newMonth = selectedMonth + direction;
        let newYear = selectedYear;
        if (newMonth < 0) {
            newMonth = 11;
            newYear -= 1;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear += 1;
        }
        if (availableYears.includes(newYear)) {
            setSelectedMonth(newMonth);
            setSelectedYear(newYear);
        }
    }

    const isToday = (day, type) =>
        type === "current" &&
        day === today.getDate() &&
        selectedMonth === today.getMonth() &&
        selectedYear === today.getFullYear();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar — takes the same footprint as the Dashboard calendar */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 text-gray-900 font-semibold text-sm">
                        <CalendarDays size={16} className="text-orange-500" />
                        Holiday Calendar
                    </h3>
                    <div className="flex items-center gap-3">
                        <button onClick={() => goToAdjacentMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-medium text-gray-800 w-32 text-center">
                            {monthNames[selectedMonth]} {selectedYear}
                        </span>
                        <button onClick={() => goToAdjacentMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 text-center text-[11px] text-gray-400 font-medium mb-1">
                    {weekdays.map((d) => (
                        <div key={d}>{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((cell, i) => {
                        const dateStr =
                            cell.type === "current"
                                ? `${selectedYear}-${pad(selectedMonth + 1)}-${pad(cell.day)}`
                                : null;
                        const holiday = dateStr ? holidayMap.get(dateStr) : null;

                        return (
                            <div
                                key={i}
                                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs relative ${
                                    cell.type !== "current"
                                        ? "text-gray-300"
                                        : holiday
                                        ? holiday.type === "National"
                                            ? "bg-orange-50 text-orange-700 font-semibold"
                                            : "bg-blue-50 text-blue-700 font-semibold"
                                        : isToday(cell.day, cell.type)
                                        ? "bg-orange-500 text-white font-semibold"
                                        : "text-gray-700 hover:bg-gray-50"
                                }`}
                                title={holiday ? holiday.name : undefined}
                            >
                                {cell.day}
                                {holiday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-current" />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Year picker + holiday list */}
            <div className="flex flex-col gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-2">Select Year</p>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none focus:border-orange-400"
                    >
                        {availableYears.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                        Public Holidays — Delhi/NCR ({selectedYear})
                    </p>
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto scrollbar-none">
                        {holidaysThisYear.map((h) => (
                            <div
                                key={h.date}
                                className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2"
                            >
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{h.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" })}
                                    </p>
                                </div>
                                <span
                                    className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                                        h.type === "National"
                                            ? "bg-orange-100 text-orange-700"
                                            : "bg-blue-100 text-blue-700"
                                    }`}
                                >
                                    {h.type}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HolidaysTab;
