import React from 'react';

export default function VSBadge() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            color: 'var(--gold)',
            textShadow: '4px 4px 0 #000, 0 0 10px rgba(255,215,0,0.4)',
            fontSize: '28px',
            zIndex: 10,
            background: 'var(--hud-bg)',
            borderLeft: '4px solid var(--border-pixel)',
            borderRight: '4px solid var(--border-pixel)',
            fontFamily: "'Press Start 2P', monospace",
            position: 'relative',
            boxShadow: '0 0 15px rgba(0,0,0,0.5)'
        }}>
            {/* Corner pixel dots */}
            <div style={{ position: 'absolute', top: 6, left: 6, width: 4, height: 4, background: '#fff', opacity: 0.2 }} />
            <div style={{ position: 'absolute', top: 6, right: 6, width: 4, height: 4, background: '#fff', opacity: 0.2 }} />
            <div style={{ position: 'absolute', bottom: 6, left: 6, width: 4, height: 4, background: '#fff', opacity: 0.2 }} />
            <div style={{ position: 'absolute', bottom: 6, right: 6, width: 4, height: 4, background: '#fff', opacity: 0.2 }} />
            
            <span style={{ transform: 'rotate(-5deg)' }}>V</span>
            <span style={{ transform: 'rotate(5deg)', marginLeft: -4 }}>S</span>
        </div>
    );
}
