/**
 * Chat Page Component
 *
 * Main chat interface component that handles real-time messaging, conversations,
 * group management, reactions, polls, media attachments, and file sharing.
 * Provides WhatsApp-style UI with message threading, replies, forwards, and
 * comprehensive chat management features.
 */

import { useCallback, useEffect, useMemo, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import emojiData from "@emoji-mart/data";
import { useAuth } from "../context/AuthContext";
import {
    ArrowLeft,
    Check,
    CheckCheck,
    ChevronDown,
    Copy,
    Forward,
    Loader2,
    MessageCircle,
    MoreHorizontal,
    Pencil,
    Plus,
    Reply,
    Search,
    Send,
    Smile,
    Trash2,
    Users,
    X,
    Zap,
    Pin,
    Star,
    FileText,
    ExternalLink,
    Flag,
    Image as ImageIcon,
    Paperclip,
    BarChart3,
    Clock3,
    PawPrint,
    Utensils,
    Trophy,
    Shapes,
    MapPin,
    Package,
    SmilePlus,
} from "lucide-react";
import toast from "react-hot-toast";
import PollMessage, { PollViewVotesButton } from "../components/chat/poll/PollMessage";
import PollVotesPanel from "../components/chat/poll/PollVotesPanel";
import PollComposer from "../components/chat/poll/PollComposer";
import MediaComposer from "../components/chat/media/MediaComposer";
import MediaLightbox from "../components/chat/media/MediaLightbox";
import MessageAttachments from "../components/chat/media/MessageAttachments";
import { hasDownloaded, kindOf } from "../components/chat/media/mediaUtils";
import { splitMessageTextLinks } from "../utils/messageLinks";
import ChatInfoPanel from "../components/chat/info/ChatInfoPanel";

/* =========================================================
   PHASE 2E
   Q1  WhatsApp-style hover/reaction/action UI
   Q3  Message formatting
   Q5  Reply UI
   Q6  Remove duplicate Reply/Forward box
   Q9  Remove composer helper text
========================================================= */

/* ---------------------------------------------------------
   QUICK REACTIONS
   Predefined set of commonly used emojis for rapid
   one-tap message reactions in the chat interface.
   Requirement: 5 quick emojis + +
--------------------------------------------------------- */
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

/* ---------------------------------------------------------
   FULL REACTION PICKER CONFIGURATION
   Uses @emoji-mart/data for the complete emoji catalogue and
   searchable names/keywords while keeping the existing custom UI.
   Manages category metadata, recent emoji storage, and search.
--------------------------------------------------------- */
const EMOJI_CATEGORY_META = [
    { key: "Recent", label: "Recent", Icon: Clock3, dataKey: null },
    { key: "People", label: "Smileys & People", Icon: Smile, dataKey: "people" },
    { key: "Animals", label: "Animals & Nature", Icon: PawPrint, dataKey: "nature" },
    { key: "Food", label: "Food & Drink", Icon: Utensils, dataKey: "foods" },
    { key: "Activities", label: "Activities", Icon: Trophy, dataKey: "activity" },
    { key: "Places", label: "Travel & Places", Icon: MapPin, dataKey: "places" },
    { key: "Objects", label: "Objects", Icon: Package, dataKey: "objects" },
    { key: "Symbols", label: "Symbols", Icon: Shapes, dataKey: "symbols" },
    { key: "Flags", label: "Flags", Icon: Flag, dataKey: "flags" },
];

const RECENT_EMOJIS_STORAGE_KEY = "sparsh_chat_recent_emojis";
const MAX_RECENT_EMOJIS = 32;

/*
 * Read recent emojis from localStorage
 * Retrieves and validates cached recent reaction emojis.
 */
function readRecentEmojis() {
    if (typeof window === "undefined") return [];

    try {
        const stored = JSON.parse(
            window.localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY) || "[]"
        );

        if (!Array.isArray(stored)) return [];

        return [...new Set(
            stored.filter((emoji) => typeof emoji === "string" && emoji.trim())
        )].slice(0, MAX_RECENT_EMOJIS);
    } catch {
        return [];
    }
}

/*
 * Record recent emoji in localStorage
 * Updates the recent emojis list with new entry.
 */
function recordRecentEmoji(emoji) {
    if (typeof window === "undefined" || !emoji) return;

    try {
        const current = readRecentEmojis();
        const next = [emoji, ...current.filter((item) => item !== emoji)]
            .slice(0, MAX_RECENT_EMOJIS);

        window.localStorage.setItem(
            RECENT_EMOJIS_STORAGE_KEY,
            JSON.stringify(next)
        );
    } catch {
        // Recent reactions are an enhancement; never block reacting if storage fails.
    }
}

const EMOJI_MART_CATEGORY_BY_KEY = Object.fromEntries(
    EMOJI_CATEGORY_META
        .filter((item) => item.dataKey)
        .map((item) => [item.key, item.dataKey])
);

/*
 * Get emoji mart entries
 * Processes emoji data into searchable entries.
 */
function getEmojiMartEntries() {
    const emojis = emojiData?.emojis || {};

    return Object.values(emojis)
        .map((emoji) => {
            const native =
                emoji?.skins?.find((skin) => skin?.native)?.native ||
                emoji?.native ||
                "";

            if (!native) return null;

            const keywords = Array.isArray(emoji?.keywords)
                ? emoji.keywords
                : [];
            const aliases = Array.isArray(emoji?.aliases)
                ? emoji.aliases
                : [];

            return {
                id: emoji?.id || native,
                native,
                name: emoji?.name || "",
                keywords,
                aliases,
                searchText: [
                    emoji?.id || "",
                    emoji?.name || "",
                    ...keywords,
                    ...aliases,
                ]
                    .join(" ")
                    .toLowerCase(),
            };
        })
        .filter(Boolean);
}

const EMOJI_MART_ENTRIES = getEmojiMartEntries();
const EMOJI_MART_BY_NATIVE = new Map(
    EMOJI_MART_ENTRIES.map((emoji) => [emoji.native, emoji])
);

const EMOJI_MART_CATEGORY_EMOJIS = Object.fromEntries(
    EMOJI_CATEGORY_META
        .filter((item) => item.dataKey)
        .map((item) => {
            const category = (emojiData?.categories || []).find(
                (entry) => entry?.id === item.dataKey
            );

            const list = (category?.emojis || [])
                .map((emojiId) => {
                    const entry = emojiData?.emojis?.[emojiId];
                    const native =
                        entry?.skins?.find((skin) => skin?.native)?.native ||
                        entry?.native ||
                        "";
                    return native;
                })
                .filter(Boolean);

            return [item.key, list];
        })
);

/*
 * Search emoji mart catalogue
 * Performs multi-term search across emoji metadata.
 */
function searchEmojiMart(query) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return [];

    const terms = normalized.split(/\s+/).filter(Boolean);

    return EMOJI_MART_ENTRIES
        .filter((emoji) => terms.every((term) => emoji.searchText.includes(term)))
        .map((emoji) => emoji.native);
}

/*
 * Get user initials
 * Extracts initials from display name for avatar fallback.
 */
function getInitials(name = "") {
    return (
        name
            .trim()
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "?"
    );
}

/*
 * Format time
 * Formats timestamp for message display.
 */
function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/*
 * Format conversation time
 * Formats timestamp for conversation list display.
 */
function formatConversationTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return formatTime(value);
    }

    return date.toLocaleDateString([], {
        day: "2-digit",
        month: "short",
    });
}

function initialsClass(seed = "") {
    const palette = [
        "from-orange-500 to-amber-500",
        "from-violet-500 to-fuchsia-500",
        "from-sky-500 to-cyan-500",
        "from-emerald-500 to-teal-500",
        "from-rose-500 to-pink-500",
        "from-indigo-500 to-blue-500",
    ];

    const score = [...seed].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        0
    );

    return palette[score % palette.length];
}

function Avatar({ name, avatar, size = "md", online = false }) {
    const sizes = {
        sm: "h-9 w-9 text-xs",
        md: "h-11 w-11 text-sm",
        lg: "h-14 w-14 text-base",
    };

    if (avatar) {
        return (
            <div className={`relative shrink-0 ${sizes[size]}`}>
                <img
                    src={avatar}
                    alt={name || "Employee"}
                    className="h-full w-full rounded-2xl object-cover shadow-sm"
                />

                {online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                )}
            </div>
        );
    }

    return (
        <div className={`relative shrink-0 ${sizes[size]}`}>
            <div
                className={`flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br ${initialsClass(
                    name
                )} font-bold text-white shadow-sm`}
            >
                {getInitials(name)}
            </div>

            {online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            )}
        </div>
    );
}

/* =========================================================
   Q3 — MESSAGE FORMATTER
========================================================= */

/* =========================================================
   SEARCH HIGHLIGHT HELPER
========================================================= */

function highlightPlainText(text, query = "") {
    const value = String(text ?? "");
    const needle = String(query ?? "").trim();
    if (!needle) return value;

    const parts = value.split(
        new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    );

    return parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
            <mark
                key={`search-hit-${index}`}
                className="rounded bg-yellow-200 px-0.5 text-inherit shadow-sm"
            >
                {part}
            </mark>
        ) : (
            <span key={`search-text-${index}`}>{part}</span>
        )
    );
}

