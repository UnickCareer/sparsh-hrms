/**
 * MessageAttachments.jsx
 *
 * Frontend component/module for HRMS application
 */

// frontend/src/components/chat/media/MessageAttachments.jsx
//
// Renders attachments inside a chat bubble.
//
// Media behavior:
//   1 media       -> normal single media preview
//   2-3 media     -> normal individual media previews
//   4+ media      -> WhatsApp-style 2x2 media grid
//                    first 4 are visible
//                    overflow count appears on the 4th tile
//
// Sender / already downloaded:
//   photo/video -> preview and opens the existing Media Viewer
//
// Receiver / not downloaded:
//   photo/video -> blurred preview with download button
//
// Documents:
//   PDF -> first-page preview
//   other documents -> file row
//   received documents -> Save as / Download
//
// HOVER OWNERSHIP
//   Every media tile is its own named group (`group/media`), so its
//   "Preview" hover label only reacts to THAT tile. It can no longer be
//   triggered by the message row / side whitespace / sibling tiles.
//
//   Each attachment (tile or document card) also reports pointer
//   enter/leave through `onHoverChange`. MessageBubble uses that to keep
//   the message chevron hidden while the pointer is over an attachment.
//
// Important:
//   Message splitting for 1-3 media is handled by Chat.jsx.
//   This component only controls how attachments inside ONE message
//   are visually rendered.

import { useState } from "react";
import { Download, Loader2, Play } from "lucide-react";
import toast from "react-hot-toast";
import {
    FileExtIcon,
    attachmentUrl,
    downloadFile,
    formatSize,
    getExt,
    kindOf,
    markDownloaded,
    openWithSystemApp,
    saveFileAs,
    useIsDownloaded,
} from "./mediaUtils";

/* ---------- helpers ---------- */

function isVisualAttachment(att) {
    const kind = kindOf(att.file_type, att.file_name);
    return kind === "image" || kind === "video";
}

/* Pointer enter/leave reporting for one attachment.
   Local to the bubble: the parent only learns "is the pointer over an
   attachment right now", never which message is hovered globally. */
function hoverHandlers(onHoverChange) {
    if (!onHoverChange) return {};
    return {
        onMouseEnter: () => onHoverChange(true),
        onMouseLeave: () => onHoverChange(false),
    };
}

/* ---------- first-page PDF preview ---------- */

function PdfThumb({ url }) {
    return (
        <div className="relative h-[130px] overflow-hidden rounded-t-lg bg-white">
            <iframe
                title="PDF preview"
                src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                loading="lazy"
                tabIndex={-1}
                className="pointer-events-none absolute left-0 top-0 h-[460px] w-full border-0"
            />
        </div>
    );
}

/* ---------- downloaded / locked media ---------- */

function MediaPreview({
    att,
    own,
    currentId,
    onOpenViewer,
    onHoverChange,
    className = "",
    overlay = null,
}) {
    const kind = kindOf(att.file_type, att.file_name);
    const downloaded = useIsDownloaded(currentId, att.id, own);
    const [busy, setBusy] = useState(false);
    const url = attachmentUrl(att, currentId);
    const size = formatSize(att.file_size);

    const reveal = async (event) => {
        event.stopPropagation();

        if (busy) return;

        try {
            setBusy(true);

            const res = await fetch(url);

            if (!res.ok) {
                throw new Error("Download failed");
            }

            await res.blob();
            markDownloaded(currentId, att.id);
        } catch {
            toast.error("Could not download file");
        } finally {
            setBusy(false);
        }
    };

    if (!downloaded) {
        return (
            <div
                {...hoverHandlers(onHoverChange)}
                className={`relative overflow-hidden rounded-lg bg-gray-700 ${className}`}
            >
                {kind === "image" ? (
                    <img
                        src={url}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                    />
                ) : (
                    <video
                        src={url}
                        muted
                        preload="metadata"
                        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                    />
                )}

                <div className="absolute inset-0 bg-black/10" />

                <button
                    type="button"
                    onClick={reveal}
                    className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-black/75"
                >
                    {busy ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Download size={18} />
                    )}

                    {size}
                </button>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            {...hoverHandlers(onHoverChange)}
            onClick={() => onOpenViewer?.(att)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenViewer?.(att);
                }
            }}
            className={`group/media relative cursor-pointer overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${className}`}
        >
            {kind === "image" ? (
                <img
                    src={url}
                    alt={att.file_name || "Image"}
                    loading="lazy"
                    className="block h-full w-full object-cover"
                />
            ) : (
                <>
                    <video
                        src={url}
                        preload="metadata"
                        className="block h-full w-full bg-black object-cover"
                    />

                    <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white">
                        <Play size={22} fill="white" />
                    </span>
                </>
            )}

            {/* Per-item hover preview label. Bound to THIS tile only
                (group/media) — it never reacts to the message row. */}
            {!overlay && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-medium text-white opacity-0 transition-opacity group-hover/media:opacity-100 group-focus-visible/media:opacity-100">
                    Preview
                </span>
            )}

            {overlay}
        </div>
    );
}

/* ---------- one normal attachment ---------- */

