import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import { LogIn, LogOut, CheckCircle2, Loader2, MapPin } from "lucide-react";

const LATE_REASONS = ["Traffic", "Personal emergency", "Public transport delay", "Medical appointment", "Other"];

function AttendanceWidget() {
    const { currentUser } = useOutletContext();
    const [today, setToday] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showLateModal, setShowLateModal] = useState(false);
    const [pendingLocation, setPendingLocation] = useState(null);
    const [locationReady, setLocationReady] = useState(false);
    const [lateReason, setLateReason] = useState("");
    const [customReason, setCustomReason] = useState("");

    useEffect(() => {
        fetchTodayStatus();
    }, []);

    async function fetchTodayStatus() {
        const res = await fetch(`/api/attendance/${currentUser.id}/today`);
        const data = await res.json();
        if (data.success) setToday(data.attendance);
    }

    function getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject("Geolocation not supported");
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                }),
                (err) => reject(err.message),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }

    async function fetchLocation() {
        const { latitude, longitude } = await getLocation();
        const res = await fetch(`/api/attendance/reverse-geocode?lat=${latitude}&lng=${longitude}`);
        const data = await res.json();
        return {
            latitude,
            longitude,
            location_name: data.success ? data.location_name : "Unknown location",
            district: data.success ? data.district : null,
            state: data.success ? data.state : null,
        };
    }

    function handleCheckInClick() {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const isLate = nowMinutes > 9 * 60 + 30;

        if (isLate) {
            setShowLateModal(true);
            setLocationReady(false);
            setPendingLocation(null);
            resolveLocationInBackground();
            return;
        }

        checkInOnTime();
    }

    async function resolveLocationInBackground() {
        try {
            const location = await fetchLocation();
            setPendingLocation(location);
            setLocationReady(true);
        } catch (err) {
            toast.error(typeof err === "string" ? err : "Could not get your location");
            setShowLateModal(false);
        }
    }

    async function checkInOnTime() {
        setLoading(true);
        try {
            const location = await fetchLocation();
            await submitCheckIn(location, null);
        } catch (err) {
            toast.error(typeof err === "string" ? err : "Could not get your location");
            setLoading(false);
        }
    }

    async function submitCheckIn(location, reason) {
        setLoading(true);
        const res = await fetch("/api/attendance/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: currentUser.id,
                latitude: location.latitude,
                longitude: location.longitude,
                location_name: location.location_name,
                district: location.district,
                state: location.state,
                late_reason: reason,
            }),
        });
        const data = await res.json();
        setLoading(false);
        if (!data.success) return toast.error(data.message);
        toast.success("Checked in!");
        setToday(data.attendance);
        setShowLateModal(false);
        setLateReason("");
        setCustomReason("");
    }

    async function handleCheckOutClick() {
        setLoading(true);
        const res = await fetch("/api/attendance/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: currentUser.id }),
        });
        const data = await res.json();
        setLoading(false);
        if (!data.success) return toast.error(data.message);
        toast.success("Checked out!");
        setToday(data.attendance);
    }

    const finalReason = lateReason === "Other" ? customReason.trim() : lateReason;
    const canSubmitLate = finalReason && locationReady && !loading;

    return (
        <div className="flex flex-col items-end gap-2">
            {!today?.check_in && (
                <button
                    onClick={handleCheckInClick}
                    disabled={loading}
                    className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 pl-3.5 pr-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                    )}
                    <span className="relative">{loading ? "Locating..." : "Check In"}</span>
                    <LogIn size={13} className="relative" />
                </button>
            )}

            {today?.check_in && !today?.check_out && (
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            In&nbsp;<span className="font-bold">{today.check_in}</span>
                        </div>
                        <button
                            onClick={handleCheckOutClick}
                            disabled={loading}
                            className="group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-orange-500/25 transition-all duration-200 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                        >
                            {loading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                            {loading ? "..." : "Check Out"}
                        </button>
                    </div>
                    {today.location_name && (
                        <span className="flex max-w-55 items-center gap-1 truncate text-xs font-medium text-gray-500 mr-3 mt-3">
                            <MapPin size={13} className="shrink-0 text-gray-400" strokeWidth={2.25} />
                            {today.location_name}
                        </span>
                    )}
                </div>
            )}

            {today?.check_out && (
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-medium text-gray-600 shadow-sm">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span>In <span className="font-semibold text-gray-700">{today.check_in}</span></span>
                        <span className="text-gray-300">•</span>
                        <span>Out <span className="font-semibold text-gray-700">{today.check_out}</span></span>
                    </div>
                    {today.location_name && (
                        <span className="flex max-w-55 items-center gap-1 truncate text-xs font-medium text-gray-500 mr-3 mt-3">
                            <MapPin size={13} className="shrink-0 text-gray-400" strokeWidth={2.25} />
                            {today.location_name}
                        </span>
                    )}
                </div>
            )}

            {showLateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="w-80 rounded-2xl bg-white p-5 shadow-2xl animate-scaleIn">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                {locationReady ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
                            </span>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-800">You're checking in late</h4>
                                <p className="text-[11px] text-gray-500">Please select a reason to continue.</p>
                            </div>
                        </div>

                        <select
                            value={lateReason}
                            onChange={(e) => {
                                setLateReason(e.target.value);
                                if (e.target.value !== "Other") setCustomReason("");
                            }}
                            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        >
                            <option value="">Select a reason</option>
                            {LATE_REASONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        {lateReason === "Other" && (
                            <input
                                type="text"
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="Please specify your reason"
                                autoFocus
                                className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                            />
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowLateModal(false);
                                    setLateReason("");
                                    setCustomReason("");
                                }}
                                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => submitCheckIn(pendingLocation, finalReason)}
                                disabled={!canSubmitLate}
                                className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition-all hover:shadow-orange-500/40 disabled:opacity-50"
                            >
                                {!locationReady ? "Locating..." : loading ? "..." : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AttendanceWidget;