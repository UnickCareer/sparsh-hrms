// src/components/ui/DateRangePicker.jsx
import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function formatDate(date) {
    if (!date) return "";
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${date.getFullYear()}`;
}

function isSameDay(a, b) {
    return a && b && a.toDateString() === b.toDateString();
}

function DateRangePicker({ startDate, endDate, onChange }) {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(startDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(startDate.getMonth());
    const [tempStart, setTempStart] = useState(startDate);
    const [tempEnd, setTempEnd] = useState(endDate);
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function goToMonth(direction) {
        let newMonth = viewMonth + direction;
        let newYear = viewYear;
        if (newMonth < 0) { newMonth = 11; newYear -= 1; }
        else if (newMonth > 11) { newMonth = 0; newYear += 1; }
        setViewMonth(newMonth);
        setViewYear(newYear);
    }

    function handleDayClick(day) {
        const clicked = new Date(viewYear, viewMonth, day);

        if (!tempStart || (tempStart && tempEnd)) {
            // Starting a fresh selection
            setTempStart(clicked);
            setTempEnd(null);
        } else if (clicked < tempStart) {
            // Clicked before current start - flip
            setTempEnd(tempStart);
            setTempStart(clicked);
        } else {
            setTempEnd(clicked);
        }
    }

    function handleApply() {
        if (tempStart && tempEnd) {
            onChange(tempStart, tempEnd);
            setOpen(false);
        }
    }

    function isInRange(day) {
        if (!tempStart || !tempEnd) return false;
        const d = new Date(viewYear, viewMonth, day);
        return d > tempStart && d < tempEnd;
    }

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = new Date(viewYear, viewMonth, 1).getDay();
    const cells = [
        ...Array(startOffset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:border-orange-400 transition-colors"
            >
                <CalendarIcon size={14} />
                {formatDate(startDate)} → {formatDate(endDate)}
            </button>

            {open && (
                <div className="absolute right-0 z-20 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 p-4 animate-fadeIn">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => goToMonth(-1)}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold text-gray-900">
                            {monthNames[viewMonth]} {viewYear}
                        </span>
                        <button
                            onClick={() => goToMonth(1)}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 text-center text-xs text-gray-400 font-medium mb-1">
                        {weekdays.map((d) => (
                            <div key={d}>{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-1">
                        {cells.map((day, index) => {
                            if (day === null) return <div key={`blank-${index}`} />;

                            const cellDate = new Date(viewYear, viewMonth, day);
                            const isStart = isSameDay(cellDate, tempStart);
                            const isEnd = isSameDay(cellDate, tempEnd);
                            const inRange = isInRange(day);

                            return (
                                <button
                                    key={day}
                                    onClick={() => handleDayClick(day)}
                                    className={`w-9 h-9 rounded-lg text-sm transition-all duration-150 hover:scale-105 ${
                                        isStart || isEnd
                                            ? "bg-orange-500 text-white font-semibold"
                                            : inRange
                                            ? "bg-orange-100 text-orange-700"
                                            : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-400">
                            {tempStart ? formatDate(tempStart) : "Start"} → {tempEnd ? formatDate(tempEnd) : "End"}
                        </span>
                        <button
                            onClick={handleApply}
                            disabled={!tempStart || !tempEnd}
                            className="text-xs font-medium bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DateRangePicker;