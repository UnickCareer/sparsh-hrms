/**
 * MyAssetsPanel.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/dashboard/MyAssetsPanel.jsx
import { Wrench } from "lucide-react";

function MyAssetsPanel() {
    // Temporary mock - no real assets data yet
    const assets = [];

    return (
        <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-gray-900 font-semibold">
                    <Wrench size={18} />
                    My Assets
                </h2>
                <button className="text-blue-600 text-sm font-medium hover:underline">
                    View
                </button>
            </div>

            {assets.length === 0 ? (
                <p className="text-gray-400 text-sm">No assets assigned</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {/* future: map over real assets here */}
                </div>
            )}
        </div>
    );
}

export default MyAssetsPanel;