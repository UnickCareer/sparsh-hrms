// src/components/profile/ChangePasswordTab.jsx
import { useState } from "react";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

function PasswordField({ label, value, onChange, show, onToggleShow }) {
    return (
        <div>
            <label className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1 block">
                {label}
            </label>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-11 px-3.5 pr-10 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
                <button
                    type="button"
                    onClick={onToggleShow}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                    {show ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
            </div>
        </div>
    );
}

function ChangePasswordTab({ currentPassword }) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNext, setShowNext] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [status, setStatus] = useState(null); // { type: "error" | "success", message }

    function handleSubmit(e) {
        e.preventDefault();

        if (!current || !next || !confirm) {
            setStatus({ type: "error", message: "Fill in all three fields." });
            return;
        }
        if (current !== currentPassword) {
            setStatus({ type: "error", message: "Current password is incorrect." });
            return;
        }
        if (next.length < 8) {
            setStatus({ type: "error", message: "New password must be at least 8 characters." });
            return;
        }
        if (next !== confirm) {
            setStatus({ type: "error", message: "New password and confirmation don't match." });
            return;
        }

        // No backend yet — UI-only confirmation for now
        setStatus({ type: "success", message: "Password updated (mock — not yet persisted to a backend)." });
        setCurrent("");
        setNext("");
        setConfirm("");
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-md">
            <h3 className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-5">
                <KeyRound size={16} className="text-orange-500" />
                Change Password
            </h3>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <PasswordField
                    label="Current Password"
                    value={current}
                    onChange={setCurrent}
                    show={showCurrent}
                    onToggleShow={() => setShowCurrent((v) => !v)}
                />
                <PasswordField
                    label="New Password"
                    value={next}
                    onChange={setNext}
                    show={showNext}
                    onToggleShow={() => setShowNext((v) => !v)}
                />
                <PasswordField
                    label="Confirm New Password"
                    value={confirm}
                    onChange={setConfirm}
                    show={showConfirm}
                    onToggleShow={() => setShowConfirm((v) => !v)}
                />

                {status && (
                    <div
                        className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                            status.type === "error"
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : "bg-green-50 text-green-700 border border-green-100"
                        }`}
                    >
                        {status.type === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                        {status.message}
                    </div>
                )}

                <button
                    type="submit"
                    className="flex items-center justify-center gap-2 h-11 mt-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
                >
                    <KeyRound size={15} />
                    Change Password
                </button>
            </form>
        </div>
    );
}

export default ChangePasswordTab;
