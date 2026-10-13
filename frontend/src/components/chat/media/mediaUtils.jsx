/**
 * mediaUtils.jsx
 *
 * Frontend component/module for HRMS application
 */

// frontend/src/components/chat/media/mediaUtils.jsx
import { useSyncExternalStore } from "react";
import toast from "react-hot-toast";

/* ---------- file helpers ---------- */

export const getExt = (name = "") =>
    name.includes(".") ? name.split(".").pop().toLowerCase() : "";

export function kindOf(mime = "", name = "") {
    const type = String(mime).toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type === "application/pdf" || getExt(name) === "pdf") return "pdf";
    return "doc";
}

export function formatSize(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} kB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const attachmentUrl = (att, employeeId) =>
    `${att.file_url}?employeeId=${employeeId}`;

const EXT_COLORS = {
    pdf: "bg-red-500",
    doc: "bg-blue-500",
    docx: "bg-blue-500",
    xls: "bg-emerald-600",
    xlsx: "bg-emerald-600",
    csv: "bg-emerald-600",
    ppt: "bg-orange-500",
    pptx: "bg-orange-500",
    zip: "bg-yellow-600",
    js: "bg-amber-500",
    txt: "bg-slate-500",
};

/* Small coloured badge showing the file extension ("PDF", "JS" ...) */
export function FileExtIcon({ name = "", size = 40 }) {
    const ext = getExt(name);
    return (
        <div
            className={`flex shrink-0 items-center justify-center rounded-lg font-bold uppercase text-white ${
                EXT_COLORS[ext] || "bg-slate-500"
            }`}
            style={{ width: size, height: size, fontSize: size * 0.28 }}
        >
            {(ext || "file").slice(0, 4)}
        </div>
    );
}

/* ---------- downloads ---------- */

export async function downloadFile(url, name) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export async function saveFileAs(url, name) {
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({ suggestedName: name });
            const res = await fetch(url);
            const blob = await res.blob();
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
            // fall through to normal download
        }
    }
    await downloadFile(url, name);
}

/* ---------- "downloaded on this device" store (receiver side) ---------- */

const KEY = (employeeId) => `sparsh_chat_downloaded_${employeeId}`;
const listeners = new Set();
let version = 0;

function readSet(employeeId) {
    try {
        return new Set(JSON.parse(localStorage.getItem(KEY(employeeId)) || "[]"));
    } catch {
        return new Set();
    }
}

export function markDownloaded(employeeId, attachmentId) {
    try {
        const set = readSet(employeeId);
        set.add(Number(attachmentId));
        localStorage.setItem(KEY(employeeId), JSON.stringify([...set]));
    } catch {
        /* storage unavailable: fall back to session-only behaviour */
    }
    version += 1;
    listeners.forEach((fn) => fn());
}

export function useIsDownloaded(employeeId, attachmentId, own) {
    useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => version
    );
    if (own) return true; // sender always sees their own media
    return readSet(employeeId).has(Number(attachmentId));
}

export const hasDownloaded = (employeeId, attachmentId, own) =>
    own || readSet(employeeId).has(Number(attachmentId));

/* ---------- open a non-PDF document ----------
   A web page cannot launch (or detect) a desktop app. What we can do:
   - text-like files: open in a new tab
   - office / archive files: download so the OS opens them with its default app
   - anything else (executables, unknown types): show the "no relevant app" error */

const TAB_VIEWABLE = new Set(["txt", "csv", "json", "js", "md"]);
const DOWNLOAD_OPENABLE = new Set([
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rtf", "odt", "ods",
]);

export async function openWithSystemApp(att, employeeId) {
    const ext = getExt(att.file_name);
    const url = attachmentUrl(att, employeeId);

    try {
        if (TAB_VIEWABLE.has(ext)) {
            const res = await fetch(url);
            const text = await res.text();
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            window.open(URL.createObjectURL(blob), "_blank", "noopener");
            return;
        }
        if (DOWNLOAD_OPENABLE.has(ext)) {
            await downloadFile(url, att.file_name);
            toast("Downloaded - open it with the app on your device.", { icon: "ℹ️" });
            return;
        }
        toast.error("You don't have a relevant app to open this document.");
    } catch {
        toast.error("Could not open this document.");
    }
}
