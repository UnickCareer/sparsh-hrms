/**
 * PersonalDetailsTab.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/profile/PersonalDetailsTab.jsx
import { User2, MapPin, Briefcase, Users, Landmark, Phone } from "lucide-react";

function Section({ icon: Icon, title, children }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-4">
                <Icon size={16} className="text-orange-500" />
                {title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>
        </div>
    );
}

function Field({ label, value }) {
    return (
        <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">{label}</p>
            <p className="text-sm text-gray-800 font-medium">{value || "—"}</p>
        </div>
    );
}

function PersonalDetailsTab({ profile }) {
    if (!profile) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
                No profile record found for this employee yet.
            </div>
        );
    }

    const { personalDetails, address, jobDetails, reportingManager, bankDetails, emergencyContact, phone } = profile;

    return (
        <div className="flex flex-col gap-5">
            <Section icon={User2} title="Personal Details">
                <Field label="Date of Birth" value={personalDetails.dob} />
                <Field label="Gender" value={personalDetails.gender} />
                <Field label="Blood Group" value={personalDetails.bloodGroup} />
                <Field label="Marital Status" value={personalDetails.maritalStatus} />
                <Field label="Nationality" value={personalDetails.nationality} />
                <Field label="Phone" value={phone} />
            </Section>

            <Section icon={MapPin} title="Address">
                <Field label="Current Address" value={address.current} />
                <Field label="Permanent Address" value={address.permanent} />
            </Section>

            <Section icon={Briefcase} title="Job Details">
                <Field label="Employee Code" value={jobDetails.employeeCode} />
                <Field label="Designation" value={jobDetails.designation} />
                <Field label="Department" value={jobDetails.department} />
                <Field label="Employment Type" value={jobDetails.employmentType} />
                <Field label="Date of Joining" value={jobDetails.dateOfJoining} />
                <Field label="Work Location" value={jobDetails.workLocation} />
            </Section>

            <Section icon={Users} title="Reporting Manager">
                <Field label="Name" value={reportingManager.name} />
                <Field label="Designation" value={reportingManager.designation} />
                <Field label="Email" value={reportingManager.email} />
            </Section>

            <Section icon={Landmark} title="Bank Details">
                <Field label="Account Holder" value={bankDetails.accountHolder} />
                <Field label="Bank Name" value={bankDetails.bankName} />
                <Field label="Account Number" value={bankDetails.accountNumber} />
                <Field label="IFSC Code" value={bankDetails.ifsc} />
            </Section>

            <Section icon={Phone} title="Emergency Contact">
                <Field label="Name" value={emergencyContact.name} />
                <Field label="Relation" value={emergencyContact.relation} />
                <Field label="Phone" value={emergencyContact.phone} />
            </Section>
        </div>
    );
}

export default PersonalDetailsTab;
