import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ArrowLeft,
    Check,
    Download,
    FileText,
    ExternalLink,
    Forward,
    Image as ImageIcon,
    Loader2,
    Maximize2,
    MessageCircle,
    Play,
    Plus,
    Search,
    Star,
    Trash2,
    UserPlus,
    Users,
    X,
    Camera,
    Lock,
    MoreVertical,
} from "lucide-react";
import toast from "react-hot-toast";
import MediaLightbox from "../media/MediaLightbox";
import { FileExtIcon, attachmentUrl, downloadFile, getExt } from "../media/mediaUtils";
import { extractMessageLinks } from "../../../utils/messageLinks";

/* ---------------------------------------------------------
   small helpers
--------------------------------------------------------- */

const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
// attachments carry message_id; link rows ARE messages, so their id is the message id
const messageIdOf = (item) => Number(item.message_id ?? item.id);
const uniq = (list) => [...new Set(list)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Avatar({ name = "", avatar = null, size = "md" }) {
    const sizes = {
        sm: "h-9 w-9 text-xs",
        md: "h-14 w-14 text-sm",
        lg: "h-24 w-24 text-2xl",
    };
    const initials = String(name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "?";

    if (avatar) {
        return (
            <img
                src={avatar}
                alt={name}
                className={`${sizes[size] || sizes.md} shrink-0 rounded-full object-cover`}
            />
        );
    }

    return (
        <div className={`${sizes[size] || sizes.md} flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600`}>
            {initials}
        </div>
    );
}

function formatBytes(value) {
    const size = Number(value || 0);
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function fileKind(attachment = {}) {
    const type = String(attachment.file_type || "").toLowerCase();
    const name = String(attachment.file_name || "").toLowerCase();

    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name)) return "image";
    if (/\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name)) return "video";
    return "document";
}

function EmptyState({ title, icon: Icon = FileText }) {
    return (
        <div className="flex flex-1 items-center justify-center px-8 text-center">
            <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                    <Icon size={25} />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-700">{title}</p>
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
                <Loader2 size={15} className="animate-spin text-orange-500" />
                Loading...
            </div>
        </div>
    );
}

function Header({ title, onBack, onClose, count }) {
    return (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
            <button
                type="button"
                onClick={onBack || onClose}
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label={onBack ? "Back" : "Close"}
            >
                {onBack ? <ArrowLeft size={19} /> : <X size={19} />}
            </button>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{title}</p>
                {count != null && <p className="mt-0.5 text-[11px] text-gray-400">{count}</p>}
            </div>
            {onBack && (
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>
            )}
        </div>
    );
}

function InfoRow({ icon: Icon, title, subtitle, onClick, disabled = false }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                <Icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-800">{title}</span>
                {subtitle && <span className="mt-0.5 block text-[11px] text-gray-400">{subtitle}</span>}
            </span>
        </button>
    );
}

/* ---------------------------------------------------------
   SELECTION UI
--------------------------------------------------------- */

/* Circular select indicator. Parent must have the `group` class.
   Hidden until hover, always visible once selection mode is active. */
function SelectCircle({ selected, visible, onToggle, label, tone = "media" }) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onToggle();
            }}
            aria-pressed={selected}
            aria-label={selected ? `Deselect ${label}` : `Select ${label}`}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition focus-visible:opacity-100 ${
                selected
                    ? "border-orange-500 bg-orange-500 text-white"
                    : tone === "media"
                      ? "border-white bg-black/25 text-transparent hover:bg-black/45"
                      : "border-gray-300 bg-white text-transparent hover:border-orange-400"
            } ${visible || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
            <Check size={14} strokeWidth={3} />
        </button>
    );
}

function MediaTile({
    item,
    url,
    selected,
    selectionActive,
    failed,
    onFail,
    onToggle,
    onOpen,
}) {
    const kind = fileKind(item);
    const activate = () => (selectionActive ? onToggle() : onOpen());

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={item.file_name || "Media"}
            onClick={activate}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate();
                }
            }}
            className={`group relative aspect-square cursor-pointer overflow-hidden bg-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                selected ? "ring-2 ring-inset ring-orange-500" : ""
            }`}
        >
            {/* thumbnail: shrinks slightly when selected but stays fully visible */}
            <div
                className={`h-full w-full overflow-hidden transition-transform duration-150 ${
                    selected ? "scale-[0.86] rounded-md" : ""
                }`}
            >
                {failed ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
                        <ImageIcon size={20} />
                        <span className="text-[10px] font-medium">Unavailable</span>
                    </div>
                ) : kind === "image" ? (
                    <img
                        src={url}
                        alt={item.file_name}
                        loading="lazy"
                        onError={onFail}
                        className={`h-full w-full object-cover transition ${
                            selectionActive ? "" : "group-hover:scale-105"
                        }`}
                    />
                ) : (
                    <video
                        src={url}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                        onError={onFail}
                    />
                )}
            </div>

            {/* subtle hover overlay + top gradient so the checkbox stays visible */}
            <span
                className={`pointer-events-none absolute inset-0 transition ${
                    selected
                        ? "bg-black/10"
                        : "bg-transparent group-hover:bg-black/25"
                }`}
            />
            <span
                className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent transition-opacity ${
                    selectionActive || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
            />

            <div className="absolute left-1.5 top-1.5 z-10">
                <SelectCircle
                    selected={selected}
                    visible={selectionActive}
                    onToggle={onToggle}
                    label={item.file_name || "item"}
                />
            </div>

            {kind === "video" && !failed && (
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center rounded-full bg-black/55 px-1.5 py-1 text-white">
                    <Play size={10} fill="white" />
                </span>
            )}

            {/* in selection mode a click toggles, so keep a dedicated preview button */}
            {selectionActive && !failed && (
                <button
                    type="button"
                    title="Preview"
                    aria-label="Preview"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpen();
                    }}
                    className="absolute bottom-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition hover:bg-black/75 group-hover:opacity-100"
                >
                    <Maximize2 size={13} />
                </button>
            )}
        </div>
    );
}

