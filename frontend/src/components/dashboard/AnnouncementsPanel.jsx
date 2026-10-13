/**
 * AnnouncementsPanel.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/dashboard/AnnouncementsPanel.jsx
import { useOutletContext } from "react-router-dom";

function AnnouncementsPanel() {
    const { announcements } = useOutletContext();
    return (
        <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-gray-900 font-semibold mb-4">Latest Announcements</h2>

            <div className="flex flex-col gap-4 ">
                {announcements.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div>
                            <p className="text-gray-900 text-sm font-semibold">
                                {item.emoji} {item.title}
                            </p>
                            <p className="text-gray-500 text-sm mt-0.5">{item.message}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{item.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AnnouncementsPanel;