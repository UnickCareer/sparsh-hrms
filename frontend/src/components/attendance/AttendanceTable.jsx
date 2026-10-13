/**
 * AttendanceTable.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/attendance/AttendanceTable.jsx
// src/components/attendance/AttendanceTable.jsx
const STANDARD_IN = 9 * 60 + 30;

function isCompanyOff(date) {
    const day = date.getDay();
    if (day === 0) return true;
    if (day === 6) {
        const occurrence = Math.ceil(date.getDate() / 7);
        if (occurrence === 2 || occurrence === 4) return true;
    }
    return false;
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function formatDiff(inTime) {
    if (!inTime) return "-";
    const diffMinutes = STANDARD_IN - timeToMinutes(inTime);
    const sign = diffMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(diffMinutes);
    const h = String(Math.floor(abs / 60)).padStart(2, "0");
    const m = String(abs % 60).padStart(2, "0");
    return `${sign}${h}:${m}`;
}

const statusLabel = {
    present: { code: "P", color: "text-green-600" },
    late: { code: "L", color: "text-orange-600" },
    absent: { code: "A", color: "text-red-600" },
    "on leave": { code: "SL", color: "text-blue-600" },
};

const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// records: { [day]: { status, in, out } }
function AttendanceTable({ year, month, records }) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const rows = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = new Date(year, month, day);
        const off = isCompanyOff(date);
        const rec = records[day];

        let status, inTime, outTime, diff;

        if (off) {
            status = { code: "WO", color: "text-orange-600" };
            inTime = "-"; outTime = "-"; diff = "-";
        } else if (rec) {
            status = statusLabel[rec.status] || statusLabel.present;
            inTime = rec.in || "-";
            outTime = rec.out || "-";
            diff = rec.in ? formatDiff(rec.in) : "-";
        } else if (date < todayMidnight) {
            status = statusLabel.absent;
            inTime = "-"; outTime = "-"; diff = "-";
        } else {
            status = { code: "-", color: "text-gray-400" };
            inTime = "-"; outTime = "-"; diff = "-";
        }

        return {
            day,
            dateLabel: `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`,
            weekday: weekdayShort[date.getDay()],
            isSunday: date.getDay() === 0,
            off, inTime, outTime, diff, status,
        };
    });

    const rowBg = (row) => {
        if (row.off) return "bg-orange-50/50";
        if (row.status.code === "A") return "bg-red-50/50";
        if (row.status.code === "SL") return "bg-blue-50/50";
        if (row.status.code === "P" || row.status.code === "L") return "bg-green-50/30";
        return "bg-white";
    };

    return (
        <div className="overflow-x-auto rounded-xl shadow-sm">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-blue-600 text-white text-left">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Day</th>
                        <th className="px-4 py-3 font-medium">In Time</th>
                        <th className="px-4 py-3 font-medium">Out Time</th>
                        <th className="px-4 py-3 font-medium">Diff</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.day} className={`${rowBg(row)} border-b border-gray-100 hover:bg-gray-100/70 transition-colors`}>
                            <td className="px-4 py-2.5 text-gray-700">{row.dateLabel}</td>
                            <td className={`px-4 py-2.5 ${row.isSunday ? "text-orange-600 font-medium" : "text-gray-700"}`}>{row.weekday}</td>
                            <td className="px-4 py-2.5 text-gray-700">{row.inTime}</td>
                            <td className="px-4 py-2.5 text-gray-700">{row.outTime}</td>
                            <td className={`px-4 py-2.5 font-medium ${row.diff.startsWith("+") ? "text-green-600" : row.diff.startsWith("-") ? "text-red-600" : "text-gray-400"}`}>
                                {row.diff}
                            </td>
                            <td className={`px-4 py-2.5 font-semibold ${row.status.color}`}>{row.status.code}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AttendanceTable;