/**
 * ProfileDropdown.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/layout/ProfileDropdown.jsx
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle2, LogOut, ChevronDown } from "lucide-react";
import ProfileAvatar from "../ui/ProfileAvatar";
import { useAuth } from "../../context/AuthContext";

function ProfileDropdown({ user }) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef(null);
    const navigate = useNavigate();
    const { logout } = useAuth();

    function handleMouseEnter() {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
    }

    function handleMouseLeave() {
        // Small delay so the pointer can travel from avatar to menu without it snapping shut
        closeTimer.current = setTimeout(() => setOpen(false), 200);
    }

    function goToProfile() {
        setOpen(false);
        navigate("/profile");
    }

    function handleLogout() {
        setOpen(false);
        logout();
        navigate("/login", { replace: true });
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button className="flex items-center gap-2 rounded-full pr-1.5 py-1 pl-1 hover:bg-gray-100 transition-colors cursor-pointer">
                <ProfileAvatar fullName={user.fullName} size="w-9 h-9" textSize="text-sm" />
                <span className="text-gray-800 font-medium text-sm">{user.fullName}</span>
                <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>

            <div
                className={`absolute right-0 mt-2 w-60 origin-top-right transition-all duration-150 ${
                    open
                        ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                }`}
            >
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Mini identity header */}
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-white border-b border-gray-100">
                        <ProfileAvatar fullName={user.fullName} size="w-11 h-11" textSize="text-base" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                    </div>

                    <div className="p-1.5">
                        <button
                            onClick={goToProfile}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                        >
                            <UserCircle2 size={17} />
                            Profile
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <LogOut size={17} />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfileDropdown;