function highlightText(text, query = "") {
    return splitMessageTextLinks(text).map((part, index) => {
        if (part.type === "link") {
            return (
                <a
                    key={`message-link-${index}`}
                    href={part.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 underline underline-offset-2 decoration-blue-400/70 hover:text-blue-700"
                    onClick={(event) => event.stopPropagation()}
                >
                    {part.value}
                </a>
            );
        }

        return (
            <span key={`message-text-${index}`}>
                {highlightPlainText(part.value, query)}
            </span>
        );
    });
}

function renderInlineFormatting(text, searchQuery = "") {
    const tokens = [];

    let working = text;

    /*
      Protect code spans first.
    */
    working = working.replace(/`([^`]+)`/g, (_, value) => {
        const index = tokens.length;
        tokens.push(
            <code
                key={`inline-code-${index}`}
                className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.9em]"
            >
                {highlightText(value, searchQuery)}
            </code>
        );

        return `@@INLINE_CODE_${index}@@`;
    });

    /*
      Protect monospace blocks.
    */
    working = working.replace(/```([\s\S]*?)```/g, (_, value) => {
        const index = tokens.length;

        tokens.push(
            <pre
                key={`code-${index}`}
                className="my-1 overflow-x-auto rounded-lg bg-black/10 p-2 font-mono text-xs"
            >
                {highlightText(value, searchQuery)}
            </pre>
        );

        return `@@BLOCK_CODE_${index}@@`;
    });

    /*
      Bold
    */
    working = working.replace(/\*([^*\n]+)\*/g, (_, value) => {
        const index = tokens.length;

        tokens.push(
            <strong key={`bold-${index}`} className="font-bold">
                {highlightText(value, searchQuery)}
            </strong>
        );

        return `@@BOLD_${index}@@`;
    });

    /*
      Italic
    */
    working = working.replace(/_([^_\n]+)_/g, (_, value) => {
        const index = tokens.length;

        tokens.push(
            <em key={`italic-${index}`} className="italic">
                {highlightText(value, searchQuery)}
            </em>
        );

        return `@@ITALIC_${index}@@`;
    });

    /*
      Strikethrough
    */
    working = working.replace(/~([^~\n]+)~/g, (_, value) => {
        const index = tokens.length;

        tokens.push(
            <del key={`strike-${index}`} className="line-through">
                {highlightText(value, searchQuery)}
            </del>
        );

        return `@@STRIKE_${index}@@`;
    });

    const parts = working.split(
        /(@@(?:INLINE_CODE|BLOCK_CODE|BOLD|ITALIC|STRIKE)_\d+@@)/
    );

    return parts.map((part, index) => {
        const match = part.match(
            /^@@(?:INLINE_CODE|BLOCK_CODE|BOLD|ITALIC|STRIKE)_(\d+)@@$/
        );

        if (match) {
            return tokens[Number(match[1])];
        }

        return (
            <span key={`text-${index}`}>
                {highlightText(part, searchQuery)}
            </span>
        );
    });
}

function MessageContent({ text, deleted, searchQuery = "", trailingMeta = null }) {
    /*
      WhatsApp-style metadata handling:
      - The timestamp/read state is positioned at the bottom-right of the bubble.
      - A matching invisible inline spacer is placed ONLY at the end of the
        message content, so earlier lines keep their full width.
      - The spacer reserves room on the final visual line, preventing the
        timestamp/checkmarks from ever sitting on top of message text.
    */
    const metaSpacer = trailingMeta ? (
        <span
            aria-hidden="true"
            className="inline-block h-3 w-[58px] align-baseline"
        />
    ) : null;

    if (deleted) {
    return (
        <div className="flex items-baseline whitespace-nowrap text-sm leading-6">
            <span className="italic">
                {highlightText(text, searchQuery)}
            </span>

            {trailingMeta && (
                <span className="ml-1 inline-flex shrink-0 translate-y-[8px]">
                    {trailingMeta}
                </span>
            )}
        </div>
    );
}

    const lines = String(text || "").split("\n");

    return (
        <div className="relative break-words text-sm leading-6">
            {lines.map((line, index) => {
                const bulletMatch = line.match(/^\s*[*-]\s+(.+)$/);
                const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
                const quoteMatch = line.match(/^\s*>\s+(.+)$/);
                const codeBlockMatch = line.match(/^\s*```(.+)```\s*$/);
                const isLastLine = index === lines.length - 1;

                if (bulletMatch) {
                    return (
                        <div key={index} className="flex gap-2">
                            <span className="shrink-0">•</span>
                            <span className="min-w-0">
                                {renderInlineFormatting(bulletMatch[1], searchQuery)}
                                {isLastLine && metaSpacer}
                            </span>
                        </div>
                    );
                }

                if (numberedMatch) {
                    return (
                        <div key={index} className="flex gap-2">
                            <span className="shrink-0">{numberedMatch[1]}.</span>
                            <span className="min-w-0">
                                {renderInlineFormatting(numberedMatch[2], searchQuery)}
                                {isLastLine && metaSpacer}
                            </span>
                        </div>
                    );
                }

                if (quoteMatch) {
                    return (
                        <div
                            key={index}
                            className="my-1 border-l-2 border-current/40 pl-3 opacity-80"
                        >
                            {renderInlineFormatting(quoteMatch[1], searchQuery)}
                            {isLastLine && metaSpacer}
                        </div>
                    );
                }

                if (codeBlockMatch) {
                    return (
                        <pre
                            key={index}
                            className="my-1 overflow-x-auto rounded-lg bg-black/10 p-2 font-mono text-xs"
                        >
                            {codeBlockMatch[1]}
                        </pre>
                    );
                }

                return (
                    <div key={index} className="min-h-[1.5rem]">
                        {renderInlineFormatting(line, searchQuery)}
                        {isLastLine && metaSpacer}
                    </div>
                );
            })}

            {trailingMeta && (
                <span className="pointer-events-none absolute bottom-0 right-0 translate-y-[8px]">
                    {trailingMeta}
                </span>
            )}
        </div>
    );
}

/* =========================================================
   FULL REACTION PICKER
========================================================= */
const FULL_PICKER_HEIGHT = 380;
const PICKER_GAP_TO_ROW = 6;   // gap to the quick-emoji row (top/bottom messages)
const PICKER_GAP_TO_TRAY = -20;  // gap to the Smile/Forward buttons (middle messages)
function FullReactionPicker({ onSelect, onClose, pickerRef, maxHeight , embedded = false,
    initialCategory = "Recent",}) {
    const pickerHeight = maxHeight || FULL_PICKER_HEIGHT;
    const [category, setCategory] = useState("Recent");
    const [search, setSearch] = useState("");
    const [recentEmojis, setRecentEmojis] = useState(() => readRecentEmojis());

    useEffect(() => {
        setRecentEmojis(readRecentEmojis());
    }, []);

    const emojis = useMemo(() => {
        const query = search.trim();

        if (query) {
            // Search the complete Emoji Mart catalogue, not only the active category.
            return searchEmojiMart(query);
        }

        if (category === "Recent") {
            return recentEmojis;
        }

        return EMOJI_MART_CATEGORY_EMOJIS[category] || [];
    }, [category, recentEmojis, search]);

    const handleSelect = (emoji) => {
        recordRecentEmoji(emoji);
        setRecentEmojis(readRecentEmojis());
        onSelect?.(emoji);
        onClose?.();
    };

    return (
        <div
            ref={pickerRef}
            className={
                embedded
                    ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
                    : "flex w-[330px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-chat-pop"
            }
            style={embedded ? undefined : { height: `${pickerHeight}px` }}
            data-chat-overlay-root
        >
            <div className="border-b border-gray-100 p-3">
                <div className="relative">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                        autoFocus
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search reaction"
                        className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    />
                </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 px-2 py-2 chat-scrollbar">
                {EMOJI_CATEGORY_META.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => {
                            setSearch("");
                            setCategory(key);
                        }}
                        title={label}
                        aria-label={label}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                            category === key && !search.trim()
                                ? "bg-emerald-50 text-emerald-600"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                    >
                        <Icon size={17} strokeWidth={1.8} />
                    </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 chat-scrollbar">
                {category === "Recent" && !recentEmojis.length && !search.trim() && (
                    <div className="py-8 text-center text-xs text-gray-400">
                        No recent reactions yet
                    </div>
                )}

                <div className="grid grid-cols-8 gap-1">
                    {emojis.map((emoji, index) => {
                        const data = EMOJI_MART_BY_NATIVE.get(emoji);
                        return (
                            <button
                                key={`${emoji}-${index}`}
                                type="button"
                                onClick={() => handleSelect(emoji)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-gray-100"
                                title={data?.name || emoji}
                                aria-label={`React with ${data?.name || emoji}`}
                            >
                                {emoji}
                            </button>
                        );
                    })}
                </div>

                {!emojis.length && (category !== "Recent" || search.trim()) && (
                    <div className="py-8 text-center text-xs text-gray-400">
                        No emoji found
                    </div>
                )}
            </div>
        </div>
    );
}

/* =========================================================
   REACTION DETAILS CARD (WhatsApp-style)
========================================================= */

const REACTION_CARD_GAP = 6;
const REACTION_CARD_EDGE = 8;
const REACTION_CARD_PICKER_HEIGHT = 330;

/**
 * Reaction details card component
 * Displays reaction details and allow managing reactions.
 * @param {object} props - Component props
 * @returns {JSX.Element|null} ReactionDetailsCard component
 */
function ReactionDetailsCard({
    message,
    initialEmoji = "all",
    anchorRect = null,
    currentId,
    boundaryRef,
    onReact,
}) {
    const cardRef = useRef(null);
    const lastAnchorRef = useRef(anchorRect);
    const [tab, setTab] = useState(initialEmoji || "all");
    const [mode, setMode] = useState("details"); // "details" | "add"
    const [position, setPosition] = useState(null);
    const [busy, setBusy] = useState(false);

    const reactions = useMemo(
        () => message?.reactions || [],
        [message?.reactions]
    );
    const own = Number(message?.sender_employee_id) === Number(currentId);

    // If the selected emoji no longer exists (you removed it), fall back to "all"
    const activeTab =
        tab !== "all" && reactions.some((item) => item.emoji === tab)
            ? tab
            : "all";

    const totalCount = reactions.reduce(
        (sum, item) =>
            sum + Number(item.count || (item.employees || []).length || 0),
        0
    );

    const rows = useMemo(() => {
        const source =
            activeTab === "all"
                ? reactions
                : reactions.filter((item) => item.emoji === activeTab);

        return source
            .flatMap((item) =>
                (item.employees || []).map((person) => ({
                    emoji: item.emoji,
                    person,
                    isMe: Number(person.employee_id) === Number(currentId),
                }))
            )
            .sort((a, b) => Number(b.isMe) - Number(a.isMe));
    }, [reactions, activeTab, currentId]);

    const updatePosition = useCallback(() => {
        const card = cardRef.current;
        if (!card || !message?.id) return;

        // Follow the live reaction chips so the card moves with the chat scroll
        const liveRect = document
            .querySelector(
                `[data-chat-message-id="${message.id}"] [data-reaction-anchor]`
            )
            ?.getBoundingClientRect();

        if (liveRect) {
            lastAnchorRef.current = {
                top: liveRect.top,
                bottom: liveRect.bottom,
                left: liveRect.left,
                right: liveRect.right,
            };
        }

        const anchor = lastAnchorRef.current;
        if (!anchor) return;

        const width = card.offsetWidth;
        const height = card.offsetHeight;
        const container = boundaryRef?.current?.getBoundingClientRect();

        const viewportPadding = 8;
        const viewportTop = 72;
        const viewportBottom = window.innerHeight - viewportPadding;

        const boundaryLeft = Math.max(container?.left ?? 0, viewportPadding);
        const boundaryRight = Math.min(
            container?.right ?? window.innerWidth,
            window.innerWidth - viewportPadding
        );
        const boundaryTop = Math.max(container?.top ?? viewportTop, viewportTop);
        const boundaryBottom = Math.min(
            container?.bottom ?? viewportBottom,
            viewportBottom
        );

        const clamp = (value, min, max) =>
            Math.max(min, Math.min(value, Math.max(min, max)));

        // ---------- vertical: below the message if it fits, otherwise above ----------
        const spaceBelow = boundaryBottom - anchor.bottom - REACTION_CARD_GAP;
        const spaceAbove = anchor.top - boundaryTop - REACTION_CARD_GAP;

        let placeBelow;
        if (spaceBelow >= height) placeBelow = true;
        else if (spaceAbove >= height) placeBelow = false;
        else placeBelow = spaceBelow >= spaceAbove;

        const rawTop = placeBelow
            ? anchor.bottom + REACTION_CARD_GAP
            : anchor.top - REACTION_CARD_GAP - height;

        const top = clamp(rawTop, boundaryTop, boundaryBottom - height);

        // ---------- horizontal: align with the message side ----------
        const rawLeft = own ? anchor.right - width : anchor.left;
        const left = clamp(
            rawLeft,
            boundaryLeft + REACTION_CARD_EDGE,
            boundaryRight - width - REACTION_CARD_EDGE
        );

        setPosition({ top, left });
    }, [message?.id, own, boundaryRef]);

    // Re-measure whenever the card's content size can change
    useLayoutEffect(() => {
        updatePosition();
    }, [updatePosition, mode, activeTab, rows.length, reactions.length]);

    useEffect(() => {
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [updatePosition]);

    const handleReact = async (emoji) => {
        if (busy) return;

        try {
            setBusy(true);
            await onReact(message, emoji);
        } finally {
            setBusy(false);
        }
    };

    if (!message) return null;

    const chipClass = (active) =>
        `flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
            active
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`;

    return createPortal(
        <div
            ref={cardRef}
            data-chat-overlay-root
            className="fixed z-[1002] w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-2xl animate-chat-pop"
            style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
            }}
        >
            {/* ---------- header + tabs ---------- */}
            <div className="px-4 pb-3 pt-4">
                <p className="text-sm font-semibold text-gray-500">
                    {totalCount === 0
                        ? "No reactions"
                        : `${totalCount} reaction${totalCount === 1 ? "" : "s"}`}
                </p>

                <div className="chat-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                        type="button"
                        onClick={() =>
                            setMode((current) =>
                                current === "add" ? "details" : "add"
                            )
                        }
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                            mode === "add"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                        title="Add reaction"
                        aria-label="Add reaction"
                    >
                        <SmilePlus size={18} />
                    </button>

                    {reactions.length > 1 && (
                        <button
                            type="button"
                            onClick={() => {
                                setTab("all");
                                setMode("details");
                            }}
                            className={chipClass(
                                mode === "details" && activeTab === "all"
                            )}
                        >
                            <span>All</span>
                            <span>{totalCount}</span>
                        </button>
                    )}

                    {reactions.map((item) => (
                        <button
                            key={item.emoji}
                            type="button"
                            onClick={() => {
                                setTab(item.emoji);
                                setMode("details");
                            }}
                            className={chipClass(
                                mode === "details" && activeTab === item.emoji
                            )}
                        >
                            <span className="text-base leading-none">{item.emoji}</span>
                            <span>{item.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ---------- body ---------- */}
            <div className="border-t border-gray-100">
                {mode === "add" ? (
                    <div style={{ height: REACTION_CARD_PICKER_HEIGHT }}>
                        <FullReactionPicker
                            embedded
                            initialCategory={
                                readRecentEmojis().length ? "Recent" : "People"
                            }
                            onSelect={(emoji) => {
                                setTab(emoji);
                                setMode("details"); // card stays open
                                handleReact(emoji);
                            }}
                        />
                    </div>
                ) : rows.length ? (
                    <div className="chat-scrollbar max-h-[256px] overflow-y-auto">
                        {rows.map(({ emoji, person, isMe }) => {
                            const content = (
                                <>
                                    <Avatar
                                        name={person.full_name}
                                        avatar={person.avatar}
                                        size="sm"
                                    />

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-gray-800">
                                            {isMe ? "You" : person.full_name}
                                        </p>
                                        {isMe && (
                                            <p className="text-xs text-gray-400">
                                                Click to remove
                                            </p>
                                        )}
                                    </div>

                                    <span className="text-2xl leading-none">{emoji}</span>
                                </>
                            );

                            return isMe ? (
                                <button
                                    key={`${person.employee_id}-${emoji}`}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleReact(emoji)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:opacity-60"
                                    title="Click to remove your reaction"
                                >
                                    {content}
                                </button>
                            ) : (
                                <div
                                    key={`${person.employee_id}-${emoji}`}
                                    className="flex w-full items-center gap-3 px-4 py-3"
                                >
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="px-4 py-8 text-center text-xs text-gray-400">
                        No reactions yet. Use the reaction button above to add one.
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
/* =========================================================
   EMPTY STATE
========================================================= */

/**
 * Empty state component for no conversation selected
 * @param {object} props - Component props
 * @returns {JSX.Element} EmptyState component
 */
function EmptyState({ onNewChat }) {
    return (
        <div className="relative flex h-full min-h-[520px] flex-col items-center justify-center overflow-hidden  bg-white">
            <div className="pointer-events-none absolute">
                <div className="h-72 w-72 rounded-full bg-orange-100/50 blur-3xl" />
            </div>

            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-xl shadow-orange-200">
                <MessageCircle size={38} strokeWidth={1.8} />
            </div>

            <h2 className="relative text-xl font-bold text-gray-900">
                Start or Select a Conversation
            </h2>

            <p className="relative mt-2 max-w-sm text-center text-sm leading-6 text-gray-500">
                Select a conversation from the sidebar or start a new chat.
            </p>

            <button
                onClick={onNewChat}
                className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-200 transition-all hover:-translate-y-0.5 hover:bg-gray-800"
            >
                <Plus size={17} />
                Start a conversation
            </button></div>
    );
}

/* =========================================================
   MODAL
========================================================= */

/**
 * Modal wrapper component
 * @param {object} props - Component props
 * @returns {JSX.Element} Modal component
 */
function Modal({
    title,
    subtitle,
    onClose,
    children,
    wide = false,
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-chat-fade"
                onClick={onClose}
            />

            <div
                className={`relative max-h-[88vh] w-full ${
                    wide ? "max-w-2xl" : "max-w-lg"
                } overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl animate-chat-modal`}
            >
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">
                            {title}
                        </h3>

                        {subtitle && (
                            <p className="mt-1 text-sm text-gray-500">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X size={19} />
                    </button>
                </div>

                {children}
            </div>
        </div>
    );
}

/* =========================================================
   NEW CHAT
========================================================= */

/**
 * New chat modal component
 * @param {object} props - Component props
 * @returns {JSX.Element} NewChatModal component
 */
function NewChatModal({
    employees,
    currentId,
    onClose,
    onCreated,
}) {
    const [search, setSearch] = useState("");
    const [creatingId, setCreatingId] = useState(null);

    const list = employees.filter(
        (employee) =>
            Number(employee.id) !== Number(currentId) &&
            `${employee.full_name} ${
                employee.employee_code || ""
            } ${employee.department || ""}`
                .toLowerCase()
                .includes(search.toLowerCase())
    );

    const start = async (employee) => {
        try {
            setCreatingId(employee.id);

            const response = await fetch(
                "/api/chat/conversations/direct",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        employeeId: currentId,
                        otherEmployeeId: employee.id,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not start chat"
                );
            }

            toast.success(
                data.existing
                    ? "Conversation opened"
                    : "Conversation created"
            );

            onCreated(
                data.conversationId ||
                    data.conversation?.id
            );

            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCreatingId(null);
        }
    };

    return (
        <Modal
            title="Start a conversation"
            subtitle="Choose an employee from your directory."
            onClose={onClose}
        >
            <div className="p-5">
                <div className="relative mb-4">
                    <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={17}
                    />

                    <input
                        autoFocus
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder="Search employee..."
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                </div>

                <div className="max-h-[52vh] space-y-1 overflow-y-auto pr-1 chat-scrollbar">
                    {list.map((employee) => (
                        <button
                            key={employee.id}
                            onClick={() => start(employee)}
                            disabled={creatingId !== null}
                            className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-200 hover:bg-orange-50"
                        >
                            <Avatar
                                name={employee.full_name}
                                avatar={employee.avatar}
                            />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-900">
                                    {employee.full_name}
                                </p>

                                <p className="truncate text-xs text-gray-500">
                                    {employee.designation ||
                                        employee.department ||
                                        employee.employee_code ||
                                        "Employee"}
                                </p>
                            </div>

                            {creatingId === employee.id ? (
                                <Loader2
                                    size={18}
                                    className="animate-spin text-orange-500"
                                />
                            ) : (
                                <MessageCircle
                                    size={18}
                                    className="text-gray-300 transition group-hover:text-orange-500"
                                />
                            )}
                        </button>
                    ))}

                    {!list.length && (
                        <div className="py-10 text-center text-sm text-gray-500">
                            No employees found.
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

/* =========================================================
   NEW GROUP
========================================================= */

/**
 * New group modal component
 * @param {object} props - Component props
 * @returns {JSX.Element} NewGroupModal component
 */
function NewGroupModal({
    employees,
    currentId,
    onClose,
    onCreated,
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState([]);
    const [creating, setCreating] = useState(false);

    const list = employees.filter(
        (employee) =>
            Number(employee.id) !== Number(currentId) &&
            `${employee.full_name} ${
                employee.employee_code || ""
            } ${employee.department || ""}`
                .toLowerCase()
                .includes(search.toLowerCase())
    );

    const toggle = (id) => {
        setSelected((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    const create = async () => {
        if (!title.trim()) {
            toast.error("Group name is required");
            return;
        }

        if (!selected.length) {
            toast.error("Select at least one employee");
            return;
        }

        try {
            setCreating(true);

            const response = await fetch(
                "/api/chat/conversations/group",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        employeeId: currentId,
                        title: title.trim(),
                        description:
                            description.trim() || null,
                        participantIds: selected,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not create group"
                );
            }

            toast.success("Group created");

            onCreated(data.conversation?.id);
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal
            title="Create a team group"
            subtitle="Build a shared space for your team."
            onClose={onClose}
            wide
        >
            <div className="grid gap-5 p-5 md:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-3">
                    <input
                        autoFocus
                        value={title}
                        onChange={(event) =>
                            setTitle(event.target.value)
                        }
                        placeholder="Group name"
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />

                    <textarea
                        value={description}
                        onChange={(event) =>
                            setDescription(event.target.value)
                        }
                        placeholder="Description (optional)"
                        rows={4}
                        className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />

                    <div className="rounded-2xl bg-orange-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                            Selected
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-900">
                            {selected.length + 1}
                        </p>

                        <p className="text-xs text-gray-500">
                            Including you as group owner
                        </p>
                    </div>

                    <button
                        onClick={create}
                        disabled={creating}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {creating ? (
                            <Loader2
                                size={17}
                                className="animate-spin"
                            />
                        ) : (
                            <Users size={17} />
                        )}

                        {creating
                            ? "Creating..."
                            : "Create group"}
                    </button>
                </div>

                <div className="min-h-0">
                    <div className="relative mb-3">
                        <Search
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                            size={17}
                        />

                        <input
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search employees..."
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                        />
                    </div>

                    <div className="max-h-[46vh] space-y-1 overflow-y-auto pr-1 chat-scrollbar">
                        {list.map((employee) => {
                            const active = selected.includes(
                                employee.id
                            );

                            return (
                                <button
                                    key={employee.id}
                                    onClick={() =>
                                        toggle(employee.id)
                                    }
                                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all ${
                                        active
                                            ? "bg-orange-50 ring-1 ring-orange-200"
                                            : "hover:bg-gray-50"
                                    }`}
                                >
                                    <Avatar
                                        name={employee.full_name}
                                        avatar={employee.avatar}
                                        size="sm"
                                    />

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-gray-900">
                                            {employee.full_name}
                                        </p>

                                        <p className="truncate text-xs text-gray-500">
                                            {employee.designation ||
                                                employee.department ||
                                                "Employee"}
                                        </p>
                                    </div>

                                    <span
                                        className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                                            active
                                                ? "border-orange-500 bg-orange-500 text-white"
                                                : "border-gray-300 text-transparent"
                                        }`}
                                    >
                                        <Check size={14} />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

/* =========================================================
   MESSAGE DELETE CONFIRMATION
========================================================= */

/**
 * Message delete confirmation modal
 * @param {object} props - Component props
 * @returns {JSX.Element|null} MessageDeleteModal component
 */
function MessageDeleteModal({ messages, currentId, onClose, onConfirm, busy = false }) {
    if (!messages?.length) return null;

    const count = messages.length;
    // "Delete for everyone" only when EVERY selected message is yours and not already deleted
    const canEveryone = messages.every(
        (item) =>
            Number(item.sender_employee_id) === Number(currentId) && !item.deleted_at
    );

    return (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-chat-fade">
            <div className="w-full max-w-[320px] overflow-hidden rounded-[28px] bg-white shadow-2xl animate-chat-modal">
                <div className="px-6 pb-5 pt-7 text-center">
                    <h3 className="text-[20px] font-medium tracking-tight text-gray-900">
                        {count === 1 ? "Delete message?" : `Delete ${count} messages?`}
                    </h3>
                </div>

                {canEveryone && (
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
                        onClick={onClose}
                        disabled={busy}
                        className="flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   CHAT ACTION CONFIRMATION
========================================================= */

function ChatActionModal({ action, onClose, onConfirm, busy = false }) {
    if (!action) return null;
    const isDelete = action === "delete";

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-chat-fade">
            <div className="w-full max-w-[320px] overflow-hidden rounded-[28px] bg-white shadow-2xl animate-chat-modal">
                <div className="px-6 pb-5 pt-7 text-center">
                    <h3 className="text-[20px] font-medium tracking-tight text-gray-900">
                        {isDelete ? "Delete this chat?" : "Clear this chat?"}
                    </h3>
                </div>
                <div className="px-4 pb-3">
                    <button type="button" onClick={onConfirm} disabled={busy} className="flex w-full items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                        {busy ? "Please wait..." : isDelete ? "Delete chat" : "Clear chat"}
                    </button>
                </div>
                <div className="px-4 pb-5">
                    <button type="button" onClick={onClose} disabled={busy} className="flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   FORWARD MODAL
========================================================= */

/**
 * Forward message modal component
 * @param {object} props - Component props
 * @returns {JSX.Element} ForwardModal component
 */
function ForwardModal({
    conversations,
    currentConversationId,
    onClose,
    onForward,
}) {
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState("");

    const list = conversations.filter((conversation) =>
        `${conversation.displayName} ${
            conversation.title || ""
        }`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const toggle = (id) => {
        setSelected((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    return (
        <Modal
            title="Forward message"
            subtitle="Choose one or more conversations."
            onClose={onClose}
        >
            <div className="p-5">
                <div className="relative mb-4">
                    <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        size={17}
                    />

                    <input
                        autoFocus
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder="Search conversations..."
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                </div>

                <div className="max-h-[48vh] space-y-1 overflow-y-auto chat-scrollbar">
                    {list.map((conversation) => {
                        const active = selected.includes(
                            conversation.id
                        );

                        const isCurrent =
                            Number(conversation.id) ===
                            Number(currentConversationId);

                        return (
                            <button
                                key={conversation.id}
                                disabled={isCurrent}
                                onClick={() =>
                                    toggle(conversation.id)
                                }
                                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                                    isCurrent
                                        ? "cursor-not-allowed opacity-40"
                                        : active
                                          ? "bg-orange-50 ring-1 ring-orange-200"
                                          : "hover:bg-gray-50"
                                }`}
                            >
                                <Avatar
                                    name={
                                        conversation.displayName
                                    }
                                    avatar={
                                        conversation.displayAvatar
                                    }
                                    size="sm"
                                />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                        {
                                            conversation.displayName
                                        }
                                    </p>

                                    <p className="text-xs text-gray-500">
                                        {conversation.conversation_type ===
                                        "group"
                                            ? "Group"
                                            : "Direct chat"}
                                    </p>
                                </div>

                                <span
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                        active
                                            ? "border-orange-500 bg-orange-500 text-white"
                                            : "border-gray-300"
                                    }`}
                                >
                                    {active && (
                                        <Check size={14} />
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={() => onForward(selected)}
                    disabled={!selected.length}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Forward size={17} />
                    Forward{" "}
                    {selected.length
                        ? `to ${selected.length}`
                        : ""}
                </button>
            </div>
        </Modal>
    );
}

/* =========================================================
   Q1 — MESSAGE BUBBLE
========================================================= */

function getMessageDeliveryState(message) {
    if (!message) return "sent";

    const explicit = String(
        message.delivery_status || message.receipt_status || message.status || ""
    ).toLowerCase();

    if (["read", "seen"].includes(explicit)) return "read";
    if (["delivered", "received"].includes(explicit)) return "delivered";
    if (explicit === "sent") return "sent";

    const receipts = Array.isArray(message.receipts)
        ? message.receipts
        : Array.isArray(message.message_receipts)
          ? message.message_receipts
          : [];

    if (receipts.length > 0) {
        if (receipts.every((receipt) => receipt.read_at)) return "read";
        if (receipts.every((receipt) => receipt.delivered_at)) return "delivered";
    }

    if (message.read_at) return "read";
    if (message.delivered_at) return "delivered";
    return "sent";
}

/**
 * Message bubble component
 * Renders individual chat messages with reactions, actions, and metadata.
 * @param {object} props - Component props
 * @returns {JSX.Element} MessageBubble component
 */
function MessageBubble({
    message,
    currentId,
    showSenderInfo = false,
    isFirstInGroup= true,
    conversationType,
    onReply,
    onForward,
    onEdit,
    onDelete,
    onPin,
    onStar,
    onReact,
    selectionMode = false,
    selected = false,
    onToggleSelect,
    onOpenFullPicker,
    onOpenReactionDetails,
    onPollUpdated,
    onViewPollVotes,
    onOpenMediaViewer,
    menuOpen = false,
    pickerOpen = false,
    onToggleMenu,
    onTogglePicker,
    searchQuery = "",
    highlighted = false,
}) {
    const own = Number(message.sender_employee_id) === Number(currentId);
    const deleted = Boolean(message.deleted_at);
    const [editExpired, setEditExpired] = useState(false);
    useEffect(() => {
        if (!own || deleted || !message.created_at) {
            setEditExpired(false);
            return;
        }

        const createdAt = new Date(message.created_at).getTime();
        if (!Number.isFinite(createdAt)) {
            setEditExpired(true);
            return;
        }

        const editWindowMs = 5 * 60 * 1000;
        const remaining = editWindowMs - (Date.now() - createdAt);

        if (remaining <= 0) {
            setEditExpired(true);
            return;
        }

        setEditExpired(false);
        const timer = window.setTimeout(() => {
            setEditExpired(true);
        }, remaining);

        return () => window.clearTimeout(timer);
    }, [message.id, message.created_at, own, deleted]);

    const canEdit =
        own &&
        !deleted &&
        !editExpired &&
        Boolean(message.created_at);
    const richMessage = ["image", "video", "audio", "file", "gif"].includes(
        String(message.message_type || "").toLowerCase()
    ) || /https?:\/\//i.test(message.message || "");

    const bubbleRef = useRef(null);
    const overlayRef = useRef(null);
    const pickerAnchorRef = useRef(null);
    const quickReactionTrayRef = useRef(null);
    const pickerOverlayRef = useRef(null);
    const [overlayPosition, setOverlayPosition] = useState(null);
    const [pickerPosition, setPickerPosition] = useState(null);

        // True only while the pointer is over an attachment (photo/video/document).
    // Local to this bubble: there is no global hoveredMessageId.
    // const [mediaHovered, setMediaHovered] = useState(false);
    // useEffect(() => {
    //     if (deleted || selectionMode) setMediaHovered(false);
    // }, [deleted, selectionMode]);

    // const chevronVisibility = menuOpen
    //     ? "opacity-100"
    //     : mediaHovered
    //       ? "opacity-0 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    //       : "opacity-0 group-hover/bubble:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";
    const hasVisualMedia =
        !deleted &&
        (message.attachments || []).some((att) =>
            /^(image|video)\//i.test(String(att.file_type || ""))
        );

    // The chevron shows when the pointer is anywhere over the bubble,
    // including its photos/videos.
    const chevronVisibility = menuOpen
        ? "opacity-100"
        : "opacity-0 group-hover/bubble:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

    const updateOverlayPosition = useCallback(() => {
        if (!menuOpen || !bubbleRef.current || !overlayRef.current) {
            setOverlayPosition(null);
            return;
        }

        const bubbleRect = bubbleRef.current.getBoundingClientRect();
        const overlayRect = overlayRef.current.getBoundingClientRect();

        const gap = 3;
        const viewportPadding = 8;
        const viewportTop = 72;
        const viewportBottom = window.innerHeight - viewportPadding;

        const overlayWidth = overlayRect.width;
        const overlayHeight = overlayRect.height;

        let top = bubbleRect.top;

        if (top + overlayHeight > viewportBottom) {
            top = bubbleRect.bottom - overlayHeight;
        }

        top = Math.max(
            viewportTop,
            Math.min(top, viewportBottom - overlayHeight)
        );

        let left = own
            ? bubbleRect.left - overlayWidth - gap
            : bubbleRect.right + gap;

        left = Math.max(
            viewportPadding,
            Math.min(
                left,
                window.innerWidth - overlayWidth - viewportPadding
            )
        );

        setOverlayPosition({ top, left });
    }, [menuOpen, own]);

    const updatePickerPosition = useCallback(() => {
        if (!pickerOpen || !pickerAnchorRef.current || !pickerOverlayRef.current) {
            setPickerPosition(null);
            return;
        }

        const anchorRect = pickerAnchorRef.current.getBoundingClientRect();
        const pickerRect = pickerOverlayRef.current.getBoundingClientRect();
        const containerRect = document
            .querySelector('[data-chat-messages-viewport]')
            ?.getBoundingClientRect();

        const viewportPadding = 8;
        const viewportTop = 72;
        const viewportBottom = window.innerHeight - viewportPadding;
        const boundaryLeft = Math.max(
            containerRect?.left ?? 0,
            viewportPadding
        );
        const boundaryRight = Math.min(
            containerRect?.right ?? window.innerWidth,
            window.innerWidth - viewportPadding
        );
        const boundaryTop = Math.max(
            containerRect?.top ?? viewportTop,
            viewportTop
        );
        const boundaryBottom = Math.min(
            containerRect?.bottom ?? viewportBottom,
            viewportBottom
        );

        const pickerWidth = pickerRect.width;
        const pickerHeight = pickerRect.height;

        let left = anchorRect.left + (anchorRect.width - pickerWidth) / 2;
        const maxLeft = boundaryRight - pickerWidth;
        left = maxLeft < boundaryLeft
            ? boundaryLeft
            : Math.max(boundaryLeft, Math.min(left, maxLeft));

        const gap = 0;
        let top = anchorRect.top - pickerHeight;

        if (top < boundaryTop) {
            top = anchorRect.bottom + gap;
        }

        const maxTop = boundaryBottom - pickerHeight;
        top = maxTop < boundaryTop
            ? boundaryTop
            : Math.max(boundaryTop, Math.min(top, maxTop));

        setPickerPosition({ top, left });
    }, [pickerOpen]);

    useEffect(() => {
        if (!menuOpen && !pickerOpen) {
            setOverlayPosition(null);
            setPickerPosition(null);
            return;
        }

        const frame = requestAnimationFrame(() => {
            updateOverlayPosition();
            updatePickerPosition();
        });

        window.addEventListener("resize", updateOverlayPosition);
        window.addEventListener("resize", updatePickerPosition);
        window.addEventListener("scroll", updateOverlayPosition, true);
        window.addEventListener("scroll", updatePickerPosition, true);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", updateOverlayPosition);
            window.removeEventListener("resize", updatePickerPosition);
            window.removeEventListener("scroll", updateOverlayPosition, true);
            window.removeEventListener("scroll", updatePickerPosition, true);
        };
    }, [
        menuOpen,
        pickerOpen,
        updateOverlayPosition,
        updatePickerPosition,
    ]);

    const handleReaction = (emoji) => {
        recordRecentEmoji(emoji);
        onReact(emoji);
        onTogglePicker?.(null);
    };

    const copyMessage = async () => {
        try {
            await navigator.clipboard.writeText(message.message || "");
            toast.success("Message copied");
            onToggleMenu?.(null);
        } catch {
            toast.error("Could not copy message");
        }
    };

    const isPoll = message.message_type === "poll" && Boolean(message.poll) && !deleted;

    // time / edited / tick row shown at the bottom-right of a bubble
    const renderMeta = (extraClass = "") => (
        <span
            className={`inline-flex ${extraClass} items-center justify-end gap-1 whitespace-nowrap pb-0.5 text-[9px] leading-3 ${
                own && !deleted ? "text-white/70" : "text-gray-400"
            }`}
        >
            {message.edited_at && !deleted && <span>edited</span>}
            <span>{formatTime(message.created_at)}</span>
            {own && !deleted && (() => {
                const deliveryState = getMessageDeliveryState(message);
                if (deliveryState === "read") return <CheckCheck size={12} className="text-sky-300" />;
                if (deliveryState === "delivered") return <CheckCheck size={12} className="text-white/80" />;
                return <Check size={12} className="text-white/80" />;
            })()}
        </span>
    );

    const itemClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50";

    return (
        <div
            data-chat-message-id={message.id}
            data-chat-message-row={message.id}
            onClick={() => {
                if (selectionMode) {
                    onToggleSelect?.(message.id);
                }
            }}
            className={`group relative flex w-full rounded-xl py-0.5 ${
                deleted || (!deleted && message.edited_at)
                 ? "mb-1.5" 
                 : ""
            } transition-colors duration-500 animate-chat-message ${
                highlighted 
                ? "bg-amber-100/80 animate-pulse" 
                : ""
            } ${
                selectionMode
                    ? selected
                        ? "bg-orange-100/80"
                        : "hover:bg-white/60"
                    : ""
            } ${
                 selectionMode ? "pl-7 cursor-pointer" : ""
            } ${own ? "justify-end" : "justify-start"}`}
        >
            <div className={`flex max-w-[88%] items-center gap-2 ${own ? "flex-row" : "flex-row"}`}>
                {selectionMode && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleSelect?.(message.id);
                        }}
                        className={`absolute left-1 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border transition ${
                            selected
                                ? "border-orange-500 bg-orange-500 text-white"
                                : "border-gray-300 bg-white text-transparent hover:bg-gray-50"
                        }`}
                        aria-label={selected ? "Deselect message" : "Select message"}
                    >
                        {selected && <Check size={14} strokeWidth={2.5} />}
                    </button>
                )}
                {!own && conversationType === "group" && (
                    <div className = "w-11 shrink-0">
                        {showSenderInfo && (
                            <Avatar 
                                name={message.sender_name} 
                                avatar={message.sender_avatar} 
                                size="sm" 
                            />
                        )}
                    </div>
                )}
                <div className={`flex min-w-0 flex-col ${own ? "items-end" : "items-start"}`}>
                    {!own && message.conversation_type === "group" && 
                        showSenderInfo && (
                            <span className="mb-0.5 px-1 text-[11px] font-semibold text-gray-400">
                                {message.sender_name}
                            </span>
                    )}

                    <div className="group/zone relative flex items-center gap-1">
                        {/* Sent: controls LEFT of bubble. Received: controls RIGHT of bubble. */}
                        {own && !selectionMode && (
                            <div ref={(node) => { pickerAnchorRef.current = node; quickReactionTrayRef.current = node; }} className={`order-1 flex shrink-0 items-center gap-0.5 transition-opacity duration-150 
                                ${menuOpen
                                        ? "pointer-events-none opacity-0"
                                        : pickerOpen
                                            ? "opacity-100"
                                            : "opacity-0 group-hover/zone:opacity-100 focus-within:opacity-100"
                                }`}>
                                <button onClick={() => onTogglePicker?.(message.id)} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-orange-50 hover:text-orange-500" title="React">
                                    <Smile size={15} />
                                </button>
                                <button onClick={onForward} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-800" title="Forward">
                                    <Forward size={15} />
                                </button>
                            </div>
                        )}

                       <div ref={bubbleRef} className={`group/bubble relative order-2 w-fit max-w-full rounded-[14px] px-3 py-2 pb-3 ${
                                deleted
                                    ? "border border-gray-200 bg-gray-50 text-gray-400"
                                    : own
                                      ? `bg-linear-to-br from-orange-500 to-amber-500 text-white shadow-orange-100 ${
                                            isFirstInGroup
                                                ? "rounded-tr-[14px] rounded-br-md"
                                                : "rounded-[14px]"
                                        }`
                                      : `border border-gray-100 bg-white text-gray-800 ${
                                            isFirstInGroup
                                                ? "rounded-tl-[14px] rounded-bl-md"
                                                : "rounded-[14px]"
                                        }`
                            }`}
                        >
                            {/* The metadata column is deliberately reserved in every bubble.
                                Message text uses the remaining width and determines the bubble height. */}
                            {!selectionMode && <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleMenu?.(message.id);
                                }}
                                className={`absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center backdrop-blur-sm transition-opacity duration-150 ${
                                            hasVisualMedia
                                                ? "rounded-full bg-black/50 text-white hover:bg-black/70"
                                                : own
                                                ? "rounded-md text-white/80 hover:text-white"
                                                : "rounded-md text-gray-400 hover:text-gray-700"
                                        } ${chevronVisibility}`}
                                            title="Message menu"
                                            aria-label="Message menu"
                                        >
                                <ChevronDown size={13} />
                            </button>}

                            {message.reply_to_message_id && !deleted && (
                                <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1.5 text-[11px] leading-4 ${own ? "border-white/70 bg-white/10 text-white/80" : "border-orange-400 bg-orange-50 text-gray-600"}`}>
                                    <p className="font-semibold">{Number(message.reply_sender_employee_id) === Number(currentId) ? "You" : (message.reply_sender_name || "Message")}</p>
                                    <p className="mt-0.5 line-clamp-2">{message.reply_message || "Original message"}</p>
                                </div>
                            )}

                            {message.forwarded_from_message_id && !deleted && (
                                <div className={`mb-0.5 flex items-center gap-1 text-[11px] italic tracking-wider ${own ? "text-white/70" : "text-orange-500"}`}>
                                    <Forward size={10} /> Forwarded
                                </div>
                            )}

                            {message.is_pinned && !deleted && (
                                <div className={`mb-1 flex items-center gap-1 text-[10px] font-semibold ${
                                    own ? "text-white/80" : "text-gray-500"
                                }`}>
                                    <Pin size={10} fill="currentColor" />
                                    <span>Pinned</span>
                                </div>
                            )}

                            {message.is_starred && !deleted && (
                                <div className={`mb-1 flex items-center gap-1 text-[10px] font-semibold ${
                                    own ? "text-white/80" : "text-gray-500"
                                }`}>
                                    <Star size={10} fill="currentColor" />
                                    <span>Starred</span>
                                </div>
                            )}{message.message_type === "poll" && message.poll && !deleted && (
                                <>
                                    <PollMessage message={message} currentId={currentId} own={own} onPollUpdated={onPollUpdated} />
                                    <div className="mt-1 flex justify-end">{renderMeta()}</div>
                                    <PollViewVotesButton own={own} onClick={() => onViewPollVotes?.(message.id)} />
                                </>
                            )}

                            <MessageAttachments
                                message={message}
                                currentId={currentId}
                                own={own}
                                onOpenViewer={onOpenMediaViewer}
                                // onHoverChange={setMediaHovered}
                            />

                            {/* Keep metadata inline with the final text line. This mirrors WhatsApp:
                                earlier lines use the full bubble width, while the final line naturally
                                wraps before the timestamp/read-status when there is not enough room. */}
                            {!isPoll && (
                                <div className={message.attachments?.length ? "[contain:inline-size]" : ""}>
                                    <MessageContent
                                        text={message.message}
                                        deleted={deleted}
                                        searchQuery={searchQuery}
                                        trailingMeta={renderMeta("translate-y-[6px]")}
                                    />
                                </div>
                            )}

                            {!selectionMode && ((menuOpen || pickerOpen) && createPortal(
                                <>
                                    {pickerOpen && (
                                        <div
                                            ref={pickerOverlayRef}
                                            className="fixed z-[1000] flex items-center gap-0.5 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl animate-chat-pop"
                                            style={{ top: pickerPosition?.top ?? -9999, left: pickerPosition?.left ?? -9999 }}
                                            data-chat-overlay-root
                                        >
                                            {QUICK_EMOJIS.map((emoji) => (
                                                <button key={emoji} onClick={() => handleReaction(emoji)} className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition hover:scale-110 hover:bg-gray-100">{emoji}</button>
                                            ))}
                                        <button
                                            onClick={() => {
                                               onToggleMenu?.(null);

                                                const tray = quickReactionTrayRef.current?.getBoundingClientRect();
                                                const row = pickerOverlayRef.current?.getBoundingClientRect();
                                                const rects = [tray, row].filter(Boolean);

                                                const anchorRect = rects.length
                                                    ? {
                                                        top: Math.min(...rects.map((r) => r.top)),
                                                        bottom: Math.max(...rects.map((r) => r.bottom)),
                                                        left: Math.min(...rects.map((r) => r.left)),
                                                        right: Math.max(...rects.map((r) => r.right)),
                                                        // true  = edge belongs to the quick-emoji row
                                                        // false = edge belongs to the Smile/Forward buttons
                                                        bottomIsRow: !tray || !row || row.bottom >= tray.bottom,
                                                        topIsRow: !tray || !row || row.top <= tray.top,
                                                    }
                                                    : null;

                                                onOpenFullPicker?.(message, anchorRect);
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100"
                                            title="More reactions"
                                            aria-label="More reactions"
                                        >
                                            <Plus size={17} />
                                        </button>
                                        </div>
                                    )}

                                    {menuOpen && (
                                        <div
                                            ref={overlayRef}
                                            className="fixed z-[1001] w-44 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl animate-chat-pop"
                                            style={{ top: overlayPosition?.top ?? -9999, left: overlayPosition?.left ?? -9999 }}
                                            data-chat-overlay-root
                                        >
                                            <button onClick={() => { onReply(); onToggleMenu?.(null); }} className={itemClass}><Reply size={14}/>Reply</button>
                                            <button onClick={copyMessage} className={itemClass}><Copy size={14}/>Copy</button>
                                            <button onClick={() => { onForward(); onToggleMenu?.(null); }} className={itemClass}><Forward size={14}/>Forward</button>
                                            <button onClick={() => { onPin?.(message); onToggleMenu?.(null); }} className={itemClass}><Pin size={14}/>{message.is_pinned ? "Unpin" : "Pin"}</button>
                                            <button onClick={() => { onStar?.(message); onToggleMenu?.(null); }} className={itemClass}><Star size={14}/>{message.is_starred ? "Unstar" : "Star"}</button>
                                            {canEdit && <button onClick={() => { onEdit(); onToggleMenu?.(null); }} className={itemClass}><Pencil size={14}/>Edit</button>}
                                            <button onClick={() => { onDelete(); onToggleMenu?.(null); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50"><Trash2 size={14}/>Delete</button>
                                        </div>
                                    )}
                                </>,
                                document.body
                            ))}
                        </div>

                        {!own && !selectionMode && (
                            <div ref={(node) => { pickerAnchorRef.current = node; quickReactionTrayRef.current = node; }} className={`order-3 flex shrink-0 items-center gap-0.5 transition-opacity duration-150 ${menuOpen ? "pointer-events-none opacity-0" : pickerOpen ? "opacity-100" : "opacity-0 group-hover/zone:opacity-100 focus-within:opacity-100"}`}>
                                <button onClick={() => onTogglePicker?.(message.id)} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-orange-50 hover:text-orange-500" title="React">
                                    <Smile size={15} />
                                </button>
                                <button onClick={onForward} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-800" title="Forward">
                                    <Forward size={15} />
                                </button>
                            </div>
                        )}
                    </div>

                   {message.reactions?.length > 0 && (
    <div
        data-reaction-anchor
        className={`mt-0.5 flex flex-wrap gap-0.5 ${own ? "justify-end" : "justify-start"}`}
    >
        {message.reactions.map((reaction) => (
            <button
                key={reaction.emoji}
                onClick={(event) =>
                    onOpenReactionDetails?.(
                        message,
                        reaction,
                        event.currentTarget.parentElement.getBoundingClientRect()
                    )
                }
                title="View reactions"
                className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200"
            >
                <span>{reaction.emoji}</span>
                <span className="font-semibold text-gray-500">{reaction.count}</span>
            </button>
        ))}
    </div>
)}
                </div>
            </div>
        </div>
    );
}

/**
 * Main Chat Component
 *
 * Renders the complete chat interface with conversations sidebar,
 * message area, media handling, polls, reactions, and real-time updates.
 *
 * @returns {JSX.Element} Chat component
 */
function Chat() {
    const { currentUser, employeeId } = useAuth();

    const [conversations, setConversations] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedConversation, setSelectedConversation] =
        useState(null);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);                             
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [activePinnedIndex, setActivePinnedIndex] = useState(0);
    const [pinLimitConfirm, setPinLimitConfirm] = useState(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const pinnedHighlightTimerRef = useRef(null);

    const [starredPanelOpen, setStarredPanelOpen] = useState(false);
    const [starredMessages, setStarredMessages] = useState([]);
    const [starredLoading, setStarredLoading] = useState(false);
    const [starredTarget, setStarredTarget] = useState(null);
    const starredHighlightTimerRef = useRef(null);

    const [loadingConversations, setLoadingConversations] =
        useState(true);
    const [loadingMessages, setLoadingMessages] =
        useState(false);
    const [sending, setSending] = useState(false);

    const [search, setSearch] = useState("");
    const [messageText, setMessageText] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [editingText, setEditingText] = useState("");

    const [newChatOpen, setNewChatOpen] = useState(false);
    const [newGroupOpen, setNewGroupOpen] = useState(false);
    const [forwardingMessage, setForwardingMessage] =
        useState(null);
    const [mobileListOpen, setMobileListOpen] =
        useState(true);

    /* Q1 full reaction picker */
    const [fullPickerMessage, setFullPickerMessage] =
        useState(null);
    const [fullPickerAnchorRect, setFullPickerAnchorRect] = useState(null);
    const [fullPickerPosition, setFullPickerPosition] = useState(null);
    const [fullPickerMaxHeight, setFullPickerMaxHeight] = useState(null);
    const [activeMessageMenuId, setActiveMessageMenuId] = useState(null);
    const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
    const [conversationSearch, setConversationSearch] = useState("");
    const [conversationSearchIndex, setConversationSearchIndex] = useState(0);
    const [groupInfoOpen, setGroupInfoOpen] = useState(false);
    const chatWorkspaceRef = useRef(null);
    const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
    const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
    const [attachmentUploadBusy, setAttachmentUploadBusy] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const [attachmentCaption, setAttachmentCaption] = useState("");
    const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false);
    const [mediaViewerAttachment, setMediaViewerAttachment] = useState(null);
    const [pollComposerOpen, setPollComposerOpen] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
    const [pollAllowVoteChanges, setPollAllowVoteChanges] = useState(true);
    const [pollBusy, setPollBusy] = useState(false);
    const [pollVotesMessageId, setPollVotesMessageId] = useState(null);
    const [reactionDetails, setReactionDetails] = useState(null);
    const [chatAction, setChatAction] = useState(null);
    const [chatActionBusy, setChatActionBusy] = useState(false);
    const [messageDeleteConfirm, setMessageDeleteConfirm] = useState(null);
    const [messageDeleteBusy, setMessageDeleteBusy] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);
    const [isSystemAdmin, setIsSystemAdmin] = useState(false);
    const attachmentInputRef = useRef(null);
    const documentInputRef = useRef(null);
    const forwardSuccessRef = useRef(null);
        const selectedIdRef = useRef(null);
    selectedIdRef.current = selectedId;

    const composerRef = useRef(null);
    const headerMenuRef = useRef(null);
    const conversationSearchRef = useRef(null);
    const messagesEndRef = useRef(null);
    const messagesViewportRef = useRef(null);
    const fullPickerRef = useRef(null);

    useEffect(() => {
        const handleGlobalPointerDown = (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const clickedInsideOverlay = target.closest("[data-chat-overlay-root]");

            if (clickedInsideOverlay) return;

            setActiveMessageMenuId(null);
            setActiveReactionMessageId(null);
            setFullPickerMessage(null);
            setReactionDetails(null);  
            setComposerEmojiOpen(false);
            setAttachmentMenuOpen(false);
            setHeaderMenuOpen(false);
            setConversationSearchOpen(false);
        };

        document.addEventListener("pointerdown", handleGlobalPointerDown);
        return () => document.removeEventListener("pointerdown", handleGlobalPointerDown);
    }, []);

    /* =====================================================
       EMPLOYEES
    ===================================================== */

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await fetch("/api/employees");
            const data = await response.json();

            if (response.ok && data.success) {
                setEmployees(data.employees || []);
            }
        } catch (error) {
            console.error(
                "Chat employees error:",
                error
            );
        }
    }, []);

    /* =====================================================
       CONVERSATIONS
    ===================================================== */

    const enrichConversations = useCallback(
        async (items) => {
            const enriched = await Promise.all(
                items.map(async (conversation) => {
                    try {
                        const response = await fetch(
                            `/api/chat/conversations/${conversation.id}?employeeId=${employeeId}`
                        );

                        const data =
                            await response.json();

                        if (
                            !response.ok ||
                            !data.success
                        ) {
                            return {
                                ...conversation,
                                displayName:
                                    conversation.title ||
                                    `Conversation ${conversation.id}`,
                                displayAvatar:
                                    conversation.avatar ||
                                    null,
                                participantCount: 0,
                            };
                        }

                        const people =
                            data.participants || [];

                        let latestMessage = null;
                        try {
                            const latestResponse = await fetch(`/api/chat/conversations/${conversation.id}/messages?employeeId=${employeeId}`);
                            const latestData = await latestResponse.json();
                            if (latestResponse.ok && latestData.success && latestData.messages?.length) {
                                latestMessage = latestData.messages[latestData.messages.length - 1];
                            }
                        } catch {}

                        const other = people.find(
                            (person) =>
                                Number(
                                    person.employee_id
                                ) !==
                                Number(employeeId)
                        );

                        return {
                            ...conversation,
                            displayName:
                                conversation.conversation_type ===
                                "direct"
                                    ? other?.full_name ||
                                      "Direct conversation"
                                    : conversation.title ||
                                      "Team group",
                            displayAvatar:
                                conversation.conversation_type ===
                                "direct"
                                    ? other?.avatar ||
                                      null
                                    : conversation.avatar ||
                                      null,
                            participantCount:
                                people.length,
                            otherEmployee:
                                other || null,
                            last_message_preview:
                                latestMessage?.deleted_at
                                    ? "This message was deleted"
                                    : latestMessage?.message || conversation.last_message_preview || "No messages yet",
                            last_message_at:
                                latestMessage?.created_at || conversation.last_message_at || conversation.updated_at,
                        };
                    } catch {
                        return {
                            ...conversation,
                            displayName:
                                conversation.title ||
                                `Conversation ${conversation.id}`,
                            displayAvatar:
                                conversation.avatar ||
                                null,
                        };
                    }
                })
            );

                return enriched.map((item) =>
                item.conversation_type === "group" &&
                item.displayAvatar &&
                String(item.displayAvatar).startsWith("/uploads/") &&
                !String(item.displayAvatar).includes("?")
                    ? { ...item, displayAvatar: `${item.displayAvatar}?employeeId=${employeeId}` }
                    : item
            );
        },
        [employeeId]
    );

    const loadConversations = useCallback(
        async (preferredId = null) => {
            if (!employeeId) return;

            try {
                setLoadingConversations(true);

                const response = await fetch(
                    `/api/chat/conversations?employeeId=${employeeId}`
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                            "Failed to load conversations"
                    );
                }

                const enriched =
                    await enrichConversations(
                        data.conversations || []
                    );

                setConversations(enriched);

                /*
                  Q4.1:
                  Do NOT automatically select first conversation.
                */
                const target =
                    preferredId ?? selectedId ?? null;

                if (
                    target &&
                    enriched.some(
                        (item) =>
                            Number(item.id) ===
                            Number(target)
                    )
                ) {
                    setSelectedId(Number(target));
                }
            } catch (error) {
                toast.error(error.message);
            } finally {
                setLoadingConversations(false);
            }
        },
        [
            employeeId,
            enrichConversations,
            selectedId,
        ]
    );

    /* =====================================================
       LOAD MESSAGES
    ===================================================== */

    const loadPinnedMessages = useCallback(async (conversationId) => {
        if (!conversationId || !employeeId) {
            setPinnedMessages([]);
            return;
        }

        try {
            const response = await fetch(
                `/api/chat/conversations/${conversationId}/pins?employeeId=${employeeId}`
            );
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to load pinned messages");
            }

            const activePins = (data.pins || []).filter((pin) => !pin.deleted_at && String(pin.message || "") !== "This message was deleted");
            setPinnedMessages(activePins);
            setActivePinnedIndex((current) => activePins.length ? Math.min(current, activePins.length - 1) : 0);
        } catch (error) {
            console.error("Load pinned messages error:", error);
            setPinnedMessages([]);
        }
    }, [employeeId]);

    const loadStarredMessages = useCallback(async () => {
        if (!employeeId) {
            setStarredMessages([]);
            return;
        }

        try {
            setStarredLoading(true);

            const response = await fetch(
                `/api/chat/starred-messages?employeeId=${employeeId}`
            );
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Failed to load starred messages"
                );
            }

            setStarredMessages(
                (data.starredMessages || []).filter(
                    (item) => !item.deleted_at
                )
            );
        } catch (error) {
            console.error(
                "Load starred messages error:",
                error
            );
            setStarredMessages([]);
        } finally {
            setStarredLoading(false);
        }
    }, [employeeId]);

    const loadMessages = useCallback(
        async (conversationId) => {
            if (!employeeId || !conversationId) return;

            try {
                setLoadingMessages(true);

                const [
                    conversationResponse,
                    messagesResponse,
                ] = await Promise.all([
                    fetch(
                        `/api/chat/conversations/${conversationId}?employeeId=${employeeId}`
                    ),
                    fetch(
                        `/api/chat/conversations/${conversationId}/messages?employeeId=${employeeId}`
                    ),
                ]);

                const conversationData =
                    await conversationResponse.json();

                const messagesData =
                    await messagesResponse.json();

                if (
                    !conversationResponse.ok ||
                    !conversationData.success
                ) {
                    throw new Error(
                        conversationData.message ||
                            "Failed to load conversation"
                    );
                }

                if (
                    !messagesResponse.ok ||
                    !messagesData.success
                ) {
                    throw new Error(
                        messagesData.message ||
                            "Failed to load messages"
                    );
                }

                setSelectedConversation(
                    conversationData.conversation
                );

                setParticipants(
                    conversationData.participants || []
                );

                const baseMessages =
                    messagesData.messages || [];

                const withReactions =
                    await Promise.all(
                        baseMessages.map(
                            async (message) => {
                                try {
                                    const reactionResponse =
                                        await fetch(
                                            `/api/chat/messages/${message.id}/reactions?employeeId=${employeeId}`
                                        );

                                    const reactionData =
                                        await reactionResponse.json();

                                    return {
                                        ...message,
                                        reactions:
                                            reactionResponse.ok &&
                                            reactionData.success
                                                ? reactionData.reactions ||
                                                  []
                                                : [],
                                    };
                                } catch {
                                    return {
                                        ...message,
                                        reactions: [],
                                    };
                                }
                            }
                        )
                    );

                setMessages(withReactions);
            } catch (error) {
                toast.error(error.message);
                setMessages([]);
            } finally {
                setLoadingMessages(false);
            }
        },
        [employeeId]
    );

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    useEffect(() => {
        if (!employeeId) return undefined;
        let cancelled = false;
        fetch(`/api/chat/permissions?employeeId=${employeeId}`)
            .then((response) => response.json())
            .then((data) => {
                if (!cancelled && data.success) {
                    setIsSystemAdmin(Boolean(data.isSystemAdmin));
                }
            })
                .catch(() => {});
            return () => {
                cancelled = true;
        };
    }, [employeeId]);

    useEffect(() => {
        if (employeeId) {
            loadConversations();
        }
    }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!selectedId) {
            setSelectedConversation(null);
            setParticipants([]);
            setMessages([]);
            setPinnedMessages([]);
            setActivePinnedIndex(0);
            setHighlightedMessageId(null);
            setStarredTarget(null);
            return;
        }

        loadMessages(selectedId);
        loadPinnedMessages(selectedId);
        setActivePinnedIndex(0);
        setHighlightedMessageId(null);
        setMobileListOpen(false);
        setReactionDetails(null);
    }, [selectedId, loadMessages, loadPinnedMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
    }, [messages, selectedId]);

    useEffect(() => {
        if (!starredTarget) return;

        if (
            Number(selectedId) !==
            Number(starredTarget.conversationId)
        ) {
            return;
        }

        const timer = window.setTimeout(() => {
            const target = document.querySelector(
                `[data-chat-message-id="${starredTarget.messageId}"]`
            );

            if (!target) {
                setStarredTarget(null);
                return;
            }

            target.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });

            setHighlightedMessageId(
                Number(starredTarget.messageId)
            );

            if (starredHighlightTimerRef.current) {
                window.clearTimeout(
                    starredHighlightTimerRef.current
                );
            }

            starredHighlightTimerRef.current =
                window.setTimeout(() => {
                    setHighlightedMessageId(null);
                    setStarredTarget(null);
                }, 1800);
        }, 250);

        return () => window.clearTimeout(timer);
    }, [selectedId, messages, starredTarget]);

    useEffect(() => () => {
        if (starredHighlightTimerRef.current) {
            window.clearTimeout(
                starredHighlightTimerRef.current
            );
        }
    }, []);

    useEffect(() => {
        if (editingMessage) {
            composerRef.current?.focus();
        }
    }, [editingMessage]);

        // The preview lives inside the conversation pane while the sidebar stays
    // clickable. Switching chats discards it so files can never go to the wrong chat.
    useEffect(() => {
        setAttachmentPreviewOpen(false);
        setPendingAttachments([]);
        setAttachmentCaption("");
    }, [selectedId]);

    const filteredConversations = useMemo(
        () =>
            conversations.filter((conversation) =>
                conversation.displayName
                    .toLowerCase()
                    .includes(search.toLowerCase())
            ),
        [conversations, search]
    );

    const selectedDisplay =
        (selectedConversation
            ? conversations.find(
                  (conversation) =>
                      Number(conversation.id) ===
                      Number(selectedConversation.id)
              )
            : conversations.find(
                  (conversation) =>
                      Number(conversation.id) ===
                      Number(selectedId)
              )) ||
        (selectedConversation?.conversation_type === "direct"
            ? (() => {
                  const other = (participants || []).find(
                      (person) =>
                          Number(person.employee_id) !==
                          Number(employeeId)
                  );

                  return other
                      ? {
                            id: Number(selectedConversation.id),
                            displayName:
                                other.full_name ||
                                "Direct conversation",
                            displayAvatar: other.avatar || null,
                            otherEmployee: other,
                        }
                      : null;
              })()
            : null);

    const myParticipant = participants.find(
        (person) => Number(person.employee_id) === Number(employeeId)
    );
    const myGroupRole = myParticipant?.participant_role || "member";
    const isGroupChat = selectedConversation?.conversation_type === "group";
    const isGroupStaff = ["owner", "super_admin", "admin"].includes(myGroupRole);
    const composerLocked =
        isGroupChat &&
        Boolean(selectedConversation?.only_admins_can_message) &&
        !isGroupStaff;
    // direct chats: everyone can make polls; groups: staff only
    const canCreatePoll = !isGroupChat || isGroupStaff;

    const conversationSearchResults = useMemo(() => {
        const query = conversationSearch.trim().toLowerCase();
        if (!query) return [];
        return messages.filter((message) =>
            String(message.message || "").toLowerCase().includes(query)
        );
    }, [messages, conversationSearch]);

    const jumpToConversationSearchResult = useCallback((index) => {
        const message = conversationSearchResults[index];
        if (!message) return;
        requestAnimationFrame(() => {
            document
                .querySelector(`[data-chat-message-id="${message.id}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }, [conversationSearchResults]);

    useEffect(() => {
        setConversationSearchIndex(0);
    }, [conversationSearch]);

    /* =====================================================
       CONVERSATION CREATED
    ===================================================== */

    const handleConversationCreated = async (
        conversationId
    ) => {
        await loadConversations(conversationId);
        setSelectedId(Number(conversationId));
    };

    const updatePollInMessages = useCallback((messageId, poll) => {
        setMessages((current) =>
            current.map((message) =>
                Number(message.id) === Number(messageId)
                    ? { ...message, poll }
                    : message
            )
        );
    }, []);

    /* =====================================================
       SEND
    ===================================================== */

    const sendCurrentMessage = async () => {
        const text = messageText.trim();

        if (!text || !selectedId || sending) return;

        try {
            setSending(true);

            let endpoint = `/api/chat/conversations/${selectedId}/messages`;

            let body = {
                employeeId,
                message: text,
                messageType: "text",
            };

            if (replyingTo) {
                endpoint = `/api/chat/messages/${replyingTo.id}/reply`;

                body = {
                    employeeId,
                    message: text,
                };
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Failed to send message"
                );
            }

            setMessages((prev) => [
                ...prev,
                {
                    ...data.message,
                    reactions: [],
                },
            ]);

            setMessageText("");
            setReplyingTo(null);

            await loadConversations(selectedId);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSending(false);
        }
    };

    /* =====================================================
       EDIT
    ===================================================== */

    const editCurrentMessage = async () => {
        const text = editingText.trim();

        if (!text || !editingMessage) return;

        try {
            const response = await fetch(
                `/api/chat/messages/${editingMessage.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        employeeId,
                        message: text,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Failed to edit message"
                );
            }

            setMessages((prev) =>
                prev.map((message) =>
                    Number(message.id) ===
                    Number(editingMessage.id)
                        ? {
                              ...message,
                              ...data.message,
                          }
                        : message
                )
            );

            setEditingMessage(null);
            setEditingText("");
            setMessageText("");

            toast.success("Message edited");
        } catch (error) {
            toast.error(error.message);
        }
    };

    const navigateToPinnedMessage = useCallback((pinOrIndex) => {
        const index = typeof pinOrIndex === "number" ? pinOrIndex : pinnedMessages.findIndex((pin) => Number(pin.message_id) === Number(pinOrIndex?.message_id));
        const pin = pinnedMessages[index];
        if (!pin) return;
        setActivePinnedIndex(index);
        setHighlightedMessageId(Number(pin.message_id));
        requestAnimationFrame(() => {
            const target = document.querySelector(`[data-chat-message-id="${pin.message_id}"]`);
            if (!target) { setHighlightedMessageId(null); return; }
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            if (pinnedHighlightTimerRef.current) window.clearTimeout(pinnedHighlightTimerRef.current);
            pinnedHighlightTimerRef.current = window.setTimeout(() => setHighlightedMessageId(null), 1800);
        });
    }, [pinnedMessages]);

    const goToNextPinnedMessage = useCallback(() => {
        if (!pinnedMessages.length) return;
        navigateToPinnedMessage((activePinnedIndex + 1) % pinnedMessages.length);
    }, [activePinnedIndex, navigateToPinnedMessage, pinnedMessages.length]);

    useEffect(() => () => {
        if (pinnedHighlightTimerRef.current) window.clearTimeout(pinnedHighlightTimerRef.current);
    }, []);

    /* =====================================================
       DELETE
    ===================================================== */

      const deleteMessagesWithScope = async (list, scope) => {
        const targets = [
            ...new Map((list || []).map((item) => [Number(item.id), item])).values(),
        ];
        if (!targets.length || messageDeleteBusy) return;

        const everyone = scope === "everyone";
        const eligible = everyone
            ? targets.filter(
                  (item) =>
                      Number(item.sender_employee_id) === Number(employeeId) &&
                      !item.deleted_at
              )
            : targets;

        if (!eligible.length) {
            setMessageDeleteConfirm(null);
            toast("Only your own messages can be deleted for everyone.", { icon: "ℹ️" });
            return;
        }

        try {
            setMessageDeleteBusy(true);

            const results = await Promise.allSettled(
                eligible.map(async (item) => {
                    const response = await fetch(`/api/chat/messages/${item.id}`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            employeeId,
                            scope: everyone ? "everyone" : "me",
                        }),
                    });
                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || "Failed to delete message");
                    }
                    return { id: item.id, data };
                })
            );

            const done = results
                .filter((result) => result.status === "fulfilled")
                .map((result) => result.value);
            const failedCount = results.length - done.length;

            if (done.length) {
                const doneIds = new Set(done.map((entry) => Number(entry.id)));

                if (everyone) {
                    setMessages((prev) =>
                        prev.map((item) => {
                            const hit = done.find((entry) => Number(entry.id) === Number(item.id));
                            return hit
                                ? { ...item, ...hit.data.message, is_pinned: false, reactions: [] }
                                : item;
                        })
                    );
                } else {
                    // "Delete for me": the message simply disappears from this side
                    setMessages((prev) => prev.filter((item) => !doneIds.has(Number(item.id))));
                }

                setPinnedMessages((prev) => prev.filter((pin) => !doneIds.has(Number(pin.message_id))));
                setStarredMessages((prev) => prev.filter((item) => !doneIds.has(Number(item.message_id))));
                if (selectedId) await loadPinnedMessages(selectedId);
                await loadStarredMessages();
                if (!everyone && selectedId) await loadConversations(selectedId);

                toast.success(
                    done.length === 1 ? "Message deleted" : `${done.length} messages deleted`
                );
            }

            if (failedCount) {
                toast.error(
                    failedCount === 1
                        ? "Could not delete 1 message"
                        : `Could not delete ${failedCount} messages`
                );
            }

            setMessageDeleteConfirm(null);
            if (selectionMode && !failedCount) exitSelectionMode();
        } finally {
            setMessageDeleteBusy(false);
        }
    };

    const requestDeleteCurrentMessage = (message) => {
        if (!message || messageDeleteBusy) return;
        setActiveMessageMenuId(null);
        setActiveReactionMessageId(null);
        setMessageDeleteConfirm([message]);
    };

   const replaceOldestPin = async (message) => {
    if (!message) return;

    try {
        const response = await fetch(
            `/api/chat/messages/${message.id}/pin`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    employeeId,
                    replaceOldest: true,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                    "Failed to replace oldest pin"
            );
        }

        setPinLimitConfirm(null);

        setMessages((prev) =>
            prev.map((item) =>
                Number(item.id) === Number(message.id)
                    ? {
                          ...item,
                          is_pinned: true,
                      }
                    : item
            )
        );

        await loadPinnedMessages(selectedId);

        toast.success("Message pinned");
    } catch (error) {
        toast.error(error.message);
    }
};

