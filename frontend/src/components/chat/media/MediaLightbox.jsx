/**
 * MediaLightbox.jsx
 *
 * Frontend component/module for HRMS application
 */

// frontend/src/components/chat/media/MediaLightbox.jsx
//
// Opens photos / videos / PDFs in the same window.
//  - photo: small, centred; left toolbar = rotate L/R, zoom in/out, flip H/V, download
//  - thumbnail strip + left/right arrows to move between media
//  - Esc closes, arrow keys navigate

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    ChevronLeft,
    ChevronRight,
    Download,
    FlipHorizontal2,
    FlipVertical2,
    Play,
    RotateCcw,
    RotateCw,
    Save,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import toast from "react-hot-toast";
import { attachmentUrl, downloadFile, kindOf, saveFileAs } from "./mediaUtils";

const DEFAULT_VIEW = { rot: 0, zoom: 1, flipH: false, flipV: false };

function SideButton({ title, onClick, children }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
        >
            {children}
        </button>
    );
}

export default function MediaLightbox({ items, startId, currentId, onClose }) {
    const [index, setIndex] = useState(() =>
        Math.max(0, items.findIndex((item) => Number(item.id) === Number(startId)))
    );
    const [view, setView] = useState(DEFAULT_VIEW);

    const item = items[index];
    const kind = item ? kindOf(item.file_type, item.file_name) : "image";
    const url = item ? attachmentUrl(item, currentId) : "";

    const go = useCallback(
        (delta) => {
            setIndex((i) => {
                const next = i + delta;
                return next < 0 || next >= items.length ? i : next;
            });
            setView(DEFAULT_VIEW);
        },
        [items.length]
    );

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowLeft") go(-1);
            if (event.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [go, onClose]);

    if (!item) return null;

    const zoomBy = (factor) =>
        setView((v) => ({ ...v, zoom: Math.min(5, Math.max(0.25, v.zoom * factor)) }));

    const run = (fn) => async () => {
        try {
            await fn(url, item.file_name);
        } catch {
            toast.error("Could not save file");
        }
    };

    const imageTransform = `scale(${view.zoom * (view.flipH ? -1 : 1)}, ${
        view.zoom * (view.flipV ? -1 : 1)
    }) rotate(${view.rot}deg)`;

    return createPortal(
        <div
            className="fixed inset-0 z-[250] flex flex-col bg-[#0b0d0e]/95 text-white"
            role="dialog"
            aria-modal="true"
            data-chat-overlay-root
        >
            {/* top bar */}
            <div className="flex h-16 shrink-0 items-center justify-between px-4">
                <button
                    type="button"
                    onClick={onClose}
                    title="Close (Esc)"
                    aria-label="Close"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                >
                    <X size={22} />
                </button>

                <p className="max-w-[50%] truncate text-sm font-medium">{item.file_name}</p>

                <div className="flex items-center gap-1">
                    <SideButton title="Save as" onClick={run(saveFileAs)}>
                        <Save size={20} />
                    </SideButton>
                    {kind !== "image" && (
                        <SideButton title="Download" onClick={run(downloadFile)}>
                            <Download size={20} />
                        </SideButton>
                    )}
                </div>
            </div>

            {/* stage */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                {kind === "image" && (
                    <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-full bg-black/40 p-1.5">
                        <SideButton
                            title="Rotate left"
                            onClick={() => setView((v) => ({ ...v, rot: v.rot - 90 }))}
                        >
                            <RotateCcw size={20} />
                        </SideButton>
                        <SideButton
                            title="Rotate right"
                            onClick={() => setView((v) => ({ ...v, rot: v.rot + 90 }))}
                        >
                            <RotateCw size={20} />
                        </SideButton>
                        <SideButton title="Zoom in" onClick={() => zoomBy(1.25)}>
                            <ZoomIn size={20} />
                        </SideButton>
                        <SideButton title="Zoom out" onClick={() => zoomBy(0.8)}>
                            <ZoomOut size={20} />
                        </SideButton>
                        <SideButton
                            title="Flip horizontal"
                            onClick={() => setView((v) => ({ ...v, flipH: !v.flipH }))}
                        >
                            <FlipHorizontal2 size={20} />
                        </SideButton>
                        <SideButton
                            title="Flip vertical"
                            onClick={() => setView((v) => ({ ...v, flipV: !v.flipV }))}
                        >
                            <FlipVertical2 size={20} />
                        </SideButton>
                        <SideButton title="Download" onClick={run(downloadFile)}>
                            <Download size={20} />
                        </SideButton>
                    </div>
                )}

                {kind === "image" && (
                    <img
                        key={item.id}
                        src={url}
                        alt={item.file_name}
                        draggable={false}
                        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.1 : 0.9)}
                        className="max-h-[62vh] max-w-[62vw] select-none object-contain transition-transform duration-200"
                        style={{ transform: imageTransform }}
                    />
                )}

                {kind === "video" && (
                    <video
                        key={item.id}
                        src={url}
                        controls
                        autoPlay
                        className="max-h-[70vh] max-w-[70vw] rounded-lg bg-black"
                    />
                )}

                {kind === "pdf" && (
                    <iframe
                        key={item.id}
                        title={item.file_name}
                        src={url}
                        className="h-full w-[min(92vw,900px)] rounded-lg bg-white"
                    />
                )}

                {index > 0 && (
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        aria-label="Previous"
                        className="absolute left-20 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
                {index < items.length - 1 && (
                    <button
                        type="button"
                        onClick={() => go(1)}
                        aria-label="Next"
                        className="absolute right-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                    >
                        <ChevronRight size={24} />
                    </button>
                )}
            </div>

            {/* thumbnail strip */}
            {items.length > 1 && (
                <div className="flex h-24 shrink-0 items-center justify-center gap-2 overflow-x-auto border-t border-white/10 px-4">
                    {items.map((thumb, i) => {
                        const thumbKind = kindOf(thumb.file_type, thumb.file_name);
                        const thumbUrl = attachmentUrl(thumb, currentId);
                        return (
                            <button
                                key={thumb.id}
                                type="button"
                                onClick={() => {
                                    setIndex(i);
                                    setView(DEFAULT_VIEW);
                                }}
                                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#2a2f32] ${
                                    i === index ? "ring-2 ring-emerald-500" : "opacity-70 hover:opacity-100"
                                }`}
                            >
                                {thumbKind === "video" ? (
                                    <>
                                        <video
                                            src={thumbUrl}
                                            muted
                                            preload="metadata"
                                            className="h-full w-full object-cover"
                                        />
                                        <Play
                                            size={14}
                                            fill="white"
                                            className="absolute bottom-1 left-1 text-white"
                                        />
                                    </>
                                ) : (
                                    <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>,
        document.body
    );
}
