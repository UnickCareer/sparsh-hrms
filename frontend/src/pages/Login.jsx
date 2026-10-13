/**
 * Login.jsx
 *
 * Frontend component/module for HRMS application
 */

import { useState } from "react";
import { User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!identifier.trim() || !password) {
    setError(
      !identifier.trim() && !password
        ? "Enter your email/employee code and password."
        : !identifier.trim()
        ? "Enter your email or employee code."
        : "Enter your password."
    );
    triggerShake();
    return;
  }

  setError("");
  setIsSubmitting(true);

  try {
    const response = await fetch("/api/employees/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    });

    const data = await response.json();

    if (!data.success) {
      setError("Invalid login ID or password. Contact HR if you haven't received your credentials yet.");
      triggerShake();
      setIsSubmitting(false);
      return;
    }

   const employee = data.employee;

  const mappedUser = {
  id: employee.id,
  code: employee.employee_code,
  firstName: employee.first_name,
  lastName: employee.last_name,
  fullName: employee.full_name,
  email: employee.email,
  phone: employee.phone,
  department: employee.department,
  role: employee.role,
  designation: employee.designation,
  reportingManager: employee.reporting_manager,
  location: employee.location,
  joinDate: employee.join_date,
  status: employee.status,
  employmentType: employee.employment_type,
  salary: employee.salary,
  leaveBalance: employee.leave_balance,
  avatar: employee.avatar,
  checkInTime: employee.check_in_time,
  dateOfBirth: employee.date_of_birth,
  gender: employee.gender,
  bloodGroup: employee.blood_group,
  maritalStatus: employee.marital_status,
  nationality: employee.nationality,
  currentAddress: employee.current_address,
  permanentAddress: employee.permanent_address,
  reportingManagerDesignation: employee.reporting_manager_designation,
  reportingManagerEmail: employee.reporting_manager_email,
  bankAccountHolder: employee.bank_account_holder,
  bankName: employee.bank_name,
  bankAccountNumber: employee.bank_account_number,
  bankIfsc: employee.bank_ifsc,
  emergencyContactName: employee.emergency_contact_name,
  emergencyContactRelation: employee.emergency_contact_relation,
  emergencyContactPhone: employee.emergency_contact_phone,
};

login(mappedUser);
navigate("/dashboard");

  } catch (err) {
    console.error(err);
    setError("Something went wrong. Please try again.");
    triggerShake();
    setIsSubmitting(false);
  }
};

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0d1117] flex items-center justify-center px-4">
      {/* Aurora background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#1c2536] blur-[110px] opacity-70 animate-[drift-a_18s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full bg-[#c1521f] blur-[130px] opacity-40 animate-[drift-b_22s_ease-in-out_infinite]" />
        <div className="absolute -bottom-48 left-1/4 w-[480px] h-[480px] rounded-full bg-[#e8792f] blur-[120px] opacity-25 animate-[drift-c_26s_ease-in-out_infinite]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://w3.org' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center">
        {/* Logomark */}
        <div className="mb-5 animate-[fade-up_0.7s_ease-out_both]">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            className="drop-shadow-[0_0_18px_rgba(232,98,42,0.35)]"
          >
            <defs>
              <linearGradient id="swoosh" x1="6" y1="10" x2="58" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#F2934F" />
                <stop offset="1" stopColor="#D8501C" />
              </linearGradient>
            </defs>
            <path
              d="M48 14C40 8 26 8 18 14C11 19 11 27 19 30C27 33 41 31 47 36C54 41 53 50 45 54C36 58.5 22 57 15 51"
              stroke="url(#swoosh)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              className="animate-[draw_1.3s_ease-out_0.15s_both]"
            />
            <circle cx="15" cy="51" r="3.4" fill="#F2934F" className="animate-[dot-in_0.4s_ease-out_1.35s_both]" />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="text-center mb-7 animate-[fade-up_0.7s_ease-out_0.15s_both]">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Sparsh <span className="text-[#F2934F]">Hub</span>
          </h1>
          <p className="mt-1 text-[13px] text-white/45 tracking-wide">
            Human Resource Management System
          </p>
        </div>

        {/* Card */}
        <div
          className={`w-full rounded-2xl bg-white/[0.06] backdrop-blur-xl border shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-7 animate-[fade-up_0.7s_ease-out_0.3s_both] transition-colors ${
            error ? "border-red-500/40" : "border-white/10"
          } ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Identifier field */}
            <div className="relative">
              <label
                htmlFor="identifier"
                className={`absolute left-11 transition-all duration-200 pointer-events-none ${
                  focusedField === "identifier" || identifier
                    ? "-top-2 left-3 text-[11px] px-1 bg-[#161b22] text-[#F2934F] rounded"
                    : "top-1/2 -translate-y-1/2 text-[14px] text-white/40"
                }`}
              >
                Email or employee code
              </label>
              <User
                size={17}
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                  focusedField === "identifier" ? "text-[#F2934F]" : "text-white/30"
                }`}
              />
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError("");
                }}
                onFocus={() => setFocusedField("identifier")}
                onBlur={() => setFocusedField(null)}
                className={`w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border text-white text-[14px] outline-none transition-all focus:bg-white/[0.07] ${
                  error && !identifier.trim()
                    ? "border-red-500/50 focus:border-red-500/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                    : "border-white/10 focus:border-[#F2934F]/60 focus:shadow-[0_0_0_3px_rgba(242,147,79,0.12)]"
                }`}
                autoComplete="username"
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <label
                htmlFor="password"
                className={`absolute left-11 transition-all duration-200 pointer-events-none ${
                  focusedField === "password" || password
                    ? "-top-2 left-3 text-[11px] px-1 bg-[#161b22] text-[#F2934F] rounded"
                    : "top-1/2 -translate-y-1/2 text-[14px] text-white/40"
                }`}
              >
                Password
              </label>
              <Lock
                size={17}
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                  focusedField === "password" ? "text-[#F2934F]" : "text-white/30"
                }`}
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                className={`w-full h-12 pl-11 pr-11 rounded-xl bg-white/[0.04] border text-white text-[14px] outline-none transition-all focus:bg-white/[0.07] ${
                  error && !password
                    ? "border-red-500/50 focus:border-red-500/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                    : "border-white/10 focus:border-[#F2934F]/60 focus:shadow-[0_0_0_3px_rgba(242,147,79,0.12)]"
                }`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-red-400 text-[12px] bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-[fade-in_0.2s_ease-out]">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-2 rounded-xl bg-[#e8622a] hover:bg-[#cf5320] active:scale-[0.98] text-white text-[14px] font-medium shadow-[0_4px_20px_rgba(232,98,42,0.25)] transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
