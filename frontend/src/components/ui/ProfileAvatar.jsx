/**
 * ProfileAvatar.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/components/ui/ProfileAvatar.jsx
function ProfileAvatar({ fullName, size = "w-9 h-9", textSize = "text-sm" }) {
    // Correctly split the string, target the first letter of the first word, and capitalise it
    const initial = fullName && fullName.trim() 
        ? fullName.split(" ")[0][0].toUpperCase() 
        : "U"; 

    return (
        <div
            className={`${size} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 ring-2 ring-white flex items-center justify-center text-white font-bold tracking-wide shadow-sm ${textSize}`}
        >
            {initial}
        </div>
    );
}

export default ProfileAvatar;
