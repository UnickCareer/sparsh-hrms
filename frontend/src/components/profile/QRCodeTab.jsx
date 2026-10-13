/**
 * QRCodeTab.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/profile/QRCodeTab.jsx
import { QrCode, Download } from "lucide-react";

const COMPANY_NAME = "Samriddhi Automations Pvt Ltd (Sparsh Hub)";

function QRCodeTab({ user, profile }) {
    // vCard format — this is exactly what makes a phone camera / Google Lens
    // offer "Add Contact" when it scans the code.
    const vCard = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${user.fullName}`,
        `ORG:${COMPANY_NAME}`,
        `TITLE:${profile?.jobDetails?.designation || ""}`,
        `TEL:${profile?.phone || ""}`,
        `EMAIL:${user.email}`,
        "END:VCARD",
    ].join("\n");

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(vCard)}`;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 max-w-md flex flex-col items-center text-center">
            <h3 className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-1 self-start">
                <QrCode size={16} className="text-orange-500" />
                My Contact QR Code
            </h3>
            <p className="text-xs text-gray-400 self-start mb-6">
                Scan with any phone camera to save this contact instantly.
            </p>

            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
                <img src={qrImageUrl} alt="Employee contact QR code" width={220} height={220} className="rounded-lg" />
            </div>

            <p className="text-sm font-semibold text-gray-800 mt-5">{user.fullName}</p>
            <p className="text-xs text-gray-500">{profile?.jobDetails?.designation}</p>
            <p className="text-xs text-gray-400 mt-1">{user.email}</p>

            <a
                href={qrImageUrl}
                download={`${user.fullName.replace(/\s+/g, "-")}-contact-qr.png`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 mt-6 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
                <Download size={15} />
                Download QR Code
            </a>
        </div>
    );
}

export default QRCodeTab;
