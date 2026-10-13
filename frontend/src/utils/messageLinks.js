/**
 * messageLinks.js
 *
 * Frontend component/module for HRMS application
 */

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

function trimUrlPunctuation(value) {
    let url = String(value || "");
    let trailing = "";

    while (/[),.!?:;}\]»”’]+$/.test(url)) {
        trailing = url.slice(-1) + trailing;
        url = url.slice(0, -1);
    }

    return { url, trailing };
}

export function extractMessageLinks(text = "") {
    const source = String(text ?? "");
    const links = [];
    const seen = new Set();

    source.replace(URL_PATTERN, (raw, offset) => {
        const { url } = trimUrlPunctuation(raw);
        if (!url) return raw;

        const normalized = normalizeMessageUrl(url);
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            links.push({
                url,
                href: normalized,
                index: offset,
            });
        }
        return raw;
    });

    return links;
}

export function normalizeMessageUrl(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;

    try {
        const parsed = new URL(candidate);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

export function splitMessageTextLinks(text = "") {
    const source = String(text ?? "");
    const parts = [];
    let cursor = 0;

    source.replace(URL_PATTERN, (raw, offset) => {
        const { url, trailing } = trimUrlPunctuation(raw);
        if (!url) return raw;

        if (offset > cursor) {
            parts.push({ type: "text", value: source.slice(cursor, offset) });
        }

        const href = normalizeMessageUrl(url);
        if (href) {
            parts.push({ type: "link", value: url, href });
            if (trailing) {
                parts.push({ type: "text", value: trailing });
            }
        } else {
            parts.push({ type: "text", value: raw });
        }

        cursor = offset + raw.length;
        return raw;
    });

    if (cursor < source.length) {
        parts.push({ type: "text", value: source.slice(cursor) });
    }

    return parts;
}
