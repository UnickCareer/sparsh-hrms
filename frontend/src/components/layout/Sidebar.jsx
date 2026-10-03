// src/components/layout/Sidebar.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    CalendarCheck,
    FileText,
    CheckSquare,
    MessageCircle,
    Users,
    DollarSign,
    MapPin,
    Wrench,
    ClipboardList,
    Settings,
    ChevronDown,
} from "lucide-react";

const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard", hoverClass: "group-hover:scale-[1.12]" },
    { name: "Attendance", icon: CalendarCheck, path: "/attendance", hoverClass: "group-hover:animate-calendar-flip" },
    { name: "Leaves", icon: FileText, path: "/leaves", hoverClass: "group-hover:animate-bounce-soft" },
    { name: "Tasks", icon: CheckSquare, path: "/tasks", hoverClass: "group-hover:scale-[1.12]" },
    { name: "Chat", icon: MessageCircle, path: "/chat", hoverClass: "group-hover:animate-wobble" },
    { name: "Visitors", icon: Users, path: "/visitors", hoverClass: "group-hover:scale-[1.12]" },
    { name: "Sales Query", icon: DollarSign, path: "/sales-query", hoverClass: "group-hover:animate-bounce-soft" },
    { name: "Visit Map", icon: MapPin, path: "/visit-map", hoverClass: "group-hover:animate-bounce-soft" },
    { name: "IT", icon: Wrench, path: "/it", hoverClass: "group-hover:animate-swing" },
    { name: "Performance Review", icon: ClipboardList, path: "/performance-review", hoverClass: "group-hover:scale-[1.12]" },
];

function Sidebar({ collapsed }) {
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <aside
            className={`h-screen bg-[#0f172a] text-gray-300 flex flex-col fixed left-0 top-0 transition-all duration-300 ${
                collapsed ? "w-20" : "w-64"
            }`}
        >
            <div className="px-6 py-5 border-b border-white/10 overflow-hidden whitespace-nowrap">
                <h1 className="text-xl font-bold text-white">
                    {collapsed ? (
                        <span className="text-orange-500">SH</span>
                    ) : (
                        <>
                            Sparsh <span className="text-orange-500">Hub</span>
                        </>
                    )}
                </h1>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        style={{ perspective: "400px" }}
                        className={({ isActive }) =>
                            `group flex items-center gap-3 px-6 py-2.5 text-sm transition-colors whitespace-nowrap overflow-hidden ${
                                isActive
                                    ? "bg-orange-500/10 text-orange-400 border-l-4 border-orange-500"
                                    : "hover:bg-white/5 hover:text-white border-l-4 border-transparent"
                            }`
                        }
                    >
                        <item.icon
                            size={18}
                            style={item.name === "Attendance" ? { transformOrigin: "top" } : undefined}
                            className={`shrink-0 transition-transform duration-500 ${item.hoverClass}`}
                        />
                        {!collapsed && item.name}
                    </NavLink>
                ))}
            </nav>

            {/* Settings - expandable */}
            <div className="border-t border-white/10 py-4">
                <button
                    onClick={() => setSettingsOpen((prev) => !prev)}
                    className="group w-full flex items-center justify-between px-6 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <span className="flex items-center gap-3">
                        <Settings
                            size={18}
                            className="shrink-0 transition-transform duration-500 group-hover:rotate-180"
                        />
                        {!collapsed && "Settings"}
                    </span>
                    {!collapsed && (
                        <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
                        />
                    )}
                </button>

                {settingsOpen && !collapsed && (
                    <div className="pl-6 animate-fadeIn">
                        <NavLink
                            to="/settings/chat"
                            className={({ isActive }) =>
                                `block px-6 py-2 text-xs transition-colors ${
                                    isActive ? "text-orange-400" : "text-gray-400 hover:text-white"
                                }`
                            }
                        >
                            Chat Settings
                        </NavLink>
                    </div>
                )}
            </div>
        </aside>
    );
}

export default Sidebar;