function DocumentRow({ item, selected, selectionActive, onToggle, onOpen }) {
    const activate = () => (selectionActive ? onToggle() : onOpen());
    const ext = getExt(item.file_name).toUpperCase();
    const meta = [
        ext || "FILE",
        formatBytes(item.file_size),
        formatDate(item.message_created_at || item.created_at),
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={activate}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate();
                }
            }}
            className={`group flex cursor-pointer items-center gap-3 rounded-2xl p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-orange-300 ${
                selected ? "bg-orange-50 ring-1 ring-orange-200" : "hover:bg-gray-50"
            }`}
        >
            <FileExtIcon name={item.file_name} size={40} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-800">{item.file_name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-gray-400">{meta}</span>
            </span>
            {/* right slot: "open" icon at rest, select circle on hover / in selection mode */}
            <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                {!selectionActive && !selected && (
                    <ExternalLink
                        size={15}
                        className="absolute text-gray-400 transition-opacity group-hover:opacity-0"
                    />
                )}
                <SelectCircle
                    tone="doc"
                    selected={selected}
                    visible={selectionActive}
                    onToggle={onToggle}
                    label={item.file_name || "document"}
                />
            </span>
        </div>
    );
}

function LinkRow({ item, selected, selectionActive, onToggle }) {
    const found = extractMessageLinks(item.message);

    return (
        <div
            role={selectionActive ? "button" : undefined}
            tabIndex={selectionActive ? 0 : undefined}
            onClick={() => {
                if (selectionActive) onToggle();
            }}
            onKeyDown={(event) => {
                if (!selectionActive || event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle();
                }
            }}
            className={`group flex items-start gap-3 rounded-2xl p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-orange-300 ${
                selectionActive ? "cursor-pointer" : ""
            } ${selected ? "bg-orange-50 ring-1 ring-orange-200" : "hover:bg-gray-50"}`}
        >
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500">
                    {item.sender_name || "Message"} · {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-700">
                    {found.map((link) => (
                        <a
                            key={`${item.id}-${link.href}`}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            // while selecting, a click on the link selects the row instead of opening it
                            onClick={(event) => {
                                if (selectionActive) event.preventDefault();
                            }}
                            className="block truncate font-medium text-blue-600 underline underline-offset-2"
                        >
                            {link.url}
                        </a>
                    ))}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.message}</p>
            </div>

            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                <SelectCircle
                    tone="doc"
                    selected={selected}
                    visible={selectionActive}
                    onToggle={onToggle}
                    label="link message"
                />
            </span>
        </div>
    );
}

