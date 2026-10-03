// src/components/profile/SalarySlipTab.jsx
import { useState } from "react";
import { Receipt, Download, FileText } from "lucide-react";

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const years = [2024, 2025, 2026];

// Mock salary breakdown — same shape returned regardless of month for now.
// Swap this for a real per-month lookup once payroll data exists.
function buildMockSlip(fullName, month, year) {
    const basic = 42000;
    const hra = 16800;
    const allowances = 6200;
    const gross = basic + hra + allowances;
    const pf = 2400;
    const tax = 1800;
    const deductions = pf + tax;
    const net = gross - deductions;

    return { fullName, month, year, basic, hra, allowances, gross, pf, tax, deductions, net };
}

function Row({ label, value, bold }) {
    return (
        <div className={`flex items-center justify-between py-2 ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>
            <span className="text-sm">{label}</span>
            <span className="text-sm">₹{value.toLocaleString("en-IN")}</span>
        </div>
    );
}

function SalarySlipTab({ fullName }) {
    const [month, setMonth] = useState("");
    const [year, setYear] = useState(2026);

    const slip = month ? buildMockSlip(fullName, month, year) : null;

    return (
        <div className="flex flex-col gap-5 max-w-lg">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-4">
                    <Receipt size={16} className="text-orange-500" />
                    Salary Slip
                </h3>

                <div className="flex gap-3">
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="flex-1 h-11 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none focus:border-orange-400"
                    >
                        <option value="">Select month</option>
                        {months.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-28 h-11 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none focus:border-orange-400"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!slip && (
                <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                    <FileText size={26} className="mx-auto mb-2 text-gray-300" />
                    Select a month above to load that month's salary slip.
                </div>
            )}

            {slip && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-semibold text-gray-900 text-sm">{slip.fullName}</p>
                            <p className="text-xs text-gray-400">Salary Slip — {slip.month} {slip.year}</p>
                        </div>
                        <button className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700">
                            <Download size={14} />
                            Download
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-2">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mt-2 mb-1">Earnings</p>
                        <Row label="Basic Salary" value={slip.basic} />
                        <Row label="HRA" value={slip.hra} />
                        <Row label="Other Allowances" value={slip.allowances} />
                        <div className="border-t border-gray-100 my-1" />
                        <Row label="Gross Salary" value={slip.gross} bold />
                    </div>

                    <div className="border-t border-gray-100 pt-2 mt-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mt-2 mb-1">Deductions</p>
                        <Row label="Provident Fund" value={slip.pf} />
                        <Row label="Tax (TDS)" value={slip.tax} />
                        <div className="border-t border-gray-100 my-1" />
                        <Row label="Total Deductions" value={slip.deductions} bold />
                    </div>

                    <div className="border-t border-gray-100 pt-3 mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">Net Pay</span>
                        <span className="text-lg font-bold text-green-600">
                            ₹{slip.net.toLocaleString("en-IN")}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SalarySlipTab;
