// src/pages/Profile.jsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { IdCard, Hash, Briefcase, Building2 } from "lucide-react";
import ProfileAvatar from "../components/ui/ProfileAvatar";

import PersonalDetailsTab from "../components/profile/PersonalDetailsTab";
import ChangePasswordTab from "../components/profile/ChangePasswordTab";
import QRCodeTab from "../components/profile/QRCodeTab";
import SalarySlipTab from "../components/profile/SalarySlipTab";
import HolidaysTab from "../components/profile/HolidaysTab";
import MyAssetsTab from "../components/profile/MyAssetsTab";
import DocumentsTab from "../components/profile/DocumentsTab";

const tabs = [
    { key: "profile", label: "Profile" },
    { key: "password", label: "Change Password" },
    { key: "qr", label: "QR Code" },
    { key: "salary", label: "Salary Slip" },
    { key: "holidays", label: "Holidays" },
    { key: "assets", label: "My Assets" },
    { key: "documents", label: "Documents" },
];

function InfoBox({ icon: Icon, label, value }) {
    return (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 min-w-[150px]">
            <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-orange-500 shrink-0">
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{value || "—"}</p>
            </div>
        </div>
    );
}

function Profile() {
    const { currentUser } = useOutletContext();
    const [activeTab, setActiveTab] = useState("profile");

    if (!currentUser) return null;

    // Reshape currentUser (flat, from the database) into the same nested
    // shape the tab components were originally built to expect.
    const profile = {
        personalDetails: {
            dob: currentUser.dateOfBirth,
            gender: currentUser.gender,
            bloodGroup: currentUser.bloodGroup,
            maritalStatus: currentUser.maritalStatus,
            nationality: currentUser.nationality,
        },
        address: {
            current: currentUser.currentAddress,
            permanent: currentUser.permanentAddress,
        },
        jobDetails: {
            employeeCode: currentUser.code,
            designation: currentUser.designation,
            department: currentUser.department,
            employmentType: currentUser.employmentType,
            dateOfJoining: currentUser.joinDate,
            workLocation: currentUser.location,
        },
        reportingManager: {
            name: currentUser.reportingManager,
            designation: currentUser.reportingManagerDesignation,
            email: currentUser.reportingManagerEmail,
        },
        bankDetails: {
            accountHolder: currentUser.bankAccountHolder,
            bankName: currentUser.bankName,
            accountNumber: currentUser.bankAccountNumber,
            ifsc: currentUser.bankIfsc,
        },
        emergencyContact: {
            name: currentUser.emergencyContactName,
            relation: currentUser.emergencyContactRelation,
            phone: currentUser.emergencyContactPhone,
        },
        phone: currentUser.phone,
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Greeting-style header card */}
            <div className="bg-white border-l-4 border-orange-500 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                    <ProfileAvatar fullName={currentUser.fullName} size="w-16 h-16" textSize="text-2xl" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{currentUser.fullName}</h1>
                        <p className="text-gray-500 text-sm">{currentUser.email}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <InfoBox icon={IdCard} label="Role" value={currentUser.role === "admin" ? "Admin" : "Employee"} />
                    <InfoBox icon={Hash} label="Employee Code" value={currentUser.code} />
                    <InfoBox icon={Briefcase} label="Designation" value={currentUser.designation} />
                    <InfoBox icon={Building2} label="Department" value={currentUser.department} />
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-1 px-3 border-b border-gray-100 overflow-x-auto scrollbar-none">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`whitespace-nowrap text-sm font-medium px-4 py-3.5 border-b-2 transition-colors ${
                                activeTab === t.key
                                    ? "text-orange-600 border-orange-500"
                                    : "text-gray-400 border-transparent hover:text-gray-600"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {activeTab === "profile" && <PersonalDetailsTab profile={profile} />}
                    {activeTab === "password" && <ChangePasswordTab currentPassword={currentUser.password} />}
                    {activeTab === "qr" && <QRCodeTab user={currentUser} profile={profile} />}
                    {activeTab === "salary" && <SalarySlipTab fullName={currentUser.fullName} />}
                    {activeTab === "holidays" && <HolidaysTab />}
                    {activeTab === "assets" && <MyAssetsTab user={currentUser} profile={profile} />}
                    {activeTab === "documents" && <DocumentsTab />}
                </div>
            </div>
        </div>
    );
}

export default Profile;