import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // Initialize state directly from localStorage
    // so refresh doesn't break the logged-in employee.
    const [currentUser, setCurrentUser] = useState(() => {
        const savedUser = localStorage.getItem("hrms_user");

        if (!savedUser) return null;

        try {
            return JSON.parse(savedUser);
        } catch (error) {
            console.error("Invalid hrms_user data:", error);
            localStorage.removeItem("hrms_user");
            return null;
        }
    });

    const login = (user) => {
        localStorage.setItem("hrms_user", JSON.stringify(user));
        setCurrentUser(user);
    };

    const logout = () => {
        localStorage.removeItem("hrms_user");
        setCurrentUser(null);
    };

    /*
     * Normalize the logged-in employee ID.
     *
     * This supports the possible structures used by the login response:
     *
     * 1. { id: 44, full_name: "..." }
     * 2. { employee_id: 44, ... }
     * 3. { employee: { id: 44, ... } }
     */
    const employeeId =
        currentUser?.id ??
        currentUser?.employee_id ??
        currentUser?.employee?.id ??
        null;

    return (
        <AuthContext.Provider
            value={{
                currentUser,
                employeeId,
                isAuthenticated: !!currentUser,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);

    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    return ctx;
}