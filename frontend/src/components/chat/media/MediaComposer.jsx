// frontend/src/components/chat/media/MediaComposer.jsx
//
// WhatsApp-style "preview before sending" screen.
//  - photos: Freeform Crop + Doodle, undo / redo, copy, download, done
//  - videos: preview + download
//  - PDF: preview + download
//  - any other document: "No preview available" card
//  - caption input, thumbnail strip with hover-remove, always-present "+" box, send
//  - closing (X / Esc) asks "Discard selection?" first
//
// Placement
//  When `container` (a DOM node) is passed, the composer is portalled INTO it
//  and fills only that area (the chat conversation pane), so the sidebar and
//  top bar stay visible. Without `container` it falls back to full screen.
//
// Preview URLs
//  Blob URLs are not kept in state. Each preview creates its own URL with
//  useObjectUrl(file) and revokes it in the same effect (Strict-Mode safe).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    Check,
    Copy,
    Crop,
    Download,
    Loader2,
    Pencil,
    Play,
    Plus,
    Redo2,
    Send,
    Smile,
    Undo2,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import ImageEditorStage, { DOODLE_COLORS } from "./ImageEditorStage";
import { FileExtIcon, formatSize, getExt, kindOf } from "./mediaUtils";

let idCounter = 0;
const makeItem = (file) => ({
    id: ++idCounter,
    file,
    ver: 0,
});

/* Creates a blob URL for `file` and revokes it when the file changes or the
   component unmounts. Returns null until the URL exists (first render). */
function useObjectUrl(file) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return undefined;
        }
        const next = URL.createObjectURL(file);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    return url;
}

function saveBlobLocally(file) {
    const href = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function ToolButton({ title, onClick, active = false, children, accent = false }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                accent
                    ? "bg-emerald-500 text-white hover:bg-emerald-400"
                    : active
                      ? "bg-white/20 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
        >
            {children}
        </button>
    );
}

/* One small preview box in the thumbnail strip. Owns its own blob URL. */
function Thumb({ item, selected, onSelect, onRemove }) {
    const itemKind = kindOf(item.file.type, item.file.name);
    const url = useObjectUrl(
        itemKind === "image" || itemKind === "video" ? item.file : null
    );

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => e.key === "Enter" && onSelect()}
            className={`group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-[#2a2f32] ${
                selected ? "ring-2 ring-emerald-500" : "ring-1 ring-white/10"
            }`}
        >
            {itemKind === "image" && url && (
                <img src={url} alt="" className="h-full w-full object-cover" />
            )}
            {itemKind === "video" && url && (
                <>
                    <video
                        src={url}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                    />
                    <Play
                        size={16}
                        fill="white"
                        className="absolute bottom-1 left-1 text-white"
                    />
                </>
            )}
            {(itemKind === "pdf" || itemKind === "doc") && (
                <div className="flex h-full w-full items-center justify-center">
                    <FileExtIcon name={item.file.name} size={32} />
                </div>
            )}

            {/* hover: light background + centred cross removes the item */}
            <button
                type="button"
                title="Remove"
                aria-label="Remove"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="absolute inset-0 hidden items-center justify-center bg-white/30 text-white group-hover:flex"
            >
                <X size={20} />
            </button>
        </div>
    );
}

