/**
 * MyAssetsTab.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/profile/MyAssetsTab.jsx
import { Laptop, User2 } from "lucide-react";

// Placeholder — replace with a real per-employee asset lookup once assets are backend-driven.
const mockAsset = {
    type: "Laptop",
    model: "Dell Latitude 5440",
    assetId: "SPARSH-AST-0142",
    serialNumber: "DL5440-7729XJ",
    assignedOn: "05 June 2026",
    condition: "Good",
};

function Detail({ label, value }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400">{label}</span>
            <span className="text-sm font-medium text-gray-800">{value}</span>
        </div>
    );
}

function MyAssetsTab({ user, profile }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-xl">
            <h3 className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-5">
                <Laptop size={16} className="text-orange-500" />
                My Assets
            </h3>

            <div className="flex items-center gap-3 bg-orange-50 rounded-xl p-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Laptop size={22} className="text-orange-500" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-900">{mockAsset.model}</p>
                    <p className="text-xs text-gray-500">{mockAsset.type} · {mockAsset.assetId}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1">Asset Details</p>
                    <Detail label="Serial Number" value={mockAsset.serialNumber} />
                    <Detail label="Assigned On" value={mockAsset.assignedOn} />
                    <Detail label="Condition" value={mockAsset.condition} />
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1 flex items-center gap-1.5">
                        <User2 size={11} /> Assigned To
                    </p>
                    <Detail label="Employee" value={user.fullName} />
                    <Detail label="Employee Code" value={profile?.jobDetails?.employeeCode} />
                    <Detail label="Department" value={profile?.jobDetails?.department} />
                </div>
            </div>
        </div>
    );
}

export default MyAssetsTab;
