/**
 * MonthYearPicker.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/ui/MonthYearPicker.jsx
import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthYearPicker({ year, month, onChange }) {
    const [open, setOpen] = useState(false);
    const [level, setLevel] = useState("month"); // "decade" | "year" | "month"
    const [decadeStart, setDecadeStart] = useState(Math.floor(year / 10) * 10);
    const [tempYear, setTempYear] = useState(year);
    const containerRef = useRef(null);

    const today = new Date();

    // Close popover when clicking outside it
    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function openPicker() {
        setTempYear(year);
        setDecadeStart(Math.floor(year / 10) * 10);
        setLevel("month");
        setOpen(true);
    }

    function handlePrevNext(direction) {
        if (level === "decade") {
            setDecadeStart((prev) => prev + direction * 10);
        } else if (level === "year") {
            setDecadeStart((prev) => prev + direction * 10);
        } else {
            // month level - move by year, keep same month
            const newYear = tempYear + direction;
            setTempYear(newYear);
        }
    }

    function handleHeaderClick() {
        if (level === "month") setLevel("year");
        else if (level === "year") setLevel("decade");
    }

    function handleYearPick(y) {
        setTempYear(y);
        setLevel("month");
    }

    function handleMonthPick(m) {
        onChange(tempYear, m);
        setOpen(false);
    }

    function handleToday() {
        onChange(today.getFullYear(), today.getMonth());
        setOpen(false);
    }

    const headerLabel =
        level === "month"
            ? tempYear
            : level === "year"
            ? `${decadeStart} - ${decadeStart + 9}`
            : "";

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    readOnly
                    onClick={openPicker}
                    value={`${String(month + 1).padStart(2, "0")}-${year}`}
                    className="w-32 px-3 py-2 pr-9 rounded-lg border border-gray-300 text-sm text-gray-700 outline-none cursor-pointer hover:border-orange-400 transition-colors"
                />
                <CalendarIcon
                    size={16}
                    onClick={openPicker}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                />
            </div>

            {open && (
                <div className="absolute z-20 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-3 animate-[fadeIn_0.15s_ease-out]">
                    {/* Header: << label >> */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => handlePrevNext(-1)}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <button
                            onClick={handleHeaderClick}
                            disabled={level === "decade"}
                            className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors px-2 py-1 rounded-md hover:bg-orange-50 disabled:hover:bg-transparent disabled:hover:text-gray-900"
                        >
                            {headerLabel}
                        </button>

                        <button
                            onClick={() => handlePrevNext(1)}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* DECADE level */}
                    {level === "decade" && (
                        <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i).map((y) => {
                                const isOutOfDecade = y < decadeStart || y > decadeStart + 9;
                                return (
                                    <button
                                        key={y}
                                        onClick={() => {
                                            setDecadeStart(Math.floor(y / 10) * 10);
                                            setTempYear(y);
                                            setLevel("year");
                                        }}
                                        className={`py-2 rounded-lg text-sm transition-all duration-150 hover:scale-105 ${
                                            isOutOfDecade
                                                ? "text-gray-300 hover:bg-gray-50"
                                                : y === tempYear
                                                ? "bg-orange-500 text-white font-semibold"
                                                : "text-gray-700 hover:bg-orange-50"
                                        }`}
                                    >
                                        {y}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* YEAR level (12 months of tempYear... actually shows years within decade) */}
                    {level === "year" && (
                        <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 10 }, (_, i) => decadeStart + i).map((y) => (
                                <button
                                    key={y}
                                    onClick={() => handleYearPick(y)}
                                    className={`py-2 rounded-lg text-sm transition-all duration-150 hover:scale-105 ${
                                        y === tempYear
                                            ? "bg-orange-500 text-white font-semibold"
                                            : "text-gray-700 hover:bg-orange-50"
                                    }`}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* MONTH level */}
                    {level === "month" && (
                        <div className="grid grid-cols-3 gap-2">
                            {monthShort.map((m, index) => {
                                const isCurrentSelection = tempYear === year && index === month;
                                const isRealToday =
                                    tempYear === today.getFullYear() && index === today.getMonth();

                                return (
                                    <button
                                        key={m}
                                        onClick={() => handleMonthPick(index)}
                                        className={`py-2 rounded-lg text-sm transition-all duration-150 hover:scale-105 ${
                                            isCurrentSelection
                                                ? "bg-orange-500 text-white font-semibold"
                                                : isRealToday
                                                ? "text-orange-600 font-semibold hover:bg-orange-50"
                                                : "text-gray-700 hover:bg-orange-50"
                                        }`}
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer: Today shortcut */}
                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-center">
                        <button
                            onClick={handleToday}
                            className="text-xs font-medium text-orange-600 hover:underline"
                        >
                            Jump to Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MonthYearPicker;