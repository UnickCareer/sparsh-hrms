/**
 * ImageEditorStage.jsx
 *
 * Frontend component/module for HRMS application
 */

// frontend/src/components/chat/media/ImageEditorStage.jsx
//
// Canvas-based image editor: Freeform crop + Doodle, with undo / redo.
// The parent drives it through a ref (undo, redo, exportFile, copy)
// and receives { canUndo, canRedo, dirty } through onState.

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";

const MAX_HISTORY = 30;
const MIN_CROP = 0.05;
const FULL = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

export const DOODLE_COLORS = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff", "#000000"];

const HANDLES = [
    ["tl", "left-0 top-0 cursor-nwse-resize"],
    ["t", "left-1/2 top-0 cursor-ns-resize"],
    ["tr", "left-full top-0 cursor-nesw-resize"],
    ["l", "left-0 top-1/2 cursor-ew-resize"],
    ["r", "left-full top-1/2 cursor-ew-resize"],
    ["bl", "left-0 top-full cursor-nesw-resize"],
    ["b", "left-1/2 top-full cursor-ns-resize"],
    ["br", "left-full top-full cursor-nwse-resize"],
];

const ImageEditorStage = forwardRef(function ImageEditorStage(
    { file, mode = "none", color = DOODLE_COLORS[0], onState },
    ref
) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const history = useRef([]);
    const index = useRef(-1);
    const lastPoint = useRef(null);
    const [crop, setCrop] = useState(null);
    const cropRef = useRef(null);
    cropRef.current = crop;

    const cropChanged =
        !!crop && (crop.x > 0.001 || crop.y > 0.001 || crop.w < 0.999 || crop.h < 0.999);

    const cropChangedRef = useRef(false);
    cropChangedRef.current = cropChanged;

    const report = useCallback(() => {
        onState?.({
            canUndo: index.current > 0,
            canRedo: index.current < history.current.length - 1,
            dirty: index.current > 0,
            cropChanged: cropChangedRef.current,
        });
    }, [onState]);

    // crop-change flag is reported separately (it lives in React state)
    useEffect(() => {
        onState?.({
            canUndo: index.current > 0,
            canRedo: index.current < history.current.length - 1,
            dirty: index.current > 0,
            cropChanged,
        });
    }, [cropChanged, onState]);

    const snapshot = () => {
        const source = canvasRef.current;
        const copy = document.createElement("canvas");
        copy.width = source.width;
        copy.height = source.height;
        copy.getContext("2d").drawImage(source, 0, 0);
        return copy;
    };

    const pushHistory = useCallback(() => {
        history.current = history.current.slice(0, index.current + 1);
        history.current.push(snapshot());
        if (history.current.length > MAX_HISTORY) history.current.splice(1, 1);
        index.current = history.current.length - 1;
        report();
    }, [report]);

    const restore = useCallback(
        (i) => {
            const snap = history.current[i];
            const canvas = canvasRef.current;
            if (!snap || !canvas) return;
            canvas.width = snap.width;
            canvas.height = snap.height;
            canvas.getContext("2d").drawImage(snap, 0, 0);
            index.current = i;
            setCrop((current) => (current ? { ...FULL } : current));
            report();
        },
        [report]
    );

    /* ---------- load image ---------- */
    useEffect(() => {
        if (!file || !String(file.type).startsWith("image/")) return undefined;
        let cancelled = false;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            if (cancelled || !canvasRef.current) return;
            const canvas = canvasRef.current;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            history.current = [];
            index.current = -1;
            pushHistory();
            setCrop(null);
            URL.revokeObjectURL(url);
        };
        img.src = url;
        return () => {
            cancelled = true;
            URL.revokeObjectURL(url);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    /* ---------- crop box lifecycle ---------- */
    useEffect(() => {
        setCrop(mode === "crop" ? { ...FULL } : null);
    }, [mode]);

    const applyCrop = useCallback(() => {
        const c = cropRef.current;
        const canvas = canvasRef.current;
        if (!c || !canvas) return;
        const sx = Math.round(c.x * canvas.width);
        const sy = Math.round(c.y * canvas.height);
        const sw = Math.max(1, Math.round(c.w * canvas.width));
        const sh = Math.max(1, Math.round(c.h * canvas.height));
        const out = document.createElement("canvas");
        out.width = sw;
        out.height = sh;
        out.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext("2d").drawImage(out, 0, 0);
        pushHistory();
        setCrop({ ...FULL });
    }, [pushHistory]);

    const startCropDrag = (event, handle) => {
        event.preventDefault();
        event.stopPropagation();
        const box = wrapRef.current.getBoundingClientRect();
        const origin = { x: event.clientX, y: event.clientY, crop: { ...cropRef.current } };

        const move = (ev) => {
            const dx = (ev.clientX - origin.x) / box.width;
            const dy = (ev.clientY - origin.y) / box.height;
            const c = origin.crop;
            if (handle === "move") {
                setCrop({
                    x: clamp(c.x + dx, 0, 1 - c.w),
                    y: clamp(c.y + dy, 0, 1 - c.h),
                    w: c.w,
                    h: c.h,
                });
                return;
            }
            let l = c.x;
            let t = c.y;
            let r = c.x + c.w;
            let b = c.y + c.h;
            if (handle.includes("l")) l = clamp(l + dx, 0, r - MIN_CROP);
            if (handle.includes("r")) r = clamp(r + dx, l + MIN_CROP, 1);
            if (handle.includes("t")) t = clamp(t + dy, 0, b - MIN_CROP);
            if (handle.includes("b")) b = clamp(b + dy, t + MIN_CROP, 1);
            setCrop({ x: l, y: t, w: r - l, h: b - t });
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    };

    /* ---------- doodle ---------- */
    const toCanvasPoint = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) * canvas.width) / rect.width,
            y: ((event.clientY - rect.top) * canvas.height) / rect.height,
        };
    };

    const strokeTo = (point) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(4, canvas.width / 120);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPoint.current = point;
    };

    const onPointerDown = (event) => {
        if (mode !== "doodle") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        lastPoint.current = toCanvasPoint(event);
        strokeTo({ ...lastPoint.current, x: lastPoint.current.x + 0.01 });
    };
    const onPointerMove = (event) => {
        if (mode !== "doodle" || !lastPoint.current) return;
        strokeTo(toCanvasPoint(event));
    };
    const endStroke = () => {
        if (!lastPoint.current) return;
        lastPoint.current = null;
        pushHistory();
    };

    /* ---------- imperative API ---------- */
    const exportFile = useCallback(async () => {
        if (cropRef.current && cropChanged) applyCrop();
        const canvas = canvasRef.current;
        const keep = /^image\/(jpeg|webp)$/.test(file.type) ? file.type : "image/png";
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, keep, 0.92));
        const ext = keep === "image/png" ? "png" : keep === "image/jpeg" ? "jpg" : "webp";
        const base = file.name.replace(/\.[^.]+$/, "");
        return new File([blob], `${base}.${ext}`, { type: keep, lastModified: Date.now() });
    }, [applyCrop, cropChanged, file]);

    useImperativeHandle(
        ref,
        () => ({
            undo: () => index.current > 0 && restore(index.current - 1),
            redo: () =>
                index.current < history.current.length - 1 && restore(index.current + 1),
            exportFile,
            copy: async () => {
                const blob = await new Promise((resolve) =>
                    canvasRef.current.toBlob(resolve, "image/png")
                );
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            },
        }),
        [exportFile, restore]
    );

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <div ref={wrapRef} className="relative inline-block overflow-hidden leading-none">
                <canvas
                    ref={canvasRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endStroke}
                    onPointerCancel={endStroke}
                    className="block"
                    style={{
                        maxWidth: "min(90vw, 1100px)",
                        maxHeight: "calc(100vh - 320px)",
                        cursor: mode === "doodle" ? "crosshair" : "default",
                        touchAction: mode === "doodle" ? "none" : "auto",
                    }}
                />

                {mode === "crop" && crop && (
                    <div
                        onPointerDown={(e) => startCropDrag(e, "move")}
                        className="absolute cursor-move border border-white"
                        style={{
                            left: `${crop.x * 100}%`,
                            top: `${crop.y * 100}%`,
                            width: `${crop.w * 100}%`,
                            height: `${crop.h * 100}%`,
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                        }}
                    >
                        {HANDLES.map(([name, pos]) => (
                            <span
                                key={name}
                                onPointerDown={(e) => startCropDrag(e, name)}
                                className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-white ${pos}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

export default ImageEditorStage;
