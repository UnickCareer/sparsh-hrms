// src/components/visitmap/RouteMapMock.jsx
import { useState } from "react";
import { MapPin } from "lucide-react";

function RouteMapMock({ visits, showRoutes }) {
    const [activeVisit, setActiveVisit] = useState(null);

    if (visits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <MapPin size={36} className="mb-3" />
                <p className="text-sm">No GPS visits found for the selected period.</p>
            </div>
        );
    }

    // Build a polyline path string connecting each visit's x/y in order
    const pathPoints = visits.map((v) => `${v.x},${v.y}`).join(" ");

    return (
        <div className="relative w-full h-[420px] rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
            {/* Faint grid backdrop for a "map" feel */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                {Array.from({ length: 10 }, (_, i) => (
                    <line key={`v-${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#94a3b8" strokeWidth="0.2" />
                ))}
                {Array.from({ length: 10 }, (_, i) => (
                    <line key={`h-${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#94a3b8" strokeWidth="0.2" />
                ))}
            </svg>

            {/* Route line connecting visits */}
            {showRoutes && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline
                        points={pathPoints}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="0.6"
                        strokeDasharray="2 1.5"
                        strokeLinecap="round"
                        className="animate-[dash_2s_linear_infinite]"
                    />
                </svg>
            )}

            {/* Pins */}
            {visits.map((visit, index) => (
                <button
                    key={visit.id}
                    onClick={() => setActiveVisit(visit.id === activeVisit ? null : visit.id)}
                    style={{ left: `${visit.x}%`, top: `${visit.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-full group"
                >
                    <div className="relative flex flex-col items-center">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg transition-transform duration-200 hover:scale-125 ${
                                activeVisit === visit.id ? "bg-orange-600 scale-125" : "bg-orange-500"
                            }`}
                        >
                            {index + 1}
                        </div>
                        <div className="w-0.5 h-3 bg-orange-500" />

                        {activeVisit === visit.id && (
                            <div className="absolute bottom-full mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-3 text-left animate-scaleIn z-10">
                                <p className="text-sm font-semibold text-gray-900">{visit.employee}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{visit.location}</p>
                                <p className="text-xs text-orange-600 font-medium mt-1">{visit.time}</p>
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}

export default RouteMapMock;