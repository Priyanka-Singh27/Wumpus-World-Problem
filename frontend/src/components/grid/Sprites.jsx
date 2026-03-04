import React from 'react';

/* ── Inline SVG sprites — no CSS box-shadow, no image files ───────────── */

export const SpriteAgent = ({ direction, isDead }) => {
    if (isDead) return <SpriteSkull />;
    // flip horizontally when facing west
    const flipX = direction === 'WEST' ? -1 : 1;
    return (
        <svg
            width="48" height="64"
            viewBox="0 0 12 16"
            style={{ imageRendering: 'pixelated', transform: `scaleX(${flipX})` }}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* hair */}
            <rect x="3" y="0" width="6" height="1" fill="#5c3317" />
            <rect x="2" y="1" width="8" height="3" fill="#7a4520" />
            <rect x="1" y="2" width="1" height="2" fill="#7a4520" />
            <rect x="10" y="2" width="1" height="2" fill="#7a4520" />
            {/* face */}
            <rect x="2" y="4" width="8" height="5" fill="#f4c07a" />
            <rect x="3" y="5" width="2" height="2" fill="#2a1a0a" />
            <rect x="7" y="5" width="2" height="2" fill="#2a1a0a" />
            <rect x="4" y="8" width="4" height="1" fill="#d4784a" />
            {/* shirt */}
            <rect x="2" y="9" width="8" height="3" fill="#e8e8e8" />
            <rect x="0" y="9" width="2" height="4" fill="#e8e8e8" />
            <rect x="10" y="9" width="2" height="4" fill="#e8e8e8" />
            {/* belt */}
            <rect x="2" y="12" width="8" height="1" fill="#7a4520" />
            {/* pants */}
            <rect x="2" y="13" width="4" height="3" fill="#3a3a7a" />
            <rect x="6" y="13" width="4" height="3" fill="#3a3a7a" />
            {/* boots */}
            <rect x="2" y="15" width="3" height="1" fill="#2a1a0a" />
            <rect x="7" y="15" width="3" height="1" fill="#2a1a0a" />
            {/* sword hint on right */}
            <rect x="11" y="8" width="1" height="5" fill="#aaaaaa" />
            <rect x="10" y="9" width="1" height="1" fill="#888888" />
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
