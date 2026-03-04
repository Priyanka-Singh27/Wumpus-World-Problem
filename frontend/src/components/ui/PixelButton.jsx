import React from 'react';

export default function PixelButton({ label, color = 'navy', onClick, disabled }) {
    const baseColor = `var(--btn-${color})`;
    return (
        <button
            className={`pixel-btn ${disabled ? 'disabled' : ''}`}
            style={{ '--btn-color': baseColor }}
            onClick={onClick}
            disabled={disabled}
        >
            {label}
        </button>
    );
}
