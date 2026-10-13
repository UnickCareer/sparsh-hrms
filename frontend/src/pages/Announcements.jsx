/**
 * Announcements.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/Announcements.jsx
import { useOutletContext } from "react-router-dom";
import { Megaphone } from "lucide-react";

function Announcements() {
    const { announcements } = useOutletContext();

    return (
        <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mb-6">
                <Megaphone size={22} />
                Announcements
            </h1>

            <div className="flex flex-col gap-4">
                {announcements.map((a) => (
                    <div key={a.id} className="bg-white rounded-xl shadow-sm p-5">
                        <div className="flex items-start justify-between">
                            <p className="text-base font-semibold text-gray-900">
                                {a.emoji} {a.title}
                            </p>
                            <span className="text-sm text-gray-400 whitespace-nowrap">{a.date}</span>
                        </div>
                        <p className="text-gray-600 text-sm mt-2 leading-relaxed">{a.message}</p>
                        <span className="inline-block mt-3 text-xs font-medium text-gray-500 border border-gray-300 px-2.5 py-1 rounded-full">
                            {a.location || "All"}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Announcements;