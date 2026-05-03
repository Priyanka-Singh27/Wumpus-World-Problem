import React from 'react';

export default function PixelBar({ value, color, icon, label, showNumber }) {
    const fillWidth = Math.max(0, Math.min(100, value * 100));

    return (
        <div className="pixel-bar-container">
            {icon && <div className="bar-icon" style={{ fontSize: 12, marginRight: 4 }}>{icon}</div>}
            <div className="pixel-bar-bg">
                <div
                    className="pixel-bar-fill"
                    style={{ 
                        width: `${fillWidth}%`, 
                        backgroundColor: color,
                        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)`
                    }}
                />
                {label && <span className="bar-label">{label}</span>}
                {showNumber !== undefined && <span className="bar-number">{showNumber}</span>}
            </div>
        </div>
    );
}
