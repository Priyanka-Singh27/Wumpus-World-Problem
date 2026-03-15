import React from 'react';

/* ── Inline SVG sprites — no CSS box-shadow, no image files ───────────── */

export const SpriteAgent = ({ direction, isDead }) => {
    if (isDead) return <SpriteSkull />;
    // flip horizontally when facing west
    const flipX = direction === 'WEST' ? -1 : 1;
    return (
        <svg
            width="48" height="96"
            viewBox="0 0 16 32"
            style={{ imageRendering: 'pixelated', transform: `scaleX(${flipX})` }}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* --- Hair (Green, textured) --- */}
            {/* Top row */}
            <rect x="5" y="2" width="6" height="1" fill="#00b33c" />
            <rect x="6" y="2" width="2" height="1" fill="#00882d" />
            {/* Row 2 */}
            <rect x="4" y="3" width="8" height="1" fill="#00b33c" />
            <rect x="5" y="3" width="2" height="1" fill="#00e64d" />
            <rect x="8" y="3" width="2" height="1" fill="#00882d" />
            {/* Row 3 */}
            <rect x="3" y="4" width="10" height="1" fill="#00b33c" />
            <rect x="4" y="4" width="2" height="1" fill="#00882d" />
            <rect x="7" y="4" width="2" height="1" fill="#00e64d" />
            <rect x="10" y="4" width="2" height="1" fill="#00882d" />
            {/* Row 4 */}
            <rect x="2" y="5" width="12" height="1" fill="#00e64d" />
            <rect x="3" y="5" width="2" height="1" fill="#00b33c" />
            <rect x="6" y="5" width="2" height="1" fill="#00882d" />
            <rect x="9" y="5" width="2" height="1" fill="#00b33c" />
            {/* Row 5 */}
            <rect x="2" y="6" width="12" height="1" fill="#00b33c" />
            <rect x="4" y="6" width="2" height="1" fill="#00882d" />
            <rect x="8" y="6" width="2" height="1" fill="#00e64d" />
            {/* Row 6 */}
            <rect x="1" y="7" width="14" height="1" fill="#00b33c" />
            <rect x="2" y="7" width="1" height="1" fill="#00882d" />
            <rect x="12" y="7" width="2" height="1" fill="#00882d" />
            {/* Row 7 */}
            <rect x="1" y="8" width="13" height="1" fill="#00e64d" />
            <rect x="3" y="8" width="2" height="1" fill="#00882d" />
            <rect x="11" y="8" width="2" height="1" fill="#00b33c" />

            {/* --- Face/Skin Base (#e88e73) & Shading (#b85c4a) --- */}
            {/* Forehead under hair */}
            <rect x="4" y="9" width="8" height="1" fill="#00882d" />
            {/* Face upper */}
            <rect x="4" y="10" width="8" height="1" fill="#e88e73" />
            <rect x="3" y="11" width="10" height="3" fill="#e88e73" />
            {/* Eyes & Hair Overhang */}
            <rect x="4" y="10" width="1" height="2" fill="#222233" /> {/* Left hair strand */}
            <rect x="11" y="10" width="1" height="2" fill="#222233" /> {/* Right hair strand */}
            <rect x="5" y="11" width="1" height="1" fill="#4400aa" /> {/* Left eye */}
            <rect x="10" y="11" width="1" height="1" fill="#4400aa" /> {/* Right eye */}
            {/* Lower Face & Neck */}
            <rect x="4" y="14" width="8" height="1" fill="#e88e73" />
            <rect x="5" y="15" width="6" height="1" fill="#e88e73" />
            <rect x="5" y="14" width="1" height="2" fill="#b85c4a" /> {/* Left cheek shade */}
            <rect x="10" y="14" width="1" height="2" fill="#b85c4a" /> {/* Right cheek shade */}
            <rect x="6" y="16" width="4" height="2" fill="#e88e73" /> {/* Neck */}
            <rect x="6" y="17" width="4" height="1" fill="#b85c4a" /> {/* Neck shadow */}

            {/* --- Body/Shirt (Orange #e64d00) & Vest (Blue-purple #4d33cc, #331199) --- */}
            {/* Shoulders */}
            <rect x="3" y="17" width="3" height="1" fill="#4d33cc" />
            <rect x="10" y="17" width="3" height="1" fill="#4d33cc" />
            {/* Chest/Arms */}
            <rect x="2" y="18" width="12" height="7" fill="#4d33cc" /> {/* Base vest */}
            {/* Vest detailing */}
            <rect x="2" y="18" width="2" height="7" fill="#e64d00" /> {/* Left orange sleeve */}
            <rect x="1" y="20" width="1" height="4" fill="#cc3300" /> {/* Left sleeve edge */}
            <rect x="12" y="18" width="2" height="7" fill="#e64d00" /> {/* Right orange sleeve */}
            <rect x="14" y="20" width="1" height="4" fill="#cc3300" /> {/* Right sleeve edge */}

            {/* Vest split (center) */}
            <rect x="7" y="18" width="2" height="7" fill="#221144" /> {/* Vest zipper/center line */}
            <rect x="7" y="18" width="1" height="7" fill="#331199" />

            {/* Vest pockets */}
            <rect x="5" y="23" width="2" height="1" fill="#221144" />
            <rect x="5" y="24" width="1" height="1" fill="#221144" />
            <rect x="9" y="23" width="2" height="1" fill="#221144" />
            <rect x="10" y="24" width="1" height="1" fill="#221144" />

            {/* Hands */}
            <rect x="1" y="24" width="3" height="2" fill="#e88e73" />
            <rect x="12" y="24" width="3" height="2" fill="#e88e73" />

            {/* --- Pants (Orange #e64d00 / #cc3300) --- */}
            <rect x="4" y="25" width="8" height="5" fill="#e64d00" />
            <rect x="7" y="25" width="2" height="2" fill="#cc3300" /> {/* Crotch shadow */}
            <rect x="7" y="27" width="2" height="3" fill="#8b3a1a" /> {/* Leg gap (background showing through) */}
            {/* Darker orange outlines for pant legs */}
            <rect x="4" y="25" width="1" height="5" fill="#cc3300" />
            <rect x="11" y="25" width="1" height="5" fill="#cc3300" />

            {/* --- Shoes (Green #00cc44) --- */}
            <rect x="4" y="30" width="3" height="2" fill="#00cc44" />
            <rect x="5" y="30" width="2" height="1" fill="#00ff55" /> {/* Shoe highlight */}
            <rect x="4" y="31" width="3" height="1" fill="#006622" /> {/* Shoe sole */}

            <rect x="9" y="30" width="3" height="2" fill="#00cc44" />
            <rect x="9" y="30" width="2" height="1" fill="#00ff55" />
            <rect x="9" y="31" width="3" height="1" fill="#006622" />
        </svg>
    );
};

