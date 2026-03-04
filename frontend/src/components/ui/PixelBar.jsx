import React from 'react';

export default function PixelBar({ value, color, icon, label, showNumber }) {
    const fillWidth = Math.max(0, Math.min(100, value * 100));

    return (
        <div className="pixel-bar-container">
            {icon && <div className="bar-icon">{icon}</div>}
            <div className="pixel-bar-bg" style={{ borderColor: '#fff' }}>
                <div
                    className="pixel-bar-fill"
                    style={{ width: `${fillWidth}%`, backgroundColor: color }}
                />
                {label && <span className="bar-label">{label}</span>}
                {showNumber !== undefined && <span className="bar-number">{showNumber}</span>}
            </div>
        </div>
    );
}
