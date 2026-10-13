/**
 * VisitMap.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/VisitMap.jsx
import { useState } from "react";
import { MapPin, Users, Car, Navigation } from "lucide-react";
import mockVisits from "../data/mockVisits";
import RouteMapMock from "../components/visitmap/RouteMapMock";
import DateRangePicker from "../components/ui/DateRangePicker.jsx";

const rangeOptions = ["Today", "Yesterday", "This Week", "This Month", "This Year"];

function StatCard({ label, value, icon: Icon }) {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-gray-400 text-sm mb-2">{label}</p>

            <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
                <Icon size={18} className="text-orange-500" />
                {value}
            </div>
        </div>
    );
}

function VisitMap() {
    const [activeRange, setActiveRange] = useState("Today");
    const [showRoutes, setShowRoutes] = useState(true);

    const [startDate, setStartDate] = useState(new Date(2026, 6, 20));
    const [endDate, setEndDate] = useState(new Date(2026, 6, 20));

    function handleDateChange(start, end) {
        setStartDate(start);
        setEndDate(end);
        setActiveRange("");
    }

    const visits = activeRange === "Today" ? mockVisits : [];

    const uniqueEmployees = new Set(
        visits.map((v) => v.employee)
    ).size;

    // Calculate total claimed KM
    const claimedKm = visits.reduce(
        (total, visit) => total + (visit.claimedKm || 0),
        0
    );

    // Calculate total road KM
    const roadKm = visits.reduce(
        (total, visit) => total + (visit.roadKm || 0),
        0
    );

    return (
        <div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <MapPin size={22} />
                    Visit Map
                </h1>

                <div className="flex flex-wrap items-center gap-2">
                    {rangeOptions.map((range) => (
                        <button
                            key={range}
                            onClick={() => setActiveRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 hover:scale-105 ${
                                activeRange === range
                                    ? "bg-orange-500 border-orange-500 text-white"
                                    : "bg-white border-gray-300 text-gray-600 hover:border-orange-300"
                            }`}
                        >
                            {range}
                        </button>
                    ))}

                    <DateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onChange={handleDateChange}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard
                    label="Visits"
                    value={visits.length}
                    icon={MapPin}
                />

                <StatCard
                    label="Employees"
                    value={uniqueEmployees}
                    icon={Users}
                />

                <StatCard
                    label="Claimed KM"
                    value={`${claimedKm.toFixed(1)} km`}
                    icon={Car}
                />

                <StatCard
                    label="Road KM (OSRM)"
                    value={`${roadKm.toFixed(1)} km`}
                    icon={Navigation}
                />
            </div>

            {/* Route toggle */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600">
                    Route lines
                </span>

                <button
                    type="button"
                    onClick={() => setShowRoutes((prev) => !prev)}
                    aria-label="Toggle route lines"
                    aria-pressed={showRoutes}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                        showRoutes
                            ? "bg-orange-500"
                            : "bg-gray-300"
                    }`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                            showRoutes
                                ? "translate-x-5"
                                : "translate-x-0"
                        }`}
                    />
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-2">
                <RouteMapMock
                    visits={visits}
                    showRoutes={showRoutes}
                />
            </div>
        </div>
    );
}

export default VisitMap;