export const SpriteWumpus = () => (
    <svg
        width="48" height="64"
        viewBox="0 0 12 16"
        style={{ imageRendering: 'pixelated' }}
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* skull head */}
        <rect x="3" y="0" width="6" height="1" fill="#e8e0d0" />
        <rect x="2" y="1" width="8" height="5" fill="#e8e0d0" />
        <rect x="1" y="2" width="1" height="3" fill="#e8e0d0" />
        <rect x="10" y="2" width="1" height="3" fill="#e8e0d0" />
        {/* eye sockets */}
        <rect x="2" y="2" width="3" height="3" fill="#1a1010" />
        <rect x="7" y="2" width="3" height="3" fill="#1a1010" />
        {/* nose */}
        <rect x="5" y="5" width="2" height="1" fill="#c0b090" />
        {/* teeth */}
        <rect x="3" y="6" width="1" height="1" fill="#e8e0d0" />
        <rect x="5" y="6" width="1" height="1" fill="#e8e0d0" />
        <rect x="7" y="6" width="1" height="1" fill="#e8e0d0" />
        <rect x="9" y="6" width="1" height="1" fill="#e8e0d0" />
        <rect x="2" y="6" width="8" height="1" fill="#5a2010" />
        {/* body */}
        <rect x="2" y="7" width="8" height="5" fill="#8b3a1a" />
        <rect x="1" y="8" width="1" height="3" fill="#8b3a1a" />
        <rect x="10" y="8" width="1" height="3" fill="#8b3a1a" />
        {/* fur texture */}
        <rect x="3" y="8" width="1" height="1" fill="#6b2a0a" />
        <rect x="6" y="9" width="1" height="1" fill="#6b2a0a" />
        <rect x="9" y="8" width="1" height="1" fill="#6b2a0a" />
        {/* legs */}
        <rect x="3" y="12" width="2" height="4" fill="#6b2a0a" />
        <rect x="7" y="12" width="2" height="4" fill="#6b2a0a" />
        {/* claws */}
        <rect x="2" y="15" width="1" height="1" fill="#ccaa66" />
        <rect x="4" y="15" width="1" height="1" fill="#ccaa66" />
        <rect x="7" y="15" width="1" height="1" fill="#ccaa66" />
        <rect x="9" y="15" width="1" height="1" fill="#ccaa66" />
    </svg>
);

export const SpriteGold = () => (
    <svg
        width="40" height="28"
        viewBox="0 0 10 7"
        style={{ imageRendering: 'pixelated' }}
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* back ingot */}
        <rect x="3" y="0" width="7" height="4" fill="#b8860b" />
        <rect x="3" y="0" width="7" height="1" fill="#ffd700" />
        <rect x="3" y="0" width="1" height="4" fill="#ffd700" />
        <rect x="4" y="1" width="5" height="1" fill="#ffec6e" />
        {/* front ingot */}
        <rect x="0" y="2" width="7" height="4" fill="#cc9900" />
        <rect x="0" y="2" width="7" height="1" fill="#ffd700" />
        <rect x="0" y="2" width="1" height="4" fill="#ffd700" />
        <rect x="1" y="3" width="4" height="1" fill="#ffec6e" />
        <rect x="1" y="3" width="1" height="2" fill="#ffe44d" />
    </svg>
);

export const SpriteSkull = () => (
    <svg
        width="32" height="32"
        viewBox="0 0 8 8"
        style={{ imageRendering: 'pixelated', opacity: 0.85 }}
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect x="2" y="0" width="4" height="1" fill="#e0d0c0" />
        <rect x="1" y="1" width="6" height="4" fill="#e0d0c0" />
        <rect x="1" y="2" width="2" height="2" fill="#2a1a0a" />
        <rect x="5" y="2" width="2" height="2" fill="#2a1a0a" />
        <rect x="3" y="3" width="1" height="1" fill="#c0b090" />
        <rect x="2" y="5" width="4" height="1" fill="#e0d0c0" />
        <rect x="2" y="6" width="1" height="2" fill="#e0d0c0" />
        <rect x="4" y="6" width="1" height="2" fill="#e0d0c0" />
    </svg>
);

/* ── Header icons (kept simple for the new chrome) ─────────────────────── */
export const HeartIcon = ({ full }) => (
    <span style={{ fontSize: '16px', color: full ? '#e63946' : '#999', lineHeight: 1 }}>♥</span>
);

export const HourglassIcon = () => <span style={{ fontSize: '14px' }}>⏱</span>;
export const FootstepIcon = () => <span style={{ fontSize: '14px' }}>👣</span>;
