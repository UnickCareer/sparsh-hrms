// src/pages/settings/ChatSettings.jsx

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

const STORAGE_KEY = "hrms_chat_settings";

const DEFAULT_SETTINGS = {
    readReceipts: true,
    notifications: true,
    soundAlerts: false,
    showOnlineStatus: true,
};


// ============================================================
// TOGGLE ROW
// ============================================================

function ToggleRow({
    label,
    description,
    value,
    onChange,
}) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">

            <div className="pr-4">
                <p className="text-sm font-medium text-gray-800">
                    {label}
                </p>

                {description && (
                    <p className="text-xs text-gray-400 mt-0.5">
                        {description}
                    </p>
                )}
            </div>

            <button
                type="button"
                onClick={() => onChange(!value)}
                aria-label={label}
                aria-pressed={value}
                className={`
                    w-10
                    h-5.5
                    rounded-full
                    transition-colors
                    duration-200
                    relative
                    shrink-0
                    focus:outline-none
                    focus:ring-2
                    focus:ring-orange-200

                    ${
                        value
                            ? "bg-orange-500"
                            : "bg-gray-300"
                    }
                `}
            >
                <span
                    className={`
                        absolute
                        top-0.5
                        w-4
                        h-4
                        bg-white
                        rounded-full
                        shadow-sm
                        transition-transform
                        duration-200

                        ${
                            value
                                ? "translate-x-5"
                                : "translate-x-0.5"
                        }
                    `}
                />
            </button>

        </div>
    );
}


// ============================================================
// COMPONENT
// ============================================================

function ChatSettings() {

    const [settings, setSettings] =
        useState(() => {

            try {

                const saved =
                    localStorage.getItem(
                        STORAGE_KEY
                    );

                if (!saved) {
                    return DEFAULT_SETTINGS;
                }

                return {
                    ...DEFAULT_SETTINGS,
                    ...JSON.parse(saved),
                };

            } catch (error) {

                console.error(
                    "Failed to load chat settings:",
                    error
                );

                return DEFAULT_SETTINGS;
            }
        });


    // ========================================================
    // SAVE SETTINGS
    // ========================================================

    useEffect(() => {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(settings)
            );

        } catch (error) {

            console.error(
                "Failed to save chat settings:",
                error
            );

        }

    }, [settings]);


    // ========================================================
    // UPDATE ONE SETTING
    // ========================================================

    function updateSetting(
        key,
        value
    ) {

        setSettings((prev) => ({
            ...prev,
            [key]: value,
        }));

    }


    return (

        <div>

            {/* ==================================================
                HEADER
            ================================================== */}

            <h1
                className="
                    flex
                    items-center
                    gap-2
                    text-2xl
                    font-bold
                    text-gray-900
                    mb-6
                "
            >
                <MessageSquare size={22} />

                Chat Settings
            </h1>


            {/* ==================================================
                SETTINGS CARD
            ================================================== */}

            <div
                className="
                    bg-white
                    rounded-xl
                    shadow-sm
                    p-5
                    max-w-lg
                "
            >

                <ToggleRow
                    label="Read receipts"
                    description="Let others see when you've read their messages"
                    value={settings.readReceipts}
                    onChange={(value) =>
                        updateSetting(
                            "readReceipts",
                            value
                        )
                    }
                />


                <ToggleRow
                    label="Notifications"
                    description="Get notified about new messages"
                    value={settings.notifications}
                    onChange={(value) =>
                        updateSetting(
                            "notifications",
                            value
                        )
                    }
                />


                <ToggleRow
                    label="Sound alerts"
                    description="Play a sound for incoming messages"
                    value={settings.soundAlerts}
                    onChange={(value) =>
                        updateSetting(
                            "soundAlerts",
                            value
                        )
                    }
                />


                <ToggleRow
                    label="Show online status"
                    description="Let colleagues see when you're active"
                    value={settings.showOnlineStatus}
                    onChange={(value) =>
                        updateSetting(
                            "showOnlineStatus",
                            value
                        )
                    }
                />

            </div>

        </div>
    );
}


export default ChatSettings;