function AttachmentItem({
    att,
    own,
    currentId,
    onOpenViewer,
    onHoverChange,
}) {
    const kind = kindOf(att.file_type, att.file_name);
    const [busy, setBusy] = useState(false);

    /* ----- photos & videos ----- */

    if (kind === "image" || kind === "video") {
        return (
            <MediaPreview
                att={att}
                own={own}
                currentId={currentId}
                onOpenViewer={onOpenViewer}
                onHoverChange={onHoverChange}
                className="h-[200px] w-[280px] max-w-full"
            />
        );
    }

    /* ----- documents ----- */

    const downloaded = useIsDownloaded(currentId, att.id, own);

    const url = attachmentUrl(att, currentId);
    const ext = getExt(att.file_name).toUpperCase();
    const size = formatSize(att.file_size);

    const reveal = async (event) => {
        event.stopPropagation();

        if (busy) return;

        try {
            setBusy(true);

            const res = await fetch(url);

            if (!res.ok) {
                throw new Error("Download failed");
            }

            await res.blob();
            markDownloaded(currentId, att.id);
        } catch {
            toast.error("Could not download file");
        } finally {
            setBusy(false);
        }
    };

    const run = (fn) => async (event) => {
        event.stopPropagation();

        try {
            await fn(url, att.file_name);
        } catch {
            toast.error("Could not save file");
        }
    };

    const openDoc = () => {
        if (!downloaded) return;

        if (kind === "pdf") {
            onOpenViewer?.(att);
        } else {
            openWithSystemApp(att, currentId);
        }
    };

    const meta = [ext, size]
        .filter(Boolean)
        .join(" • ");

    return (
        <div
            {...hoverHandlers(onHoverChange)}
            className="w-[320px] max-w-full overflow-hidden rounded-lg bg-black/10"
        >
            {downloaded && kind === "pdf" && (
                <div className="cursor-pointer" onClick={openDoc}>
                    <PdfThumb url={url} />
                </div>
            )}

            <div
                role={downloaded ? "button" : undefined}
                onClick={openDoc}
                className={`flex items-center gap-3 p-3 ${
                    downloaded ? "cursor-pointer" : ""
                }`}
            >
                <FileExtIcon name={att.file_name} size={38} />

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                        {att.file_name}
                    </p>

                    <p className="mt-0.5 text-[11px] opacity-70">
                        {meta}
                    </p>
                </div>

                {!downloaded && (
                    <button
                        type="button"
                        onClick={reveal}
                        title="Download"
                        aria-label="Download"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-current/40 opacity-80 transition hover:opacity-100"
                    >
                        {busy ? (
                            <Loader2
                                size={17}
                                className="animate-spin"
                            />
                        ) : (
                            <Download size={17} />
                        )}
                    </button>
                )}
            </div>

            {downloaded && !own && (
                <div className="flex items-center justify-center gap-6 border-t border-black/10 py-2 text-xs font-semibold">
                    <button
                        type="button"
                        onClick={run(saveFileAs)}
                        className="opacity-90 hover:underline"
                    >
                        Save as
                    </button>

                    <button
                        type="button"
                        onClick={run(downloadFile)}
                        className="opacity-90 hover:underline"
                    >
                        Download
                    </button>
                </div>
            )}
        </div>
    );
}

/* ---------- WhatsApp-style 2x2 media grid ---------- */

function MediaGrid({
    attachments,
    own,
    currentId,
    onOpenViewer,
    onHoverChange,
}) {
    const visible = attachments.slice(0, 4);
    const remaining = Math.max(0, attachments.length - 4);

    return (
        <div
            className={`grid w-[340px] max-w-full gap-1 overflow-hidden rounded-lg ${
                visible.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-2"
            }`}
        >
            {/* The grid itself has NO hover behaviour. Each tile below is its
                own interaction boundary (group/media). */}
            {visible.map((att, index) => {
                const isLastVisible = index === 3;
                const showOverflow = isLastVisible && remaining > 0;

                return (
                    <MediaPreview
                        key={att.id}
                        att={att}
                        own={own}
                        currentId={currentId}
                        onOpenViewer={onOpenViewer}
                        onHoverChange={onHoverChange}
                        className={`relative ${
                            visible.length === 1
                                ? "h-[340px]"
                                : "aspect-square"
                        }`}
                        overlay={
                            showOverflow ? (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-3xl font-semibold text-white">
                                    +{remaining}
                                </span>
                            ) : null
                        }
                    />
                );
            })}
        </div>
    );
}

/* ---------- exported attachment renderer ---------- */

export default function MessageAttachments({
    message,
    currentId,
    own,
    onOpenViewer,
    onHoverChange,
}) {
    const list = message.attachments;

    if (
        !Array.isArray(list) ||
        !list.length ||
        message.deleted_at
    ) {
        return null;
    }

    const media = list.filter(isVisualAttachment);
    const documents = list.filter(
        (attachment) => !isVisualAttachment(attachment)
    );

    return (
        <div className="mb-1.5 space-y-1.5">
            {/* 4+ visual attachments become one 2x2 grid */}
            {media.length >= 4 && (
                <MediaGrid
                    attachments={media}
                    own={own}
                    currentId={currentId}
                    onOpenViewer={onOpenViewer}
                    onHoverChange={onHoverChange}
                />
            )}

            {/* 1-3 visual attachments.
                Normally each is already its own message because Chat.jsx
                splits 1-3 uploads before sending them. This fallback keeps
                older/existing multi-attachment messages functional. */}
            {media.length > 0 && media.length < 4 && (
                <div className="space-y-1.5">
                    {media.map((att) => (
                        <AttachmentItem
                            key={att.id}
                            att={att}
                            own={own}
                            currentId={currentId}
                            onOpenViewer={onOpenViewer}
                            onHoverChange={onHoverChange}
                        />
                    ))}
                </div>
            )}

            {/* Documents retain their existing behavior. */}
            {documents.map((att) => (
                <AttachmentItem
                    key={att.id}
                    att={att}
                    own={own}
                    currentId={currentId}
                    onOpenViewer={onOpenViewer}
                    onHoverChange={onHoverChange}
                />
            ))}
        </div>
    );
}