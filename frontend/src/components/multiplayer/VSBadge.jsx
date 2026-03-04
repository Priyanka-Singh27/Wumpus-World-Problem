import React from 'react';

export default function VSBadge() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            color: 'var(--gold)',
            textShadow: '2px 2px 0 #0f0, -1px -1px 0 #000, 1px -1px 0 #f00, -2px 2px 0 #000, 2px 2px 0 #000',
            fontSize: '24px',
            zIndex: 10,
            background: 'var(--bg)',
            borderLeft: '2px solid var(--border)',
            borderRight: '2px solid var(--border)'
        }}>
            VS
        </div>
    );
}
