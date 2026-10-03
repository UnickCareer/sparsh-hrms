// src/components/profile/DocumentsTab.jsx
import { FileSpreadsheet, FileText, Download } from "lucide-react";

// Placeholder paths — see note below the cards for where to put the real files.
const documents = [
    {
        name: "Company HR Policy",
        type: "PDF",
        icon: FileText,
        color: "text-red-500 bg-red-50",
        path: "/documents/company-hr-policy.pdf",
        fileName: "company-hr-policy.pdf",
    },
    {
        name: "Employee Handbook",
        type: "XLSX",
        icon: FileSpreadsheet,
        color: "text-green-600 bg-green-50",
        path: "/documents/employee-handbook.xlsx",
        fileName: "employee-handbook.xlsx",
    },
];

function DocumentsTab() {
    return (
        <div className="max-w-xl flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-gray-900 font-semibold text-sm mb-4">Company Documents</h3>
                <div className="flex flex-col gap-3">
                    {documents.map((doc) => (
                        <a
                            key={doc.name}
                            href={doc.path}
                             download={doc.fileName}
                            className="flex items-center justify-between border border-gray-100 rounded-xl p-3.5 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.color}`}>
                                    <doc.icon size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                                    <p className="text-xs text-gray-400">{doc.type} document</p>
                                </div>
                            </div>
                            <Download size={16} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
                        </a>
                    ))}
                </div>
            </div>

            <p className="text-xs text-gray-400 px-1">
                Placeholder links — replace the actual files at{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">public/documents/</code> using the
                exact filenames above, and they'll load automatically.
            </p>
        </div>
    );
}

export default DocumentsTab;