function ConfirmDeleteDialog({ plan, busy, onCancel, onConfirm }) {
    if (!plan) return null;
    const count = plan.messageIds.length;

    return createPortal(
        <div
            data-chat-overlay-root
            className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-chat-fade"
        >
            <div className="w-full max-w-[340px] overflow-hidden rounded-[28px] bg-white shadow-2xl animate-chat-modal">
                <div className="px-6 pb-3 pt-7 text-center">
                    <h3 className="text-[20px] font-medium tracking-tight text-gray-900">
                        {count === 1 ? "Delete message?" : `Delete ${count} messages?`}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                        This removes the whole message, including its caption and every attachment in it.
                    </p>
                    {plan.alsoRemoved > 0 && (
                        <p className="mt-2 text-xs font-semibold leading-5 text-red-600">
                            {plan.alsoRemoved} other attachment{plan.alsoRemoved === 1 ? "" : "s"} in the same message
                            {count === 1 ? "" : "s"} will also be removed.
                        </p>
                    )}
                </div>

                {plan.canEveryone && (
                    <div className="px-4 pb-3">
                        <button
                            type="button"
                            onClick={() => onConfirm("everyone")}
                            disabled={busy}
                            className="flex w-full items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                            {busy ? "Please wait..." : "Delete for everyone"}
                        </button>
                    </div>
                )}
                <div className="px-4 pb-3">
                    <button
                        type="button"
                        onClick={() => onConfirm("me")}
                        disabled={busy}
                        className="flex w-full items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                        {busy ? "Please wait..." : "Delete for me"}
                    </button>
                </div>
                <div className="px-4 pb-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* =========================================================
   GROUP ROLES: chips, member menu, edit sheet
========================================================= */

const withEmployee = (url, employeeId) => {
    if (!url) return null;
    const value = String(url);
    return value.startsWith("/uploads/") && !value.includes("?")
        ? `${value}?employeeId=${employeeId}`
        : value;
};

const ACTION_META = {
    make_admin: { label: "Make admin", role: "admin" },
    make_super_admin: { label: "Make Super Admin", role: "super_admin" },
    demote_admin: { label: "Change to admin", role: "admin" },
    demote_member: { label: "Make employee", role: "member" },
    remove: { label: "Remove from group", danger: true },
};

// What the current member (actorRole) may do to another member (targetRole).
// Mirrors canSetRole / canRemoveMember on the backend (the backend enforces it).
function memberActions(actorRole, targetRole) {
    const actions = [];
    if (targetRole === "owner") return actions;
    if (actorRole === "owner") {
        if (targetRole === "member") actions.push("make_admin");
        if (targetRole === "admin") actions.push("make_super_admin", "demote_member");
        if (targetRole === "super_admin") actions.push("demote_admin", "demote_member");
        actions.push("remove");
    } else if (actorRole === "super_admin") {
        if (targetRole === "member") actions.push("make_admin", "remove");
        if (targetRole === "admin") actions.push("demote_member", "remove");
    } else if (actorRole === "admin") {
        if (targetRole === "member") actions.push("make_admin", "remove");
    }
    return actions;
}

function RoleChip({ role }) {
    const label =
        role === "owner" ? "Owner"
        : role === "super_admin" ? "Super Admin"
        : role === "admin" ? "Admin"
        : "";
    if (!label) return null; // plain members get no chip
    const tone =
        role === "owner" ? "bg-orange-100 text-orange-700"
        : role === "super_admin" ? "bg-violet-100 text-violet-700"
        : "bg-emerald-100 text-emerald-700";
    return (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
            {label}
        </span>
    );
}

function MemberMenu({ actions, busy, onAction }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const closeOutside = (event) => {
            if (event.target instanceof Element && event.target.closest("[data-member-menu]")) return;
            setOpen(false);
        };
        const closeNow = () => setOpen(false);
        document.addEventListener("pointerdown", closeOutside);
        window.addEventListener("scroll", closeNow, true);
        window.addEventListener("resize", closeNow);
        return () => {
            document.removeEventListener("pointerdown", closeOutside);
            window.removeEventListener("scroll", closeNow, true);
            window.removeEventListener("resize", closeNow);
        };
    }, [open]);

    const toggle = (event) => {
        event.stopPropagation();
        if (open) {
            setOpen(false);
            return;
        }
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = 208;
        const height = actions.length * 40 + 12;
        const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
        const top =
            rect.bottom + 4 + height > window.innerHeight
                ? Math.max(8, rect.top - height - 4)
                : rect.bottom + 4;
        setPos({ top, left });
        setOpen(true);
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                disabled={busy}
                onClick={toggle}
                title="Manage member"
                aria-label="Manage member"
                className="shrink-0 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
                <MoreVertical size={16} />
            </button>
            {open && pos && createPortal(
                <div
                    data-member-menu
                    data-chat-overlay-root
                    className="fixed z-[240] w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl animate-chat-pop"
                    style={{ top: pos.top, left: pos.left }}
                >
                    {actions.map((action) => (
                        <button
                            key={action}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onAction(action);
                            }}
                            className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-semibold ${
                                ACTION_META[action].danger
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                            {ACTION_META[action].label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

function ConfirmActionDialog({ plan, busy, onCancel, onConfirm }) {
    if (!plan) return null;
    return createPortal(
        <div
            data-chat-overlay-root
            className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-chat-fade"
        >
            <div className="w-full max-w-[320px] overflow-hidden rounded-[28px] bg-white shadow-2xl animate-chat-modal">
                <div className="px-6 pb-4 pt-7 text-center">
                    <h3 className="text-[20px] font-medium tracking-tight text-gray-900">{plan.title}</h3>
                    {plan.message && <p className="mt-2 text-xs leading-5 text-gray-500">{plan.message}</p>}
                </div>
                <div className="px-4 pb-3">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="flex w-full items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                        {busy ? "Please wait..." : plan.confirmLabel}
                    </button>
                </div>
                <div className="px-4 pb-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function EditGroupSheet({ conversation, currentId, avatarSrc, onBack, onClose, onSaved }) {
    const [title, setTitle] = useState(conversation.title || "");
    const [description, setDescription] = useState(conversation.description || "");
    const [onlyAdmins, setOnlyAdmins] = useState(Boolean(conversation.only_admins_can_message));
    const [saving, setSaving] = useState(false);
    const [photoBusy, setPhotoBusy] = useState(false);
    const fileRef = useRef(null);

    const uploadPhoto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Choose an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("The photo must be 5 MB or smaller.");
            return;
        }
        setPhotoBusy(true);
        try {
            const form = new FormData();
            form.append("employeeId", String(currentId));
            form.append("avatar", file);
            const response = await fetch(`/api/chat/conversations/${conversation.id}/avatar`, {
                method: "POST",
                body: form,
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Could not update the photo");
            toast.success("Group photo updated");
            await onSaved?.();
        } catch (error) {
            toast.error(error.message || "Could not update the photo");
        } finally {
            setPhotoBusy(false);
        }
    };

    const removePhoto = async () => {
        setPhotoBusy(true);
        try {
            const response = await fetch(`/api/chat/conversations/${conversation.id}/avatar`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: currentId }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Could not remove the photo");
            toast.success("Group photo removed");
            await onSaved?.();
        } catch (error) {
            toast.error(error.message || "Could not remove the photo");
        } finally {
            setPhotoBusy(false);
        }
    };

    const save = async () => {
        const name = title.trim();
        if (!name) {
            toast.error("Group name is required.");
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(`/api/chat/conversations/${conversation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: currentId,
                    title: name,
                    description: description.trim(),
                    onlyAdminsCanMessage: onlyAdmins,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Could not update the group");
            toast.success("Group updated");
            await onSaved?.();
            onBack();
        } catch (error) {
            toast.error(error.message || "Could not update the group");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[70] flex flex-col bg-white">
            <Header title="Edit group" onBack={onBack} onClose={onClose} />
            <div className="flex-1 overflow-y-auto p-5">
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Avatar name={title || conversation.title} avatar={avatarSrc} size="lg" />
                        <button
                            type="button"
                            disabled={photoBusy}
                            onClick={() => fileRef.current?.click()}
                            title="Change group photo"
                            aria-label="Change group photo"
                            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-md transition hover:bg-orange-600 disabled:opacity-60"
                        >
                            {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={uploadPhoto}
                        />
                    </div>
                    {conversation.avatar && (
                        <button
                            type="button"
                            disabled={photoBusy}
                            onClick={removePhoto}
                            className="mt-3 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                            Remove photo
                        </button>
                    )}
                </div>

                <label className="mt-6 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Group name
                </label>
                <input
                    value={title}
                    maxLength={100}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />

                <label className="mt-5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Description
                </label>
                <textarea
                    value={description}
                    maxLength={500}
                    rows={4}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add a group description"
                    className="mt-1.5 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />

                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-100 p-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">Only admins can send messages</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-gray-400">
                            When on, employees can still react and vote, but cannot send messages, files or polls.
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={onlyAdmins}
                        onClick={() => setOnlyAdmins((value) => !value)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                            onlyAdmins ? "bg-orange-500" : "bg-gray-300"
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                onlyAdmins ? "left-[22px]" : "left-0.5"
                            }`}
                        />
                    </button>
                </div>

                <button
                    type="button"
                    disabled={saving}
                    onClick={save}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Save changes
                </button>
            </div>
        </div>
    );
}

/* =========================================================
   CHAT INFO PANEL
========================================================= */

export default function ChatInfoPanel({
    conversation,
    participants = [],
    currentId,
    selectedDisplay,
    employees = [],
    onClose,
    onOpenConversation,
    onRefreshConversation,
    // (messageIds, onSuccess) -> opens the existing ForwardModal in Chat.jsx
    onForwardMessages,
    // ([{ id, message }]) -> lets Chat.jsx sync its own message list
    onMessagesDeleted,
    onGroupUpdated,
}) {
    const [view, setView] = useState("root");
    const [content, setContent] = useState(null);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [memberSearchOpen, setMemberSearchOpen] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");
    const [personId, setPersonId] = useState(null);
    const [personInfo, setPersonInfo] = useState(null);
    const [personLoading, setPersonLoading] = useState(false);
    const [addPersonOpen, setAddPersonOpen] = useState(false);
    const [addSearch, setAddSearch] = useState("");
    const [addBusy, setAddBusy] = useState(false);
    const [mediaViewer, setMediaViewer] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [memberPlan, setMemberPlan] = useState(null);
    const [memberBusy, setMemberBusy] = useState(false);

    // media selection
    const [mediaTab, setMediaTab] = useState("media");
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [failedIds, setFailedIds] = useState({});
    const [actionBusy, setActionBusy] = useState(null); // "download" | "delete" | null
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const mountedRef = useRef(true);

    const isGroup = conversation?.conversation_type === "group";

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const loadContent = async (conversationId = conversation?.id) => {
        if (!conversationId) return;
        setContentLoading(true);
        setContentError("");
        try {
            const response = await fetch(
                `/api/chat/conversations/${conversationId}/info-content?employeeId=${currentId}`
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to load chat information");
            }
            setContent(data);
        } catch (error) {
            setContentError(error.message || "Failed to load chat information");
            setContent(null);
        } finally {
            setContentLoading(false);
        }
    };

    const loadPersonInfo = async (id) => {
        if (!id) return;
        setPersonId(Number(id));
        setPersonLoading(true);
        try {
            const response = await fetch(
                `/api/chat/people/${id}/info?employeeId=${currentId}`
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to load person information");
            }
            setPersonInfo(data);
            setView("person");
        } catch (error) {
            toast.error(error.message || "Could not load person information");
        } finally {
            setPersonLoading(false);
        }
    };

    useEffect(() => {
        if (
            (view === "media" || view === "starred") &&
            !personInfo
        ) {
            loadContent();
        }
    }, [view, conversation?.id, personInfo]);

    useEffect(() => {
        if (view === "root") {
            setPersonInfo(null);
            setPersonId(null);
            setMemberSearchOpen(false);
            setMemberSearch("");
        }
    }, [view]);

    const media = content?.media || [];
    const documents = content?.documents || [];
    const links = content?.links || [];
    const starred = content?.starred || [];

    /* ---------------- selection state ---------------- */

    const exitSelection = useCallback(() => {
        setSelectMode(false);
        setSelectedIds([]);
    }, []);

    // entering / leaving the media view always starts clean
    useEffect(() => {
        setMediaTab("media");
        setDeleteConfirm(null);
        exitSelection();
    }, [view, exitSelection]);

    const changeTab = (key) => {
        if (key === mediaTab) return;
        exitSelection(); // media and documents never share a selection
        setMediaTab(key);
    };

    const toggleSelect = useCallback((id) => {
        const numericId = Number(id);
        setSelectMode(true);
        setSelectedIds((current) =>
            current.includes(numericId)
                ? current.filter((value) => value !== numericId)
                : [...current, numericId]
        );
    }, []);

    // was: const tabItems = mediaTab === "media" ? media : mediaTab === "documents" ? documents : [];
    const tabItems = mediaTab === "media" ? media : mediaTab === "documents" ? documents : links;

    // was: const selectionActive = selectMode && mediaTab !== "links";
    const selectionActive = selectMode;
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    // derived from live data, so items removed by a delete/reload drop out automatically
    const selectedItems = useMemo(
        () => tabItems.filter((item) => selectedSet.has(Number(item.id))),
        [tabItems, selectedSet]
    );
    const ownSelectedItems = selectedItems.filter(
        (item) => Number(item.sender_employee_id) === Number(currentId)
    );
    const canSelect =
        (mediaTab === "media" && media.length > 0) ||
        (mediaTab === "documents" && documents.length > 0) ||
        (mediaTab === "links" && links.length > 0);

    useEffect(() => {
        if (!selectMode) return undefined;
        const onKey = (event) => {
            if (event.key !== "Escape" || mediaViewer || actionBusy) return;
            if (deleteConfirm) {
                setDeleteConfirm(null);
                return;
            }
            exitSelection();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectMode, mediaViewer, deleteConfirm, actionBusy, exitSelection]);

    /* ---------------- actions ---------------- */

    const openMedia = (attachment) => {
        setMediaViewer({
            attachment,
            items: media,
        });
    };

    const openDocument = (item) => {
        if (!item.file_url) {
            toast.error("This file is unavailable.");
            return;
        }
        window.open(attachmentUrl(item, currentId), "_blank", "noopener,noreferrer");
    };

    // DOWNLOAD — reuses downloadFile() + attachmentUrl() from mediaUtils
    const handleDownload = async () => {
        if (actionBusy) return;
        const seen = new Set();
        const targets = selectedItems.filter((item) => {
            const id = Number(item.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        if (!targets.length) return;

        setActionBusy("download");
        const total = targets.length;
        const toastId = total > 1 ? toast.loading(`Downloading 0/${total}...`) : null;
        let ok = 0;
        let failed = 0;

        for (let i = 0; i < total; i += 1) {
            const attachment = targets[i];
            if (!attachment.file_url) {
                failed += 1;
            } else {
                try {
                    await downloadFile(attachmentUrl(attachment, currentId), attachment.file_name);
                    ok += 1;
                } catch {
                    failed += 1;
                }
            }
            if (toastId) toast.loading(`Downloading ${i + 1}/${total}...`, { id: toastId });
            // small gap so browsers don't block back-to-back downloads
            if (i < total - 1) await sleep(350);
        }

        if (toastId) toast.dismiss(toastId);
        if (failed === 0) {
            toast.success(ok === 1 ? "Download started" : `${ok} files downloaded`);
        } else if (ok === 0) {
            toast.error(failed === 1 ? "Could not download this file" : "Could not download the selected files");
        } else {
            toast.error(`${ok} downloaded, ${failed} failed`);
        }

        if (mountedRef.current) {
            setActionBusy(null);
            if (failed === 0) exitSelection();
        }
    };

        // FORWARD — de-duplicate parent messages, hand off to the existing ForwardModal
    const handleForward = () => {
        if (actionBusy || !selectedItems.length) return;
        const messageIds = uniq(selectedItems.map(messageIdOf).filter(validId));
        if (!messageIds.length) {
            toast.error("These items cannot be forwarded.");
            return;
        }
        if (!onForwardMessages) {
            toast.error("Forwarding is not available here.");
            return;
        }
        onForwardMessages(messageIds, () => {
            if (mountedRef.current) exitSelection();
        });
    };

    // DELETE step 1 — de-duplicated plan, then ask how to delete
    const requestDelete = () => {
        if (actionBusy || !selectedItems.length) return;

        const messageIds = uniq(selectedItems.map(messageIdOf).filter(validId));
        if (!messageIds.length) {
            toast.error("These items cannot be deleted.");
            return;
        }

        // "Delete for everyone" only if every selected item is my own message
        const canEveryone = selectedItems.every(
            (item) => Number(item.sender_employee_id) === Number(currentId)
        );

        // other attachments in the same messages that will go with them
        const messageIdSet = new Set(messageIds);
        const selectedAttachmentIds = new Set(
            mediaTab === "links" ? [] : selectedItems.map((item) => Number(item.id))
        );
        const alsoRemoved = [...media, ...documents].filter(
            (item) =>
                messageIdSet.has(Number(item.message_id)) &&
                !selectedAttachmentIds.has(Number(item.id))
        ).length;

        setDeleteConfirm({ messageIds, alsoRemoved, canEveryone });
    };

    // DELETE step 2 — one existing DELETE /api/chat/messages/:id per UNIQUE message
    const confirmDelete = async (scope) => {
        const plan = deleteConfirm;
        if (!plan || actionBusy) return;
        const mode = scope === "everyone" && plan.canEveryone ? "everyone" : "me";
        setActionBusy("delete");

        const results = await Promise.allSettled(
            plan.messageIds.map(async (messageId) => {
                const response = await fetch(`/api/chat/messages/${messageId}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employeeId: currentId, scope: mode }),
                });
                let data = null;
                try {
                    data = await response.json();
                } catch {
                    data = null;
                }

                if (response.ok && data?.success) {
                    return { id: messageId, message: data.message || null, scope: mode };
                }
                // already deleted / no longer exists: treat as removed
                if (response.status === 404) return { id: messageId, message: null, scope: mode };
                if (response.status === 400 && /already deleted/i.test(data?.message || "")) {
                    return { id: messageId, message: null, scope: mode };
                }
                throw new Error(data?.message || "Failed to delete message");
            })
        );

        const done = [];
        const failed = [];
        results.forEach((result, index) => {
            if (result.status === "fulfilled") done.push(result.value);
            else failed.push({ id: plan.messageIds[index], reason: result.reason?.message });
        });

        if (done.length) {
            const doneIds = new Set(done.map((entry) => Number(entry.id)));
            const prune = (source) => ({
                ...source,
                media: (source.media || []).filter((item) => !doneIds.has(Number(item.message_id))),
                documents: (source.documents || []).filter((item) => !doneIds.has(Number(item.message_id))),
                links: (source.links || []).filter((item) => !doneIds.has(Number(item.id))),
                starred: (source.starred || []).filter((item) => !doneIds.has(Number(item.message_id))),
            });

            setContent((current) => (current ? prune(current) : current));
            setPersonInfo((current) => {
                if (!current) return current;
                const next = prune(current);
                return { ...next, starredCount: next.starred.length };
            });

            onMessagesDeleted?.(done);
            toast.success(done.length === 1 ? "Message deleted" : `${done.length} messages deleted`);
        }

        if (failed.length) {
            toast.error(
                failed.length === 1
                    ? failed[0].reason || "Could not delete the message"
                    : `${failed.length} messages could not be deleted`
            );
        }

        if (mountedRef.current) {
            setDeleteConfirm(null);
            setActionBusy(null);
            if (!failed.length) exitSelection();
        }
    };

    /* ---------------- members / people ---------------- */

    const filteredMembers = useMemo(() => {
        const query = memberSearch.trim().toLowerCase();
        if (!query) return participants;
        return participants.filter((person) =>
            `${person.full_name || ""} ${person.phone || ""} ${person.employee_code || ""}`
                .toLowerCase()
                .includes(query)
        );
    }, [participants, memberSearch]);

    const availableEmployees = useMemo(() => {
        const memberIds = new Set(participants.map((p) => Number(p.employee_id)));
        const query = addSearch.trim().toLowerCase();
        return employees
            .filter((person) => !memberIds.has(Number(person.id)))
            .filter((person) =>
                !query ||
                `${person.full_name || ""} ${person.phone || ""} ${person.employee_code || ""}`
                    .toLowerCase()
                    .includes(query)
            )
            .slice(0, 30);
    }, [employees, participants, addSearch]);

    const currentParticipant = participants.find(
        (person) => Number(person.employee_id) === Number(currentId)
    );
    const myRole = currentParticipant?.participant_role || "member";
    const canEditGroup = isGroup && ["owner", "super_admin", "admin"].includes(myRole);
    const canAddPerson = canEditGroup;

    const directConversationId = personInfo?.directConversation?.id || null;
    const personHasHistory = Boolean(personInfo?.directConversation?.hasMessages);

    const runMemberAction = async (person, action) => {
        if (memberBusy || !conversation?.id) return;
        setMemberBusy(true);
        try {
            const base = `/api/chat/conversations/${conversation.id}/participants/${person.employee_id}`;
            const response =
                action === "remove"
                    ? await fetch(base, {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ employeeId: currentId }),
                      })
                    : await fetch(`${base}/role`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ employeeId: currentId, role: ACTION_META[action].role }),
                      });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Action failed");
            toast.success(action === "remove" ? `${person.full_name} removed` : "Role updated");
            setMemberPlan(null);
            await onGroupUpdated?.();
        } catch (error) {
            toast.error(error.message || "Action failed");
        } finally {
            setMemberBusy(false);
        }
    };

    const requestMemberAction = (person, action) => {
        if (action === "remove") {
            setMemberPlan({ person, action });
            return;
        }
        runMemberAction(person, action);
    };

    const addPerson = async (employee) => {
        if (!conversation?.id || !employee?.id) return;
        setAddBusy(true);
        try {
            const response = await fetch(
                `/api/chat/conversations/${conversation.id}/participants`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        employeeId: currentId,
                        participantEmployeeId: employee.id,
                    }),
                }
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not add employee");
            }
            toast.success(`${employee.full_name} added to the group`);
            setAddPersonOpen(false);
            setAddSearch("");
            await (onGroupUpdated || onRefreshConversation)?.();
        } catch (error) {
            toast.error(error.message || "Could not add employee");
        } finally {
            setAddBusy(false);
        }
    };

    const openCommonGroup = (group) => {
        if (!group?.id) return;
        onClose?.();
        onOpenConversation?.(Number(group.id));
    };

    if (!conversation) return null;

    if (view === "media") {
        const selectedCount = selectedItems.length;
        const toolbarBtn =
            "rounded-xl p-2.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30";

        return (
            <>
                <aside className="absolute inset-y-0 right-0 z-[60] flex w-full max-w-[460px] min-h-0 flex-col bg-white shadow-2xl animate-chat-slide">
                    {selectionActive ? (
                        <div className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={exitSelection}
                                    className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                                    title="Close selection"
                                    aria-label="Close selection"
                                >
                                    <X size={21} />
                                </button>
                                <span className="text-sm font-semibold text-gray-700">
                                    {selectedCount ? `${selectedCount} selected` : "Select items"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                {mediaTab !== "links" && (
                                    <button
                                        type="button"
                                        disabled={!selectedCount || !!actionBusy}
                                        onClick={handleDownload}
                                        className={toolbarBtn}
                                        title="Download"
                                        aria-label="Download"
                                    >
                                        {actionBusy === "download" ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <Download size={20} />
                                        )}
                                    </button>
                                )}
   
                                <button
                                    type="button"
                                    disabled={!selectedCount || !!actionBusy}
                                    onClick={handleForward}
                                    className={toolbarBtn}
                                    title="Forward"
                                    aria-label="Forward"
                                >
                                    <Forward size={20} />
                                </button>
                                <button
                                    type="button"
                                    disabled={!selectedCount || !!actionBusy}
                                    onClick={requestDelete}
                                    className={`${toolbarBtn} hover:!bg-red-50 hover:text-red-600`}
                                    title="Delete"
                                    aria-label="Delete"
                                >
                                    {actionBusy === "delete" ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={20} />
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <Header
                            title="Media, Documents and Links"
                            count={`${media.length} media · ${documents.length} documents · ${links.length} links`}
                            onBack={() => setView("root")}
                            onClose={onClose}
                        />
                    )}

                    <div className="flex shrink-0 items-center border-b border-gray-100 bg-white px-2">
                        {[
                            ["media", "MEDIA"],
                            ["documents", "DOCUMENTS"],
                            ["links", "LINKS"],
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => changeTab(key)}
                                className={`flex-1 border-b-2 px-2 py-3 text-[10px] font-bold tracking-wider ${
                                    mediaTab === key
                                        ? "border-orange-500 text-orange-500"
                                        : "border-transparent text-gray-400 hover:text-gray-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                        {canSelect && !selectMode && (
                            <button
                                type="button"
                                onClick={() => setSelectMode(true)}
                                className="ml-1 shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold text-orange-500 transition hover:bg-orange-50"
                            >
                                Select
                            </button>
                        )}
                    </div>

                    {contentLoading ? (
                        <LoadingState />
                    ) : contentError ? (
                        <EmptyState title={contentError} />
                    ) : mediaTab === "media" ? (
                        media.length ? (
                            <div className="grid flex-1 grid-cols-3 content-start gap-1 overflow-y-auto bg-gray-50 p-1">
                                {media.map((item) => (
                                    <MediaTile
                                        key={item.id}
                                        item={item}
                                        url={attachmentUrl(item, currentId)}
                                        selected={selectedSet.has(Number(item.id))}
                                        selectionActive={selectionActive}
                                        failed={Boolean(failedIds[item.id]) || !item.file_url}
                                        onFail={() =>
                                            setFailedIds((current) => ({ ...current, [item.id]: true }))
                                        }
                                        onToggle={() => toggleSelect(item.id)}
                                        onOpen={() => openMedia(item)}
                                    />
                                ))}
                            </div>
                        ) : <EmptyState title="No media yet" icon={ImageIcon} />
                    ) : mediaTab === "documents" ? (
                        documents.length ? (
                            <div className="flex-1 overflow-y-auto p-2">
                                {documents.map((item) => (
                                    <DocumentRow
                                        key={item.id}
                                        item={item}
                                        selected={selectedSet.has(Number(item.id))}
                                        selectionActive={selectionActive}
                                        onToggle={() => toggleSelect(item.id)}
                                        onOpen={() => openDocument(item)}
                                    />
                                ))}
                            </div>
                        ) : <EmptyState title="No documents yet" icon={FileText} />
                ) : (
                        links.length ? (
                            <div className="flex-1 overflow-y-auto p-2">
                                {links.map((item) => (
                                    <LinkRow
                                        key={item.id}
                                        item={item}
                                        selected={selectedSet.has(Number(item.id))}
                                        selectionActive={selectionActive}
                                        onToggle={() => toggleSelect(item.id)}
                                    />
                                ))}
                            </div>
                            ) : <EmptyState title="No links yet" icon={ExternalLink} />
                        )}
                    </aside>

                {mediaViewer && (
                    <MediaLightbox
                        items={mediaViewer.items}
                        startId={mediaViewer.attachment.id}
                        currentId={currentId}
                        onClose={() => setMediaViewer(null)}
                    />
                )}

                <ConfirmDeleteDialog
                    plan={deleteConfirm}
                    busy={actionBusy === "delete"}
                    onCancel={() => setDeleteConfirm(null)}
                    onConfirm={confirmDelete}
                />
            </>
        );
    }

    if (view === "starred") {
        return (
            <aside className="absolute inset-y-0 right-0 z-[60] flex w-full max-w-[460px] min-h-0 flex-col bg-white shadow-2xl animate-chat-slide">
                <Header
                    title="Starred messages"
                    count={`${starred.length} starred`}
                    onBack={() => setView("root")}
                    onClose={onClose}
                />
                <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2">
                    <Search size={15} className="text-gray-400" />
                    <input
                        value={content?.starredSearch || ""}
                        onChange={(event) => setContent((current) => ({ ...(current || {}), starredSearch: event.target.value }))}
                        placeholder="Search starred messages"
                        className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                    />
                </div>
                {contentLoading ? <LoadingState /> : contentError ? <EmptyState title={contentError} /> : (() => {
                    const query = String(content?.starredSearch || "").trim().toLowerCase();
                    const filtered = starred.filter((item) =>
                        !query ||
                        String(item.message || "").toLowerCase().includes(query) ||
                        String(item.sender_name || "").toLowerCase().includes(query)
                    );
                    return filtered.length ? (
                        <div className="flex-1 overflow-y-auto p-2">
                            {filtered.map((item) => (
                                <button
                                    key={item.id || item.message_id}
                                    type="button"
                                    onClick={() => {
                                        onClose?.();
                                        onOpenConversation?.(Number(item.conversation_id), Number(item.message_id));
                                    }}
                                    className="mb-1 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-gray-50"
                                >
                                    <Star size={15} className="mt-0.5 shrink-0 text-orange-500" fill="currentColor" />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="truncate text-[11px] font-semibold text-gray-500">{Number(item.sender_employee_id) === Number(currentId) ? "You" : item.sender_name || "Message"}</span>
                                            <span className="shrink-0 text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
                                        </span>
                                        <span className="mt-1 block line-clamp-3 text-xs leading-5 text-gray-700">{item.message || "Attachment"}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : <EmptyState title="No starred messages" icon={Star} />;
                })()}
            </aside>
        );
    }

    if (view === "person") {
        if (personLoading || !personInfo) return <aside className="absolute inset-y-0 right-0 z-[60] flex w-full max-w-[460px] flex-col bg-white shadow-2xl"><Header title="Person Info" onBack={() => setView("root")} onClose={onClose} /><LoadingState /></aside>;

        const person = personInfo.person || {};
        const isSelf = Number(person.id) === Number(currentId);
        return (
            <aside className="absolute inset-y-0 right-0 z-[60] flex w-full max-w-[460px] min-h-0 flex-col bg-white shadow-2xl animate-chat-slide">
                <Header title={person.full_name || "Person Info"} onBack={() => setView("root")} onClose={onClose} />
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col items-center text-center">
                        <Avatar name={person.full_name} avatar={person.avatar} size="lg" />
                        <p className="mt-3 text-base font-bold text-gray-900">{person.full_name}</p>
                        <p className="mt-1 text-sm text-gray-500">{person.phone || "Phone not available"}</p>
                        {!isSelf && (
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        // Always reopen through the endpoint. This is important
                                        // when the current employee previously deleted this chat:
                                        // the backend clears deleted_chat_at for that employee.
                                        const response = await fetch("/api/chat/conversations/direct", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                employeeId: currentId,
                                                otherEmployeeId: Number(person.id),
                                            }),
                                        });
                                        const data = await response.json();
                                        if (!response.ok || !data.success) {
                                            throw new Error(data.message || "Could not open chat");
                                        }

                                        const conversationId = Number(
                                            data.conversationId ||
                                                data.conversation?.id ||
                                                directConversationId
                                        );
                                        if (!Number.isInteger(conversationId) || conversationId <= 0) {
                                            throw new Error("Direct conversation ID was not returned");
                                        }

                                        onClose?.();
                                        onOpenConversation?.(conversationId);
                                    } catch (error) {
                                        toast.error(error.message || "Could not open direct chat");
                                    }
                                }}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600"
                            >
                                <MessageCircle size={15} />
                                Message
                            </button>
                        )}
                    </div>

                    <div className="mt-7 divide-y divide-gray-100 rounded-2xl border border-gray-100">
                        <InfoRow
                            icon={Star}
                            title="Starred messages"
                            subtitle={personInfo.starredCount ? `${personInfo.starredCount} starred` : "No starred messages"}
                            onClick={() => {
                                setContent({
                                    media: personInfo.media || [],
                                    documents: personInfo.documents || [],
                                    links: personInfo.links || [],
                                    starred: personInfo.starred || [],
                                });
                                setView("starred");
                            }}
                        />
                        {personHasHistory && (
                            <InfoRow
                                icon={ImageIcon}
                                title="Media, Documents and Links"
                                subtitle={`${(personInfo.media || []).length} media · ${(personInfo.documents || []).length} documents · ${(personInfo.links || []).length} links`}
                                onClick={() => {
                                    setContent({
                                        media: personInfo.media || [],
                                        documents: personInfo.documents || [],
                                        links: personInfo.links || [],
                                        starred: personInfo.starred || [],
                                    });
                                    setView("media");
                                }}
                            />
                        )}
                    </div>

                    {!!personInfo.commonGroups?.length && (
                        <div className="mt-7">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-bold text-gray-900">Common groups</p>
                                <span className="text-xs text-gray-400">{personInfo.commonGroups.length}</span>
                            </div>
                            <div className="space-y-1">
                                {personInfo.commonGroups.map((group) => (
                                    <button
                                        key={group.id}
                                        type="button"
                                        onClick={() => openCommonGroup(group)}
                                        className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-gray-50"
                                    >
                                        <Avatar name={group.title} avatar={group.avatar} size="sm" />
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{group.title}</span>
                                        <Users size={15} className="text-gray-300" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        );
    }

    const groupOwner = participants.find((person) => person.participant_role === "owner");
    const groupAdmins = participants.filter((person) => person.participant_role === "admin");

    return (
        <aside className="absolute inset-y-0 right-0 z-[60] flex w-full max-w-[460px] min-h-0 flex-col bg-white shadow-2xl animate-chat-slide">
            <Header
                title={isGroup ? "Group Info" : "Contact Info"}
                onClose={onClose}
            />
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col items-center bg-gray-50 px-5 py-7 text-center">
                    <Avatar
                        name={isGroup ? conversation.title : selectedDisplay?.displayName}
                        avatar={isGroup ? withEmployee(conversation.avatar, currentId) : selectedDisplay?.displayAvatar}
                        size="lg"
                    />
                    <p className="mt-3 text-lg font-bold text-gray-900">
                        {isGroup ? conversation.title : selectedDisplay?.displayName || "Contact"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {isGroup
                            ? `${participants.length} members`
                            : selectedDisplay?.otherEmployee?.phone || selectedDisplay?.otherEmployee?.designation || "Employee"}
                    </p>
                    {!isGroup && selectedDisplay?.otherEmployee?.phone && (
                        <p className="mt-1 text-xs text-gray-400">{selectedDisplay.otherEmployee.phone}</p>
                    )}
                </div>

                {isGroup ? (
                    <>
                       <div className="space-y-3 p-4">
                            <div className="rounded-2xl border border-gray-100 p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Description</p>
                                    {canEditGroup && (
                                        <button
                                            type="button"
                                            onClick={() => setEditOpen(true)}
                                            className="rounded-lg px-2 py-1 text-[11px] font-bold text-orange-500 hover:bg-orange-50"
                                        >
                                            Edit group
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-gray-700">{conversation.description || "No description added."}</p>
                            </div>
                            {conversation.only_admins_can_message && (
                                <div className="flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-xs font-medium text-orange-700">
                                    <Lock size={14} className="shrink-0" />
                                    Only admins can send messages
                                </div>
                            )}
                        </div>

                        <div className="border-y border-gray-100 px-2 py-2">
                            <InfoRow
                                icon={ImageIcon}
                                title="Media, Documents and Links"
                                subtitle="Photos · Videos · Files · Links"
                                onClick={() => {
                                    setContent(null);
                                    setView("media");
                                }}
                            />
                            <InfoRow
                                icon={Star}
                                title="Starred messages"
                                subtitle="Only your starred messages"
                                onClick={() => {
                                    setContent(null);
                                    setView("starred");
                                }}
                            />
                        </div>

                        <div className="p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">Members</p>
                                <span className="text-xs text-gray-400">{participants.length}</span>
                                <button
                                    type="button"
                                    onClick={() => setMemberSearchOpen((value) => !value)}
                                    className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                    title="Search members"
                                >
                                    <Search size={16} />
                                </button>
                                {canAddPerson && (
                                    <button
                                        type="button"
                                        onClick={() => setAddPersonOpen(true)}
                                        className="rounded-xl p-2 text-orange-500 hover:bg-orange-50"
                                        title="Add person"
                                    >
                                        <UserPlus size={17} />
                                    </button>
                                )}
                            </div>

                            {memberSearchOpen && (
                                <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                                    <Search size={14} className="text-gray-400" />
                                    <input
                                        autoFocus
                                        value={memberSearch}
                                        onChange={(event) => setMemberSearch(event.target.value)}
                                        placeholder="Search name or phone"
                                        className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                                    />
                                    <button type="button" onClick={() => { setMemberSearch(""); setMemberSearchOpen(false); }} className="text-gray-400"><X size={14} /></button>
                                </div>
                            )}

                            <div className="space-y-1">
                            {filteredMembers.map((person) => {
                                const role = person.participant_role;
                                const isSelf = Number(person.employee_id) === Number(currentId);
                                const actions = isSelf ? [] : memberActions(myRole, role);
                                return (
                                    <div key={person.employee_id} className="flex items-center gap-1 rounded-2xl pr-1 hover:bg-gray-50">
                                        <button
                                            type="button"
                                            onClick={() => loadPersonInfo(person.employee_id)}
                                            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2.5 text-left"
                                        >
                                            <Avatar name={person.full_name} avatar={person.avatar} size="sm" />
                                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{person.full_name}</span>
                                            <RoleChip role={role} />
                                        </button>
                                        {actions.length > 0 && (
                                            <MemberMenu
                                                actions={actions}
                                                busy={memberBusy}
                                                onAction={(action) => requestMemberAction(person, action)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            </div>
                        </div>

                        {addPersonOpen && (
                            <div className="absolute inset-0 z-[70] flex flex-col bg-white">
                                <Header title="Add person" onBack={() => setAddPersonOpen(false)} onClose={onClose} />
                                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                                    <Search size={15} className="text-gray-400" />
                                    <input
                                        autoFocus
                                        value={addSearch}
                                        onChange={(event) => setAddSearch(event.target.value)}
                                        placeholder="Search name or phone"
                                        className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto p-2">
                                    {availableEmployees.length ? availableEmployees.map((employee) => (
                                        <button
                                            key={employee.id}
                                            type="button"
                                            disabled={addBusy}
                                            onClick={() => addPerson(employee)}
                                            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <Avatar name={employee.full_name} avatar={employee.avatar} size="sm" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-gray-800">{employee.full_name}</span>
                                                <span className="block truncate text-[11px] text-gray-400">{employee.phone || employee.employee_code || "Employee"}</span>
                                            </span>
                                            <Plus size={16} className="text-orange-500" />
                                        </button>
                                    )) : (
                                        <EmptyState title="No employees available" icon={Users} />
                                    )}
                                </div>
                            </div>
                        )}

                        {editOpen && canEditGroup && (
                            <EditGroupSheet
                                conversation={conversation}
                                currentId={currentId}
                                avatarSrc={withEmployee(conversation.avatar, currentId)}
                                onBack={() => setEditOpen(false)}
                                onClose={onClose}
                                onSaved={onGroupUpdated}
                            />
                        )}

                        <ConfirmActionDialog
                            plan={
                                memberPlan && {
                                    title: `Remove ${memberPlan.person.full_name}?`,
                                    message: "They will no longer be able to read or send messages in this group.",
                                    confirmLabel: "Remove",
                                }
                            }
                            busy={memberBusy}
                            onCancel={() => setMemberPlan(null)}
                            onConfirm={() => runMemberAction(memberPlan.person, "remove")}
                        />
                    </>
                ) : (
                    <div className="p-4">
                        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                            <InfoRow
                                icon={Star}
                                title="Starred messages"
                                subtitle="Only your starred messages"
                                onClick={() => {
                                    setContent(null);
                                    setView("starred");
                                }}
                            />
                            <InfoRow
                                icon={ImageIcon}
                                title="Media, Documents and Links"
                                subtitle="Open conversation media"
                                onClick={() => {
                                    setContent(null);
                                    setView("media");
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}