export default function MediaComposer({
    initialFiles,
    onClose,
    onSend,
    busy = false,
    EmojiPicker = null,
    container = null,
}) {
    const [items, setItems] = useState(() => initialFiles.map(makeItem));
    const [activeId, setActiveId] = useState(() => null);
    const [mode, setMode] = useState("none"); // none | crop | doodle
    const [color, setColor] = useState(DOODLE_COLORS[0]);
    const [edit, setEdit] = useState({ canUndo: false, canRedo: false, dirty: false, cropChanged: false });
    const [caption, setCaption] = useState("");
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const stageRef = useRef(null);
    const addInputRef = useRef(null);

    const current = items.find((item) => item.id === activeId) || items[0];
    const kind = current ? kindOf(current.file.type, current.file.name) : "doc";
    const hasEdits = edit.dirty || edit.cropChanged;

    // blob URL for the big video / PDF preview (images use ImageEditorStage)
    const stageUrl = useObjectUrl(
        current && (kind === "video" || kind === "pdf") ? current.file : null
    );

    // X button / Esc never close directly: they ask first
    const requestClose = useCallback(() => {
        if (!busy) setDiscardOpen(true);
    }, [busy]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key !== "Escape" || busy) return;
            // first Esc asks, second Esc (or Cancel) keeps the preview
            setDiscardOpen((open) => !open);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [busy]);

    /* ---------- commit edits of the current image into its item ---------- */
    const commit = useCallback(async () => {
        if (!current || kind !== "image" || !stageRef.current || !hasEdits) return items;
        const edited = await stageRef.current.exportFile();
        const next = items.map((item) =>
            item.id === current.id ? { ...item, file: edited, ver: item.ver + 1 } : item
        );
        setItems(next);
        setMode("none");
        setEdit({ canUndo: false, canRedo: false, dirty: false, cropChanged: false });
        return next;
    }, [current, hasEdits, items, kind]);

    const selectItem = async (id) => {
        if (id === current?.id) return;
        await commit();
        setMode("none");
        setEdit({ canUndo: false, canRedo: false, dirty: false, cropChanged: false });
        setActiveId(id);
    };

    const removeItem = (id) => {
        const target = items.find((item) => item.id === id);
        if (!target) return;
        const next = items.filter((item) => item.id !== id);
        if (!next.length) {
            onClose();
            return;
        }
        setItems(next);
        if (current?.id === id) {
            setActiveId(next[0].id);
            setMode("none");
            setEdit({ canUndo: false, canRedo: false, dirty: false, cropChanged: false });
        }
    };

    const addFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length) return;
        await commit();
        const added = files.map(makeItem);
        setItems((prev) => [...prev, ...added]);
        setActiveId(added[0].id);
    };

    const handleSend = async () => {
        if (busy) return;
        const finalItems = await commit();
        onSend({ files: finalItems.map((item) => item.file), caption });
    };

    const handleDownload = async () => {
        if (kind === "image" && stageRef.current) {
            saveBlobLocally(await stageRef.current.exportFile());
        } else if (current) {
            saveBlobLocally(current.file);
        }
    };

    const handleCopy = async () => {
        try {
            await stageRef.current.copy();
            toast.success("Image copied");
        } catch {
            toast.error("Could not copy image");
        }
    };

    const toggleMode = (next) => setMode((value) => (value === next ? "none" : next));

    if (!current) return null;

    // inside the chat pane when a container is given, otherwise full screen
    const rootPlacement = container ? "absolute inset-0 z-[90]" : "fixed inset-0 z-[235]";

    return createPortal(
        <div
            className={`${rootPlacement} flex flex-col bg-[#161717] text-white`}
            data-chat-overlay-root
        >
            {/* ================= top bar ================= */}
            <div className="relative flex h-16 shrink-0 items-center justify-between px-4">
                <ToolButton title="Close" onClick={requestClose}>
                    <X size={22} />
                </ToolButton>

                {kind !== "image" && (
                    <div className="pointer-events-none absolute inset-x-0 text-center">
                        <p className="truncate px-24 text-sm font-medium">{current.file.name}</p>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    {kind === "image" && edit.canUndo && (
                        <ToolButton title="Undo" onClick={() => stageRef.current?.undo()}>
                            <Undo2 size={20} />
                        </ToolButton>
                    )}
                    {kind === "image" && edit.canRedo && (
                        <ToolButton title="Redo" onClick={() => stageRef.current?.redo()}>
                            <Redo2 size={20} />
                        </ToolButton>
                    )}
                    {kind === "image" && (
                        <>
                            <ToolButton
                                title="Freeform crop"
                                active={mode === "crop"}
                                onClick={() => toggleMode("crop")}
                            >
                                <Crop size={20} />
                            </ToolButton>
                            <ToolButton
                                title="Doodle"
                                active={mode === "doodle"}
                                onClick={() => toggleMode("doodle")}
                            >
                                <Pencil size={20} />
                            </ToolButton>
                            <ToolButton title="Copy" onClick={handleCopy}>
                                <Copy size={20} />
                            </ToolButton>
                        </>
                    )}
                    <ToolButton title="Download" onClick={handleDownload}>
                        <Download size={20} />
                    </ToolButton>
                    {kind === "image" && hasEdits && (
                        <ToolButton title="Done" accent onClick={commit}>
                            <Check size={20} />
                        </ToolButton>
                    )}
                </div>
            </div>

            {/* ================= stage ================= */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                {kind === "image" && (
                    <>
                        <ImageEditorStage
                            key={`${current.id}-${current.ver}`}
                            ref={stageRef}
                            file={current.file}
                            mode={mode}
                            color={color}
                            onState={setEdit}
                        />
                        {mode === "doodle" && (
                            <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-2 rounded-full bg-black/40 p-2">
                                {DOODLE_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        aria-label={`Colour ${c}`}
                                        className={`h-6 w-6 rounded-full border-2 ${
                                            color === c ? "border-white" : "border-transparent"
                                        }`}
                                        style={{ background: c }}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {kind === "video" && stageUrl && (
                    <video
                        key={current.id}
                        src={stageUrl}
                        controls
                        className="max-h-full max-w-[92%] rounded-lg bg-black"
                    />
                )}

                {kind === "pdf" && stageUrl && (
                    <iframe
                        key={current.id}
                        title={current.file.name}
                        src={`${stageUrl}#toolbar=0&navpanes=0`}
                        className="h-full w-[min(92%,720px)] rounded-lg bg-white"
                    />
                )}

                {kind === "doc" && (
                    <div className="flex w-[420px] max-w-[92%] flex-col items-center rounded-2xl bg-[#101d22] px-8 py-14">
                        <FileExtIcon name={current.file.name} size={84} />
                        <p className="mt-5 text-xl text-white/70">No preview available</p>
                        <p className="mt-1 text-sm text-white/50">
                            {formatSize(current.file.size)} - {getExt(current.file.name).toUpperCase()}
                        </p>
                    </div>
                )}
            </div>

            {/* ================= caption ================= */}
            <div className="relative mx-auto mb-4 mt-2 w-full max-w-[600px] shrink-0 px-4">
                <div className="flex items-center rounded-xl bg-[#202325] px-4">
                    <input
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type a message"
                        className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/50"
                    />
                    {EmojiPicker && (
                        <button
                            type="button"
                            onClick={() => setEmojiOpen((v) => !v)}
                            className="p-1 text-white/60 hover:text-white"
                            aria-label="Emoji"
                        >
                            <Smile size={20} />
                        </button>
                    )}
                </div>

                {EmojiPicker && emojiOpen && (
                    <div className="absolute bottom-[calc(100%+8px)] right-4 z-10 text-gray-900">
                        <EmojiPicker
                            onSelect={(emoji) => setCaption((value) => `${value}${emoji}`)}
                            onClose={() => setEmojiOpen(false)}
                        />
                    </div>
                )}
            </div>

            {/* ================= thumbnails + send ================= */}
            <div className="flex h-24 shrink-0 items-center justify-center border-t border-white/10 px-4">
                <div className="flex max-w-[calc(100%-96px)] items-center gap-2 overflow-x-auto py-2">
                    {items.map((item) => (
                        <Thumb
                            key={item.id}
                            item={item}
                            selected={item.id === current.id}
                            onSelect={() => selectItem(item.id)}
                            onRemove={() => removeItem(item.id)}
                        />
                    ))}

                    {/* always-available "+" box */}
                    <button
                        type="button"
                        title="Add more"
                        aria-label="Add more files"
                        onClick={() => addInputRef.current?.click()}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/30 text-white/80 transition hover:bg-white/10"
                    >
                        <Plus size={22} />
                    </button>
                    <input
                        ref={addInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.js,.json,.md"
                        onChange={addFiles}
                    />
                </div>

                <button
                    type="button"
                    onClick={handleSend}
                    disabled={busy}
                    title="Send"
                    aria-label="Send"
                    className="absolute bottom-5 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400 disabled:opacity-60"
                >
                    {busy ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
                    {items.length > 1 && !busy && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-gray-900">
                            {items.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ================= discard confirmation ================= */}
            {discardOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Discard selection"
                    className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px] animate-chat-fade"
                >
                    <div className="w-full max-w-[320px] overflow-hidden rounded-[28px] bg-white text-gray-900 shadow-2xl animate-chat-modal">
                        <div className="px-6 pb-5 pt-7 text-center">
                            <h3 className="text-[20px] font-medium tracking-tight text-gray-900">
                                Discard selection?
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-gray-500">
                                {items.length === 1
                                    ? "Your selected file and any edits will be removed."
                                    : `Your ${items.length} selected files and any edits will be removed.`}
                            </p>
                        </div>
                        <div className="px-4 pb-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex w-full items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                                Discard
                            </button>
                        </div>
                        <div className="px-4 pb-5">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setDiscardOpen(false)}
                                className="flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        container || document.body
    );
}