const toggleMessageFlag = async (message, type) => {
    if (type === "pin" && message.deleted_at) {
        toast.error("Deleted messages cannot be pinned");
        return;
    }

    const isActive =
        type === "pin"
            ? Boolean(message.is_pinned)
            : Boolean(message.is_starred);

    // ----------------------------------------------------
    // Maximum 4 active pins
    // ----------------------------------------------------

    if (
        type === "pin" &&
        !isActive &&
        pinnedMessages.length >= 4
    ) {
        setPinLimitConfirm(message);
        return;
    }

    const endpoint =
        type === "pin"
            ? `/api/chat/messages/${message.id}/pin`
            : `/api/chat/messages/${message.id}/star`;

    try {
        const response = await fetch(endpoint, {
            method: isActive ? "DELETE" : "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                employeeId,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                    `Failed to ${
                        isActive ? "remove" : "add"
                    } ${type}`
            );
        }

        setMessages((prev) =>
            prev.map((item) =>
                Number(item.id) === Number(message.id)
                    ? {
                          ...item,
                          ...(type === "pin"
                              ? {
                                    is_pinned:
                                        !isActive,
                                }
                              : {
                                    is_starred:
                                        !isActive,
                                }),
                      }
                    : item
            )
        );

        if (type === "pin") {
            await loadPinnedMessages(selectedId);
        } else {
            await loadStarredMessages();
        }

        toast.success(
            type === "pin"
                ? isActive
                    ? "Message unpinned"
                    : "Message pinned"
                : isActive
                  ? "Message unstarred"
                  : "Message starred"
        );
    } catch (error) {
        toast.error(error.message);
    }
};

    const togglePin = (message) => toggleMessageFlag(message, "pin");
    const toggleStar = (message) => toggleMessageFlag(message, "star");

    /* =====================================================
       REACTION
    ===================================================== */

        const react = async (message, emoji) => {
        const isDeleted = Boolean(message.deleted_at);

        // Does the current employee already own THIS emoji on this message?
        // Works with both shapes: grouped [{ emoji, employees: [...] }]
        // and flat [{ emoji, employee_id }].
        const ownsEmoji = (message.reactions || []).some((item) => {
            if (item.emoji !== emoji) return false;
            if (Array.isArray(item.employees)) {
                return item.employees.some(
                    (person) => Number(person.employee_id) === Number(employeeId)
                );
            }
            return Number(item.employee_id) === Number(employeeId);
        });

        // A deleted message cannot get NEW reactions, but you can always
        // remove your own.
        if (isDeleted && !ownsEmoji) {
            toast.error("Cannot react to a deleted message");
            return;
        }

        if (!isDeleted) recordRecentEmoji(emoji);

        try {
            // Deleted message + own emoji => REMOVE via the dedicated endpoint.
            const response = await fetch(
                `/api/chat/messages/${message.id}/reaction`,
                {
                    method: isDeleted ? "DELETE" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                        isDeleted ? { employeeId } : { employeeId, emoji }
                    ),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to react");
            }

            const reactionResponse = await fetch(
                `/api/chat/messages/${message.id}/reactions?employeeId=${employeeId}`
            );
            const reactionData = await reactionResponse.json();

            setMessages((prev) =>
                prev.map((item) =>
                    Number(item.id) === Number(message.id)
                        ? {
                              ...item,
                              reactions:
                                  reactionResponse.ok && reactionData.success
                                      ? reactionData.reactions || []
                                      : item.reactions || [],
                          }
                        : item
                )
            );
        } catch (error) {
            toast.error(error.message);
        }
    };

    /* =====================================================
       FORWARD
    ===================================================== */

    const forward = async (conversationIds) => {
    if (!forwardingMessage || !conversationIds.length) {
        return;
    }

    const messagesToForward = Array.isArray(forwardingMessage)
        ? forwardingMessage
        : [forwardingMessage];

    try {
        let totalForwarded = 0;

        for (const message of messagesToForward) {
            const response = await fetch(
                `/api/chat/messages/${message.id}/forward`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        employeeId,
                        conversationIds,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Failed to forward message"
                );
            }

            totalForwarded += Number(
                data.forwardedCount || 0
            );
        }

        toast.success(
            `${messagesToForward.length} message${
                messagesToForward.length === 1 ? "" : "s"
            } forwarded to ${
                conversationIds.length
            } conversation${
                conversationIds.length === 1 ? "" : "s"
            }`
        );

        setForwardingMessage(null);

        const onForwardDone = forwardSuccessRef.current;
        forwardSuccessRef.current = null;
        onForwardDone?.();

        if (
            conversationIds.some(
                (id) =>
                    Number(id) === Number(selectedId)
            )
        ) {
            await loadMessages(selectedId);
            await loadConversations(selectedId);
        }
    } catch (error) {
        toast.error(error.message);
    }
};

    const clearCurrentChat = async () => {
        if (!selectedId || chatActionBusy) return;
        try {
            setChatActionBusy(true);
            const response = await fetch(`/api/chat/conversations/${selectedId}/clear`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to clear chat");
            setMessages([]);
            setPinnedMessages([]);
            setActivePinnedIndex(0);
            setHighlightedMessageId(null);
            setChatAction(null);
            setHeaderMenuOpen(false);
            setActiveMessageMenuId(null);
            setActiveReactionMessageId(null);
            setSelectionMode(false);
            setSelectedMessageIds([]);
            await loadConversations(selectedId);
            toast.success("Chat cleared");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setChatActionBusy(false);
        }
    };

    const deleteCurrentChat = async () => {
        if (!selectedId || chatActionBusy) return;
        try {
            const deletedId = selectedId;
            setChatActionBusy(true);
            const response = await fetch(`/api/chat/conversations/${deletedId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to delete chat");
            setChatAction(null);
            setHeaderMenuOpen(false);
            setActiveMessageMenuId(null);
            setActiveReactionMessageId(null);
            setSelectionMode(false);
            setSelectedMessageIds([]);
            setSelectedId(null);
            setSelectedConversation(null);
            setParticipants([]);
            setMessages([]);
            setPinnedMessages([]);
            setActivePinnedIndex(0);
            setHighlightedMessageId(null);
            await loadConversations();
            toast.success("Chat deleted");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setChatActionBusy(false);
        }
    };

    const toggleMessageSelection = useCallback((messageId) => {
        setSelectedMessageIds((current) =>
            current.includes(Number(messageId))
                ? current.filter((id) => id !== Number(messageId))
                : [...current, Number(messageId)]
        );
    }, []);

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setSelectedMessageIds([]);
    }, []);

    const copySelectedMessages = async () => {
        const selected = messages.filter((message) => selectedMessageIds.includes(Number(message.id)));
        if (!selected.length) return;
        try {
            await navigator.clipboard.writeText(selected.map((message) => message.message || "").join("\n"));
            const count = selected.length;
            exitSelectionMode();
            toast.success(count === 1 ? "Message copied" : `${count} messages copied`);
        } catch {
            toast.error("Could not copy messages");
        }
    };

        const deleteSelectedMessages = () => {
        if (!selectedMessageIds.length) return;
        const selected = messages.filter((message) =>
            selectedMessageIds.includes(Number(message.id))
        );
        if (!selected.length) return;
        setMessageDeleteConfirm(selected);
    };

    const forwardSelectedMessage = () => {
    const selected = messages.filter((message) =>
        selectedMessageIds.includes(Number(message.id))
    );

    if (!selected.length) return;

    exitSelectionMode();
    setForwardingMessage(selected);
};

        // Chat Info panel -> reuse the existing ForwardModal / forward() flow
    const openForwardFromInfo = useCallback((messageIds, onSuccess) => {
        const ids = [...new Set((messageIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
        if (!ids.length) return;
        forwardSuccessRef.current = typeof onSuccess === "function" ? onSuccess : null;
        setForwardingMessage(ids.map((id) => ({ id })));
    }, []);

    // Chat Info panel deleted messages via the existing DELETE endpoint -> sync local state
    const handleInfoMessagesDeleted = useCallback(async (deleted = []) => {
        if (!deleted.length) return;

        const everyoneMap = new Map();
        const meIds = new Set();
        deleted.forEach((entry) => {
            if (entry.scope === "me") meIds.add(Number(entry.id));
            else everyoneMap.set(Number(entry.id), entry.message);
        });
        const allIds = new Set([...meIds, ...everyoneMap.keys()]);

        setMessages((current) =>
            current
                .filter((message) => !meIds.has(Number(message.id)))
                .map((message) => {
                    if (!everyoneMap.has(Number(message.id))) return message;
                    const server = everyoneMap.get(Number(message.id));
                    return {
                        ...message,
                        ...(server || {
                            deleted_at: new Date().toISOString(),
                            message: "This message was deleted",
                        }),
                        is_pinned: false,
                        reactions: [],
                    };
                })
        );
        setPinnedMessages((prev) => prev.filter((pin) => !allIds.has(Number(pin.message_id))));
        setStarredMessages((prev) => prev.filter((item) => !allIds.has(Number(item.message_id))));

        if (selectedId) await loadPinnedMessages(selectedId);
        await loadStarredMessages();
        if (meIds.size && selectedId) await loadConversations(selectedId);
    }, [selectedId, loadPinnedMessages, loadStarredMessages, loadConversations]);

    // Refresh conversation metadata (members + sidebar) without reloading messages
    const refreshConversationMeta = useCallback(async () => {
        if (!selectedId || !employeeId) return;
        try {
            const response = await fetch(
                `/api/chat/conversations/${selectedId}?employeeId=${employeeId}`
            );
            const data = await response.json();
            if (response.ok && data.success) {
                setSelectedConversation(data.conversation);
                setParticipants(data.participants || []);
            }
        } catch (error) {
            console.error("Refresh conversation error:", error);
        }
        await loadConversations(selectedId);
    }, [selectedId, employeeId, loadConversations]);

    /* =====================================================
       Q5 REPLY
    ===================================================== */

    const startReply = (message) => {
        setActiveMessageMenuId(null);
        setActiveReactionMessageId(null);
        setFullPickerMessage(null);
        setComposerEmojiOpen(false);
        setAttachmentMenuOpen(false);
        setEditingMessage(null);
        setReplyingTo(message);
        setMessageText("");

        setTimeout(() => {
            composerRef.current?.focus();
        }, 50);
    };

    /* =====================================================
       EDIT
    ===================================================== */

    const startEdit = (message) => {
        setActiveMessageMenuId(null);
        setActiveReactionMessageId(null);
        setFullPickerMessage(null);
        setComposerEmojiOpen(false);
        setAttachmentMenuOpen(false);
        setReplyingTo(null);
        setEditingMessage(message);
        setEditingText(
            message.message || ""
        );
        setMessageText(
            message.message || ""
        );

        setTimeout(() => {
            composerRef.current?.focus();
        }, 50);
    };

    const cancelComposerMode = () => {
        setReplyingTo(null);
        setEditingMessage(null);
        setEditingText("");
        setMessageText("");
    };

    const handleComposerChange = (
        value
    ) => {
        setMessageText(value);

        if (editingMessage) {
            setEditingText(value);
        }
    };

    const handleComposerKeyDown = (
        event
    ) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            if (editingMessage) {
                editCurrentMessage();
            } else {
                sendCurrentMessage();
            }
        }
    };

    const openConversation = (id) => {
        setSelectedId(Number(id));
        setMobileListOpen(false);
    };

    /* =====================================================
       FULL PICKER POSITIONING + HANDLERS
       (All hooks must stay ABOVE the `!employeeId` early
       return further down.)
    ===================================================== */

    const updateFullPickerPosition = useCallback(() => {
    if (!fullPickerMessage || !fullPickerAnchorRect || !fullPickerRef.current) {
        setFullPickerPosition(null);
        return;
    }

    const pickerWidth = fullPickerRef.current.getBoundingClientRect().width;
    const containerRect = messagesViewportRef.current?.getBoundingClientRect();

    const viewportPadding = 8;
    const viewportTop = 72;
    const viewportBottom = window.innerHeight - viewportPadding;

    const boundaryLeft = Math.max(containerRect?.left ?? 0, viewportPadding);
    const boundaryRight = Math.min(
        containerRect?.right ?? window.innerWidth,
        window.innerWidth - viewportPadding
    );
    const boundaryTop = Math.max(containerRect?.top ?? viewportTop, viewportTop);
    const boundaryBottom = Math.min(
        containerRect?.bottom ?? viewportBottom,
        viewportBottom
    );

    // Pick the gap based on what the picker is attached to
    const gapBelow = fullPickerAnchorRect.bottomIsRow
        ? PICKER_GAP_TO_ROW
        : PICKER_GAP_TO_TRAY;
    const gapAbove = fullPickerAnchorRect.topIsRow
        ? PICKER_GAP_TO_ROW
        : PICKER_GAP_TO_TRAY;

    // ---------- horizontal ----------
    const trayCenter =
        fullPickerAnchorRect.left +
        (fullPickerAnchorRect.right - fullPickerAnchorRect.left) / 2;

    const edgePadding = 45;
    const maxLeft = boundaryRight - pickerWidth;

    const left = Math.max(
        boundaryLeft + edgePadding,
        Math.min(trayCenter - pickerWidth / 2, maxLeft - edgePadding)
    );

    // ---------- vertical ----------
    const spaceBelow = Math.max(
        0,
        boundaryBottom - fullPickerAnchorRect.bottom - gapBelow
    );
    const spaceAbove = Math.max(
        0,
        fullPickerAnchorRect.top - boundaryTop - gapAbove
    );

    let placeBelow;
    if (spaceBelow >= FULL_PICKER_HEIGHT) placeBelow = true;
    else if (spaceAbove >= FULL_PICKER_HEIGHT) placeBelow = false;
    else placeBelow = spaceBelow >= spaceAbove;

    const height = Math.max(
        100,
        Math.min(FULL_PICKER_HEIGHT, placeBelow ? spaceBelow : spaceAbove)
    );

    const top = placeBelow
        ? fullPickerAnchorRect.bottom + gapBelow
        : fullPickerAnchorRect.top - gapAbove - height;

    setFullPickerMaxHeight(height);
    setFullPickerPosition({ top, left });
}, [fullPickerAnchorRect, fullPickerMessage]);

    useLayoutEffect(() => {
        if (!fullPickerMessage) {
            setFullPickerPosition(null);
            return;
        }

        const frame = requestAnimationFrame(() => {
            updateFullPickerPosition();
        });

        return () => cancelAnimationFrame(frame);
    }, [fullPickerMessage, fullPickerAnchorRect, updateFullPickerPosition,  fullPickerMaxHeight]);

    useEffect(() => {
        if (!fullPickerMessage) return;

        const reposition = () => updateFullPickerPosition();
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);

        return () => {
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [fullPickerMessage, updateFullPickerPosition]);

    const openFullPicker = useCallback((message, anchor) => {
    if (!message) return;

    const rect = anchor?.getBoundingClientRect
        ? anchor.getBoundingClientRect()
        : anchor;

    setFullPickerAnchorRect(
        rect
            ? {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.right - rect.left,
                  height: rect.bottom - rect.top,
                  bottomIsRow: rect.bottomIsRow ?? true,
                  topIsRow: rect.topIsRow ?? true,
              }
            : null
    );
    setFullPickerMessage(message);
    setActiveMessageMenuId(null);
    setActiveReactionMessageId(message.id);
}, []);

const closeFullPicker = useCallback(() => {
    setFullPickerMessage(null);
    setFullPickerAnchorRect(null);
    setFullPickerPosition(null);
    setFullPickerMaxHeight(null); // reset so the next open starts fresh
}, []);

    const toggleMessageMenu = useCallback((messageId) => {
        setActiveMessageMenuId((current) =>
            current === messageId ? null : messageId
        );
        setActiveReactionMessageId(null);
        closeFullPicker();
    }, [closeFullPicker]);

    const toggleMessageReactionPicker = useCallback((messageId) => {
        setActiveReactionMessageId((current) =>
            current === messageId ? null : messageId
        );
        setActiveMessageMenuId(null);
        closeFullPicker();
    }, [closeFullPicker]);

    const openReactionDetails = useCallback((message, reaction, anchorRect) => {
    setActiveMessageMenuId(null);
    setActiveReactionMessageId(null);
    closeFullPicker();
    setReactionDetails({
        messageId: message.id,
        emoji: reaction?.emoji || "all",
        anchorRect: anchorRect || null,
    });
}, [closeFullPicker]);

    const handleComposerEmojiSelect = useCallback((emoji) => {
        recordRecentEmoji(emoji);
        setMessageText((value) => `${value}${emoji}`);
        setComposerEmojiOpen(false);
        setTimeout(() => composerRef.current?.focus(), 0);
    }, []);

    const uploadSelectedAttachments = useCallback(async (files, caption = "") => {
        if (!selectedId || !employeeId || !files.length) return;

        const selected = Array.from(files);
        const isMedia = (file) =>
            file.type.startsWith("image/") || file.type.startsWith("video/");
        const videos = selected.filter((file) => file.type.startsWith("video/"));
        const photos = selected.filter((file) => file.type.startsWith("image/"));
        const documents = selected.filter((file) => !isMedia(file));

        if (photos.length + videos.length > 8) {
            toast.error("You can attach at most 8 photos/videos at once.");
            return;
        }

        if (videos.length > 2) {
            toast.error("You can attach at most 2 videos at once.");
            return;
        }

        if (photos.some((file) => file.size > 16 * 1024 * 1024)) {
            toast.error("Each photo must be 16 MB or smaller.");
            return;
        }

        if (videos.some((file) => file.size > 100 * 1024 * 1024)) {
            toast.error("Each video must be 100 MB or smaller.");
            return;
        }

        if (documents.some((file) => file.size > 100 * 1024 * 1024)) {
            toast.error("Documents must be 100 MB or smaller.");
            return;
        }

        /*
         * WhatsApp-style media grouping:
         *
         * 1-3 photos/videos -> each file gets its own message bubble.
         * 4+ photos/videos  -> all media stay together in one message,
         *                       allowing MessageAttachments to render a 2x2 grid.
         *
         * Documents remain one document per message.
         */
        const batches = [];
        const media = selected.filter(isMedia);

        if (media.length > 0) {
            if (media.length <= 3) {
                media.forEach((file) => batches.push([file]));
            } else {
                batches.push(media);
            }
        }

        documents.forEach((file) => batches.push([file]));

        try {
            setAttachmentUploadBusy(true);

            for (let i = 0; i < batches.length; i += 1) {
                const formData = new FormData();

                formData.append("employeeId", String(employeeId));

                if (i === 0 && caption.trim()) {
                    formData.append("caption", caption.trim());
                }

                if (i === 0 && replyingTo?.id) {
                    formData.append(
                        "replyToMessageId",
                        String(replyingTo.id)
                    );
                }

                batches[i].forEach((file) => {
                    formData.append("files", file);
                });

                const response = await fetch(
                    `/api/chat/conversations/${selectedId}/attachments`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Failed to upload attachment"
                    );
                }

             if (Number(selectedIdRef.current) === Number(selectedId)) {
                setMessages((prev) => [
                    ...prev,
                    {
                        ...data.message,
                        reactions: data.message?.reactions || [],
                    },
                ]);
            }
}
            setReplyingTo(null);
            setPendingAttachments([]);
            setAttachmentCaption("");
            setAttachmentPreviewOpen(false);

            await loadConversations(selectedId);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setAttachmentUploadBusy(false);
        }
    }, [employeeId, loadConversations, replyingTo, selectedId]);

    const handleAttachmentChoice = useCallback((type) => {
        setAttachmentMenuOpen(false);
        if (type === "image") {
            attachmentInputRef.current?.click();
            return;
        }
        if (type === "file") {
            documentInputRef.current?.click();
            return;
        }
        setPollComposerOpen(true);
    }, []);

    const handleAttachmentFile = useCallback((event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length) return;
        setPendingAttachments(files);
        setAttachmentCaption("");
        setAttachmentPreviewOpen(true);
    }, []);

    const submitPoll = useCallback(async () => {
        const question = pollQuestion.trim();
        const options = pollOptions.map((value) => value.trim()).filter(Boolean);
        if (!selectedId || !question) return toast.error("Enter a poll question.");
        if (options.length < 2) return toast.error("Add at least two poll options.");
        try {
            setPollBusy(true);
            const response = await fetch(`/api/chat/conversations/${selectedId}/polls`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId,
                    question,
                    options,
                    allowMultipleAnswers: pollAllowMultiple,
                    allowVoteChanges: pollAllowVoteChanges,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to create poll");
            setMessages((prev) => [...prev, { ...data.message, reactions: [] }]);
            setPollQuestion("");
            setPollOptions(["", ""]);
            setPollAllowMultiple(false);
            setPollAllowVoteChanges(true);
            setPollComposerOpen(false);
            await loadConversations(selectedId);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setPollBusy(false);
        }
    }, [employeeId, loadConversations, pollAllowMultiple, pollAllowVoteChanges, pollOptions, pollQuestion, selectedId]);

    /* =====================================================
       EARLY RETURN (moved BELOW all hooks — Rules of Hooks)
    ===================================================== */

    if (!employeeId) {
        return (
            <div className="flex min-h-[calc(100vh-7.5rem)] items-center justify-center rounded-[28px] bg-white">
                <div className="text-center">
                    <MessageCircle
                        className="mx-auto text-orange-500"
                        size={40}
                    />

                    <h2 className="mt-3 font-bold text-gray-900">
                        Chat unavailable
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Please log in again to
                        continue.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-page h-[calc(100vh-4rem)] min-h-0 w-full overflow-hidden p-0">
            <div className="isolate relative flex h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-white shadow-none">
                {/* =================================================
                   SIDEBAR
                ================================================= */}

                <aside
                    className={`absolute inset-y-0 left-0 z-30 w-full border-r border-gray-100 bg-white transition-transform duration-300 md:relative md:block md:w-[330px] md:translate-x-0 lg:w-[360px] ${
                        mobileListOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }`}
                >
                    <div className="relative flex h-full flex-col">
                        {starredPanelOpen && (
                            <div className="absolute inset-0 z-40 flex h-full flex-col bg-white">
                                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
                                    <button
                                        type="button"
                                        onClick={() => setStarredPanelOpen(false)}
                                        className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                                        title="Back"
                                        aria-label="Back to conversations"
                                    >
                                        <ArrowLeft size={19} />
                                    </button>

                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900">
                                            Starred messages
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-gray-400">
                                            {starredMessages.length} starred
                                        </p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 chat-scrollbar">
                                    {starredLoading ? (
                                        <div className="flex min-h-[260px] items-center justify-center">
                                            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
                                                <Loader2
                                                    size={15}
                                                    className="animate-spin text-orange-500"
                                                />
                                                Loading starred messages...
                                            </div>
                                        </div>
                                    ) : starredMessages.length ? (
                                        starredMessages.map((starred) => (
                                            <button
                                                key={starred.id || starred.message_id}
                                                type="button"
                                                onClick={() => {
                                                    setStarredTarget({
                                                        conversationId: starred.conversation_id,
                                                        messageId: starred.message_id,
                                                    });
                                                    setStarredPanelOpen(false);
                                                    setSelectedId(Number(starred.conversation_id));
                                                    setMobileListOpen(false);
                                                }}
                                                className="mb-1 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-gray-50"
                                            >
                                                <Star
                                                    size={15}
                                                    className="mt-0.5 shrink-0 text-orange-500"
                                                    fill="currentColor"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="truncate text-[11px] font-semibold text-gray-500">
                                                            {Number(starred.sender_employee_id) === Number(employeeId)
                                                                ? "You"
                                                                : starred.sender_name || "Message"}
                                                        </p>
                                                        <span className="shrink-0 text-[10px] text-gray-400">
                                                            {formatConversationTime(starred.created_at)}
                                                        </span>
                                                    </div>

                                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-700">
                                                        {starred.message}
                                                    </p>

                                                    {starred.conversation_type === "group" && starred.title && (
                                                        <p className="mt-1 truncate text-[10px] text-gray-400">
                                                            {starred.title}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                                                <Star size={25} fill="currentColor" />
                                            </div>
                                            <p className="mt-4 text-sm font-semibold text-gray-700">
                                                No starred messages
                                            </p>
                                            <p className="mt-1 max-w-[240px] text-xs leading-5 text-gray-400">
                                                Star important messages and they will appear here.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="border-b border-gray-100 p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                                        <MessageCircle
                                            size={18}
                                        />
                                    </div>

                                    <div>
                                        <p className="text-sm font-bold text-gray-900">
                                            Messages
                                        </p>

                                        <p className="text-[11px] text-gray-400">
                                            {
                                                conversations.length
                                            }{" "}
                                            conversations
                                        </p>
                                    </div>
                                </div>

                                {/* button group start */}
                                <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setStarredPanelOpen(true);
                                loadStarredMessages();
                            }}
                            className="rounded-xl p-2 text-gray-400 transition hover:bg-orange-50 hover:text-orange-500"
                            title="Starred messages"
                            aria-label="Starred messages"
                        >
                            <Star size={17} fill="currentColor" />
                        </button>

                        {isSystemAdmin && (
                                <button
                                    onClick={() => setNewGroupOpen(true)}
                                    className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-700 transition hover:-translate-y-0.5 hover:border-gray-300"
                                    title="New group"
                                >
                                    <Users size={16} />
                                </button>
                        )}
                                {/* button group end */}

                                <button
                                    onClick={() =>
                                        setNewChatOpen(
                                            true
                                        )
                                    }
                                    className="rounded-xl p-2 text-gray-400 transition hover:bg-orange-50 hover:text-orange-500"
                                    title="New chat"
                                >
                                    <Plus size={18} />
                                </button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search
                                    size={16}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                                />

                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Search conversations..."
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-10 pr-4 text-xs text-gray-800 outline-none transition focus:border-orange-200 focus:bg-white focus:ring-4 focus:ring-orange-50"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 chat-scrollbar">{loadingConversations ? (
                                <div className="space-y-2 p-2">
                                    {[1, 2, 3, 4, 5].map(
                                        (item) => (
                                            <div
                                                key={item}
                                                className="flex items-center gap-3 rounded-2xl p-3"
                                            >
                                                <div className="h-11 w-11 animate-pulse rounded-2xl bg-gray-100" />

                                                <div className="flex-1 space-y-2">
                                                    <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                                                    <div className="h-2.5 w-full animate-pulse rounded bg-gray-100" />
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            ) : filteredConversations.length ? (
                                filteredConversations.map(
                                    (
                                        conversation
                                    ) => {
                                        const active =
                                            Number(
                                                conversation.id
                                            ) ===
                                            Number(
                                                selectedId
                                            );

                                        return (
                                            <button
                                                key={
                                                    conversation.id
                                                }
                                                onClick={() =>
                                                    openConversation(
                                                        conversation.id
                                                    )
                                                }
                                                className={`group mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-200 ${
                                                    active
                                                        ? "bg-orange-50 shadow-sm ring-1 ring-orange-100"
                                                        : "hover:bg-gray-50"
                                                }`}
                                            >
                                                <Avatar
                                                    name={
                                                        conversation.displayName
                                                    }
                                                    avatar={
                                                        conversation.displayAvatar
                                                    }
                                                    size="md"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p
                                                            className={`truncate text-sm font-bold ${
                                                                active
                                                                    ? "text-gray-950"
                                                                    : "text-gray-800"
                                                            }`}
                                                        >
                                                            {
                                                                conversation.displayName
                                                            }
                                                        </p>

                                                        <span className="shrink-0 text-[10px] text-gray-400">
                                                            {formatConversationTime(
                                                                conversation.last_message_at ||
                                                                    conversation.updated_at
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="mt-1 flex items-center gap-1.5">
                                                        {conversation.conversation_type ===
                                                        "group" ? (
                                                            <Users
                                                                size={
                                                                    11
                                                                }
                                                                className="shrink-0 text-gray-400"
                                                            />
                                                        ) : (
                                                            <span
                                                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                                                    active
                                                                        ? "bg-orange-500"
                                                                        : "bg-emerald-400"
                                                                }`}
                                                            />
                                                        )}

                                                        <p className="truncate text-xs text-gray-400">
                                                            {conversation.conversation_type ===
                                                            "group"
                                                                ? conversation.last_message_preview ||
                                                                  "No messages yet"
                                                                : conversation.last_message_preview ||
                                                                  "No messages yet"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    }
                                )
                            ) : (
                                <div className="px-5 py-14 text-center">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                                        <MessageCircle
                                            size={25}
                                        />
                                    </div>

                                    <p className="mt-3 text-sm font-semibold text-gray-700">
                                        No conversations
                                        yet
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-gray-400">
                                        Start a new chat
                                        with an
                                        employee.
                                    </p>

                                    <button
                                        onClick={() =>
                                            setNewChatOpen(
                                                true
                                            )
                                        }
                                        className="mt-4 text-xs font-bold text-orange-500 hover:text-orange-600"
                                    >
                                        Start chatting →
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Q7 bottom You / Available section removed */}
                    </div>
                </aside>

                {/* =================================================
                   MAIN CHAT
                ================================================= */}

                <section ref={chatWorkspaceRef} className="relative flex min-w-0 flex-1 flex-col bg-[#f8fafc]">
                    {!selectedId ||
                    !selectedConversation ? (
                        <EmptyState
                            onNewChat={() =>
                                setNewChatOpen(true)
                            }
                        />
                    ) : (
                        <>
                            <header 
                                onClick={() => setGroupInfoOpen(true)}
                                className="relative z-20 flex cursor-pointer items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur md:px-5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <button onClick={(event) => { event.stopPropagation(); setMobileListOpen(true); }} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 md:hidden" title="Back to conversations"><ArrowLeft size={18} /></button>
                                    <button type="button" onClick={() => setGroupInfoOpen(true)} className="flex min-w-0 items-center gap-3 rounded-2xl text-left hover:bg-gray-50" title="Open chat info">
                                        <Avatar name={selectedDisplay?.displayName || selectedConversation.title} avatar={selectedDisplay?.displayAvatar || selectedConversation.avatar} online={selectedConversation.conversation_type === "direct"} />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2"><h2 className="truncate text-sm font-bold text-gray-900 md:text-base">{selectedDisplay?.displayName || selectedConversation.title || "Conversation"}</h2>{selectedConversation.conversation_type === "group" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Group</span>}</div>
                                            <p className="mt-0.5 truncate text-[11px] text-gray-400">{selectedConversation.conversation_type === "group" ? `${participants.length} members` : selectedDisplay?.otherEmployee?.designation || selectedDisplay?.otherEmployee?.department || "Active conversation"}</p>
                                        </div>
                                    </button>
                                </div>
                                <div className="relative flex items-center gap-1" data-chat-overlay-root onClick={(event) => event.stopPropagation()}>
                                    <button onClick={() => { setConversationSearchOpen((v) => !v); setHeaderMenuOpen(false); }} className={`rounded-xl p-2 transition ${conversationSearchOpen ? "bg-orange-50 text-orange-500" : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"}`} title="Search messages" aria-label="Search messages"><Search size={17} /></button>
                                    <button onClick={() => { setHeaderMenuOpen((v) => !v); setConversationSearchOpen(false); }} className={`rounded-xl p-2 transition ${headerMenuOpen ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"}`} title="Menu" aria-label="Menu"><MoreHorizontal size={18} /></button>
                                    {conversationSearchOpen && <div ref={conversationSearchRef} className="absolute right-10 top-12 z-[80] w-[min(92vw,390px)] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl animate-chat-pop">
                                        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"><Search size={15} className="text-gray-400"/><input autoFocus value={conversationSearch} onChange={(e) => setConversationSearch(e.target.value)} placeholder="Search in this conversation" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/><span className="shrink-0 text-[10px] font-semibold text-gray-400">{conversationSearchResults.length ? `${conversationSearchIndex + 1} of ${conversationSearchResults.length}` : "0 results"}</span></div>
                                        <div className="mt-2 flex items-center justify-between"><button disabled={!conversationSearchResults.length} onClick={() => { const n=(conversationSearchIndex-1+conversationSearchResults.length)%conversationSearchResults.length; setConversationSearchIndex(n); jumpToConversationSearchResult(n); }} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30">Previous</button><button disabled={!conversationSearchResults.length} onClick={() => { const n=(conversationSearchIndex+1)%conversationSearchResults.length; setConversationSearchIndex(n); jumpToConversationSearchResult(n); }} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30">Next</button><button onClick={() => { setConversationSearchOpen(false); setConversationSearch(""); }} className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-orange-500 hover:bg-orange-50">Done</button></div>
                                    </div>}
                                    {headerMenuOpen && <div ref={headerMenuRef} className="absolute right-0 top-12 z-[80] w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl animate-chat-pop">
                                        <button onClick={() => { setConversationSearchOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"><Search size={15}/>Search</button>
                                        <button onClick={() => { setSelectedId(null); setSelectedConversation(null); setParticipants([]); setMessages([]); setPinnedMessages([]); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"><X size={15}/>Close Chat</button>
                                        <button onClick={() => { setSelectionMode(true); setSelectedMessageIds([]); setHeaderMenuOpen(false); setActiveMessageMenuId(null); setActiveReactionMessageId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"><Check size={15}/>Select Messages</button>
                                        <button onClick={() => { setChatAction("clear"); setHeaderMenuOpen(false); setActiveMessageMenuId(null); setActiveReactionMessageId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"><Trash2 size={15}/>Clear Chat</button>
                                        <button onClick={() => { setChatAction("delete"); setHeaderMenuOpen(false); setActiveMessageMenuId(null); setActiveReactionMessageId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-red-600 hover:bg-red-50"><Trash2 size={15}/>Delete Chat</button>
                                    </div>}
                                </div>
                            </header>

                            {pinnedMessages.length > 0 && (
                                 <button
                                        type="button"
                                    onClick={goToNextPinnedMessage}
                                    className="relative z-10 flex w-full items-stretch border-b border-gray-100 bg-white text-left transition hover:bg-gray-50 focus:outline-none"
                                    title="Go to next pinned message"
                                    aria-label="Go to next pinned message"
                                >
                                    {/* Compact WhatsApp-style stacked pin indicator */}
                                    <span className="flex w-7 shrink-0 flex-col items-center justify-center gap-[2px] border-r border-gray-100 bg-gray-50/70 px-2 py-2">
                                        {pinnedMessages.map((pin, index) => (
                                            <span
                                                key={pin.id || `${pin.message_id}-${pin.pinned_by}`}
                                                className={`rounded-full transition-all ${
                                                    index === activePinnedIndex
                                                        ? "h-4 w-[3px] bg-orange-500"
                                                        : "h-3 w-[3px] bg-gray-300"
                                                }`}
                                            />
                                        ))}
                                    </span>

                                    <span className="min-w-0 flex-1 px-3 py-2.5 md:px-4">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <Pin
                                                size={13}
                                                className="shrink-0 text-orange-500"
                                                fill="currentColor"
                                            />

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-xs font-medium text-gray-700">
                                                    {pinnedMessages[activePinnedIndex]?.message ||
                                                        "Pinned message"}
                                                </span>

                                                <span className="mt-0.5 block truncate text-[9px] text-gray-400">
                                                    {Number(
                                                        pinnedMessages[activePinnedIndex]?.pinned_by
                                                    ) === Number(employeeId)
                                                        ? "You"
                                                        : pinnedMessages[activePinnedIndex]
                                                            ?.pinned_by_name || "Unknown"}
                                                </span>
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            )}

                            <div ref={messagesViewportRef} data-chat-messages-viewport className="relative flex-1 overflow-y-auto bg-gray-100 p-5 chat-scrollbar">
                                <div className="flex w-full flex-col gap-1">
                                    {loadingMessages ? (
                                        <div className="flex h-full min-h-[380px] items-center justify-center">
                                            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm">
                                                <Loader2
                                                    size={15}
                                                    className="animate-spin text-orange-500"
                                                />
                                                Loading
                                                messages...
                                            </div>
                                        </div>
                                    ) : messages.length ? (
                                        messages.map((message, index) => {
                                                const previousMessage = messages[index-1];

                                                const showSenderInfo =
                                                    selectedConversation?.conversation_type == "group" &&
                                                    !(
                                                        previousMessage &&
                                                        Number(previousMessage.sender_employee_id) ===
                                                            Number(message.sender_employee_id)
                                                    );
                                              
                                                const isFirstInGroup = 
                                                    index == 0 ||
                                                    Number(previousMessage?.sender_employee_id) !=
                                                        Number(message.sender_employee_id);

                                                return (
                                                    <MessageBubble
                                                        key={message.id}
                                                        message={message}
                                                        conversationType={selectedConversation?.conversation_type}
                                                        showSenderInfo={showSenderInfo}
                                                        isFirstInGroup={isFirstInGroup}
                                                        currentId={employeeId}
                                                        onReply={() => startReply(message)}
                                                        onForward={() => setForwardingMessage(message)}
                                                        onEdit={() => startEdit(message)}
                                                        onDelete={() => requestDeleteCurrentMessage(message)}
                                                        onPin={togglePin}
                                                        onStar={toggleStar}
                                                        onReact={(emoji) => react(message,emoji)}
                                                        selectionMode={selectionMode}
                                                        selected={selectedMessageIds.includes(Number(message.id))}
                                                        onToggleSelect={toggleMessageSelection}
                                                        onOpenReactionDetails={openReactionDetails}
                                                        onPollUpdated={updatePollInMessages}
                                                        onViewPollVotes={setPollVotesMessageId}
                                                        onOpenFullPicker={openFullPicker}
                                                        onOpenMediaViewer={setMediaViewerAttachment}
                                                        menuOpen={activeMessageMenuId === message.id}
                                                        pickerOpen={activeReactionMessageId === message.id}
                                                        onToggleMenu={toggleMessageMenu}
                                                        onTogglePicker={toggleMessageReactionPicker}
                                                        searchQuery={conversationSearch}
                                                        highlighted={highlightedMessageId === Number(message.id)}
                                                    />
                                                );
                                            }
                                        )
                                    ) : (
                                        <div className="flex min-h-95 flex-col items-center justify-center text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-orange-500 shadow-sm">
                                                <Zap
                                                    size={27}
                                                />
                                            </div>

                                            <h3 className="mt-4 text-sm font-bold text-gray-800">
                                                Start the
                                                conversation
                                            </h3>

                                            <p className="mt-1 max-w-xs text-xs leading-5 text-gray-400">
                                                Send the
                                                first
                                                message
                                                and get
                                                the
                                                conversation
                                                moving.
                                            </p>
                                        </div>
                                    )}

                                    <div
                                        ref={
                                            messagesEndRef
                                        }
                                    />
                                </div>

                                {/* =================================================
                                   FULL EMOJI PICKER
                                ================================================= */}

                                {fullPickerMessage && createPortal(
                                    <>
                                        <div
                                            className="fixed inset-0 z-[90]"
                                            onClick={closeFullPicker}
                                        />

                                        <div
                                            className="fixed z-[100]"
                                            style={{
                                                top: fullPickerPosition?.top ?? -9999,
                                                left: fullPickerPosition?.left ?? -9999,
                                            }}
                                            data-chat-overlay-root
                                        >
                                            <FullReactionPicker
                                                pickerRef={fullPickerRef}
                                                maxHeight={fullPickerMaxHeight}
                                                onSelect={(emoji) => {
                                                    react(fullPickerMessage, emoji);
                                                    closeFullPicker();
                                                    setActiveReactionMessageId(null);
                                                }}
                                                onClose={closeFullPicker}
                                            />
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>

                            {/* =================================================
                               Q5 REPLY COMPOSER
                            ================================================= */}

                            {selectionMode ? (
                                <div className="flex min-h-[72px] items-center justify-between border-t border-gray-100 bg-white px-4 py-3 md:px-5">
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={exitSelectionMode} className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800" title="Close selection"><X size={21}/></button>
                                        <span className="text-sm font-semibold text-gray-700">{selectedMessageIds.length} selected</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button type="button" disabled={!selectedMessageIds.length} onClick={copySelectedMessages} className="rounded-xl p-2.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30" title="Copy"><Copy size={20}/></button>
                                        <button type="button" disabled={!selectedMessageIds.length} onClick={deleteSelectedMessages} className="rounded-xl p-2.5 text-gray-600 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" title="Delete"><Trash2 size={20}/></button>
                                        <button type="button" disabled={!selectedMessageIds.length} onClick={forwardSelectedMessage} className="rounded-xl p-2.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30" title="Forward"><Forward size={20}/></button>
                                    </div>
                                </div>
                            ) : composerLocked ? (
                                <div className="flex min-h-[72px] items-center justify-center border-t border-gray-100 bg-white px-4 py-3 text-center text-xs font-medium text-gray-500">
                                    Only admins can send messages in this group
                                </div>
                            ) : (
                            <div className="border-t border-gray-100 bg-white p-3 md:p-4">
                                {(replyingTo ||
                                    editingMessage) && (
                                    <div className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2.5 animate-chat-slide">
                                        <div
                                            className={`h-9 w-1 rounded-full ${
                                                editingMessage
                                                    ? "bg-violet-500"
                                                    : "bg-orange-500"
                                            }`}
                                        />

                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={`text-[10px] font-bold tracking-wider ${
                                                    editingMessage
                                                        ? "text-violet-500"
                                                        : "text-orange-500"
                                                }`}
                                            >
                                                {editingMessage
                                                        ? "Editing message"
                                                        : Number(replyingTo?.sender_employee_id) === Number(employeeId)
                                                            ? "You"
                                                            : `Replying to ${replyingTo?.sender_name || "Message"}`}
                                            </p>

                                            <p className="truncate text-xs font-medium text-gray-700">
                                                {editingMessage?.message ||
                                                    replyingTo?.message ||
                                                    ""}
                                            </p>
                                        </div>

                                        <button
                                            onClick={
                                                cancelComposerMode
                                            }
                                            className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-700"
                                            title="Cancel"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                )}

                                <div className=" flex w-full items-end gap-2">
                                    <div className="relative shrink-0" data-chat-overlay-root>
                                        <button
                                            type="button"
                                            disabled={attachmentUploadBusy}
                                            onClick={() => {
                                                setAttachmentMenuOpen((value) => !value);
                                                setComposerEmojiOpen(false);
                                            }}
                                            className={`mb-1 flex h-10 w-10 items-center justify-center rounded-xl transition ${attachmentMenuOpen ? "bg-orange-50 text-orange-500" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                                            title="Attachments"
                                            aria-label="Attachments"
                                        >
                                            <Plus size={19} />
                                        </button>

                                        {attachmentMenuOpen && (
                                            <div className="absolute bottom-12 left-0 z-[85] w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl animate-chat-pop">
                                                <button type="button" onClick={() => handleAttachmentChoice("image")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50">
                                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-500"><ImageIcon size={18}/></span>
                                                    <span><span className="block text-sm font-semibold text-gray-800">Photos & videos</span><span className="block text-[11px] text-gray-400">Choose from your device</span></span>
                                                </button>
                                                <button type="button" onClick={() => handleAttachmentChoice("file")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50">
                                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-500"><Paperclip size={18}/></span>
                                                    <span><span className="block text-sm font-semibold text-gray-800">Document</span><span className="block text-[11px] text-gray-400">PDF, Word, Excel and more</span></span>
                                                </button>
                                                {canCreatePoll && (
                                                    <button type="button" onClick={() => handleAttachmentChoice("poll")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50">
                                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500"><BarChart3 size={18}/></span>
                                                        <span><span className="block text-sm font-semibold text-gray-800">Poll</span><span className="block text-[11px] text-gray-400">Ask the group a question</span></span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <input ref={attachmentInputRef} type="file" className="hidden" multiple accept="image/*,video/*" onChange={handleAttachmentFile} />
                                        <input ref={documentInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={handleAttachmentFile} />
                                    </div>

                                    <div
                                        className={`relative flex min-h-12 flex-1 items-end rounded-2xl border bg-gray-50 px-3 py-2 transition-all ${
                                            editingMessage
                                                ? "border-violet-200 ring-4 ring-violet-50"
                                                : "border-gray-200 focus-within:border-orange-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-50"
                                        }`}
                                    >
                                        <textarea
                                            ref={
                                                composerRef
                                            }
                                            value={
                                                messageText
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handleComposerChange(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            onKeyDown={
                                                handleComposerKeyDown
                                            }
                                            rows={1}
                                            placeholder={
                                                editingMessage
                                                    ? "Update your message..."
                                                    : replyingTo
                                                      ? "Write a reply..."
                                                      : "Write a message..."
                                            }
                                            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400"
                                        />

                                        <div className="relative" data-chat-overlay-root>
                                            <button
                                                type="button"
                                                className={`mb-0.5 rounded-xl p-2 transition ${composerEmojiOpen ? "bg-orange-50 text-orange-500" : "text-gray-400 hover:bg-white hover:text-orange-500"}`}
                                                title="Emoji"
                                                aria-label="Emoji"
                                                onClick={() => {
                                                    setComposerEmojiOpen((value) => !value);
                                                    setAttachmentMenuOpen(false);
                                                }}
                                            >
                                                <Smile size={18} />
                                            </button>

                                            {composerEmojiOpen && (
                                                <div className="absolute bottom-[calc(100%+10px)] right-0 z-[1000]">
                                                    <FullReactionPicker
                                                        onSelect={handleComposerEmojiSelect}
                                                        onClose={() => setComposerEmojiOpen(false)}
                                                    />
                                                    <span className="pointer-events-none absolute -bottom-1.5 right-5 h-3 w-3 rotate-45 border-b border-r border-gray-200 bg-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={
                                            editingMessage
                                                ? editCurrentMessage
                                                : sendCurrentMessage
                                        }
                                        disabled={
                                            !messageText.trim() ||
                                            sending
                                        }
                                        className={`mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 ${
                                            editingMessage
                                                ? "bg-violet-600 shadow-violet-200 hover:bg-violet-700"
                                                : "bg-orange-500 shadow-orange-200 hover:bg-orange-600"
                                        }`}
                                    >
                                        {sending ? (
                                            <Loader2
                                                size={18}
                                                className="animate-spin"
                                            />
                                        ) : editingMessage ? (
                                            <Check
                                                size={18}
                                            />
                                        ) : (
                                            <Send
                                                size={18}
                                                className="-ml-0.5"
                                            />
                                        )}
                                    </button>
                                </div>

                                {/* Q9:
                                    Composer helper text intentionally removed.
                                */}
                            </div>
                            )}
                        </>
                    )}
            {/** ChatInfoPanel is rendered inside the Chat workspace so it cannot cover the global dashboard topbar. */}
            {groupInfoOpen && selectedConversation && (
                <ChatInfoPanel
                    onForwardMessages={openForwardFromInfo}
                    onMessagesDeleted={handleInfoMessagesDeleted}
                    conversation={selectedConversation}
                    participants={participants}
                    currentId={employeeId}
                    selectedDisplay={selectedDisplay}
                    onGroupUpdated={refreshConversationMeta}
                    employees={employees}
                    onClose={() => setGroupInfoOpen(false)}
                    onRefreshConversation={() => loadMessages(selectedConversation.id)}
                    onOpenConversation={async (conversationId, messageId = null) => {
                        const nextConversationId = Number(conversationId);
                        if (!Number.isInteger(nextConversationId) || nextConversationId <= 0) {
                            toast.error("Invalid conversation");
                            return;
                        }

                        setGroupInfoOpen(false);
                        setSelectedConversation(null);
                        setParticipants([]);
                        setMessages([]);
                        setPinnedMessages([]);
                        setActivePinnedIndex(0);
                        setHighlightedMessageId(null);
                        setMobileListOpen(false);
                        setStarredTarget(
                            messageId
                                ? {
                                      conversationId: nextConversationId,
                                      messageId: Number(messageId),
                                  }
                                : null
                        );

                        // Select immediately. This also works when the chat was
                        // previously deleted and is therefore absent from the sidebar.
                        setSelectedId(nextConversationId);

                        // Refresh the sidebar in the background. The selectedId effect
                        // independently loads the conversation and its messages.
                        try {
                            await loadConversations(nextConversationId);
                        } catch (error) {
                            console.error(
                                "Refresh conversations after opening chat:",
                                error
                            );
                        }
                    }}
                />
            )}

                </section>
            </div>

            {/* =====================================================
               MODALS
            ===================================================== */}

            {newChatOpen && (
                <NewChatModal
                    employees={employees}
                    currentId={employeeId}
                    onClose={() =>
                        setNewChatOpen(false)
                    }
                    onCreated={
                        handleConversationCreated
                    }
                />
            )}

            {newGroupOpen && (
                <NewGroupModal
                    employees={employees}
                    currentId={employeeId}
                    onClose={() =>
                        setNewGroupOpen(false)
                    }
                    onCreated={
                        handleConversationCreated
                    }
                />
            )}

            {chatAction && (
                <ChatActionModal
                    action={chatAction}
                    busy={chatActionBusy}
                    onClose={() => { if (!chatActionBusy) setChatAction(null); }}
                    onConfirm={chatAction === "clear" ? clearCurrentChat : deleteCurrentChat}
                />
            )}

            {messageDeleteConfirm && (
                <MessageDeleteModal
                    messages={messageDeleteConfirm}
                    currentId={employeeId}
                    busy={messageDeleteBusy}
                    onClose={() => {
                        if (!messageDeleteBusy) setMessageDeleteConfirm(null);
                    }}
                    onConfirm={(scope) =>
                        deleteMessagesWithScope(messageDeleteConfirm, scope)
                    }
                />
            )}

            {pinLimitConfirm && (
                <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-chat-fade">
                    <div className="w-full max-w-[500px] overflow-hidden rounded-[28px] bg-white shadow-2xl animate-chat-modal">
                        <div className="px-6 pb-5 pt-7">
                            <h3 className="text-[20px] font-medium tracking-tight text-gray-900">
                                Replace oldest pin?
                            </h3>

                            <p className="mt-5 text-sm leading-6 text-gray-700">
                                Your new pin will replace the oldest one.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 pb-5">
                            <button
                                type="button"
                                onClick={() => setPinLimitConfirm(null)}
                                className="rounded-2xl px-5 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    // This will call the replace-oldest pin operation.
                                    replaceOldestPin(pinLimitConfirm);
                                }}
                                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

           {reactionDetails && (() => {
    const detailsMessage = messages.find(
        (item) => Number(item.id) === Number(reactionDetails.messageId)
    );

    if (!detailsMessage) return null;

    return (
        <ReactionDetailsCard
            key={`${reactionDetails.messageId}-${reactionDetails.emoji}`}
            message={detailsMessage}
            initialEmoji={reactionDetails.emoji}
            anchorRect={reactionDetails.anchorRect}
            currentId={employeeId}
            boundaryRef={messagesViewportRef}
            onReact={react}
        />
    );
})()}
            {attachmentPreviewOpen && pendingAttachments.length > 0 && (
                <MediaComposer
                    initialFiles={pendingAttachments}
                    busy={attachmentUploadBusy}
                    EmojiPicker={FullReactionPicker}
                    container={chatWorkspaceRef.current}
                    onClose={() => {
                        setAttachmentPreviewOpen(false);
                        setPendingAttachments([]);
                        setAttachmentCaption("");
                    }}
                    onSend={({ files, caption }) => uploadSelectedAttachments(files, caption)}
                />
            )}

            {pollComposerOpen && (
                <PollComposer
                    question={pollQuestion}
                    setQuestion={setPollQuestion}
                    options={pollOptions}
                    setOptions={setPollOptions}
                    allowMultiple={pollAllowMultiple}
                    setAllowMultiple={setPollAllowMultiple}
                    allowVoteChanges={pollAllowVoteChanges}
                    setAllowVoteChanges={setPollAllowVoteChanges}
                    busy={pollBusy}
                    onSubmit={submitPoll}
                    onClose={() => setPollComposerOpen(false)}
                    EmojiPicker={FullReactionPicker}
                />
            )}

            {pollVotesMessageId && (() => {
                const pollMessage = messages.find((m) => Number(m.id) === Number(pollVotesMessageId));
                return pollMessage?.poll ? (
                    <PollVotesPanel
                        message={pollMessage}
                        currentId={employeeId}
                        onPollUpdated={updatePollInMessages}
                        onClose={() => setPollVotesMessageId(null)}
                        boundaryRef={chatWorkspaceRef}
                    />
                ) : null;
            })()}

            {mediaViewerAttachment && (() => {
                const clicked = mediaViewerAttachment;
                const clickedKind = kindOf(clicked.file_type, clicked.file_name);
                const mediaList =
                    clickedKind === "pdf"
                        ? [clicked]
                        : messages.flatMap((m) =>
                              m.deleted_at
                                  ? []
                                  : (m.attachments || []).filter(
                                        (a) =>
                                            ["image", "video"].includes(kindOf(a.file_type, a.file_name)) &&
                                            hasDownloaded(
                                                employeeId,
                                                a.id,
                                                Number(m.sender_employee_id) === Number(employeeId)
                                            )
                                    )
                          );
                return (
                    <MediaLightbox
                        items={mediaList.length ? mediaList : [clicked]}
                        startId={clicked.id}
                        currentId={employeeId}
                        onClose={() => setMediaViewerAttachment(null)}
                    />
                );
            })()}

            {forwardingMessage && (
                <ForwardModal
                    conversations={
                        conversations
                    }
                    currentConversationId={
                        selectedId
                    }
                    onClose={() => {
                        forwardSuccessRef.current = null;
                        setForwardingMessage(null);
                    }}
                    onForward={forward}
                />
            )}
        </div>
    );
}

export default Chat;