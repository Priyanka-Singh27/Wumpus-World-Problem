import React, { useState } from 'react';
import BrainPanel from '../panels/BrainPanel';
import LogPanel from '../panels/LogPanel';
import MetricsPanel from '../panels/MetricsPanel';

export default function RightPanel() {
    const [activeTab, setActiveTab] = useState('BRAIN');

    const tabs = [
        { key: 'BRAIN', icon: '🧠', label: 'BRAIN' },
        { key: 'METRICS', icon: '📊', label: 'STATS' },
        { key: 'LOG', icon: '📜', label: 'LOG' },
    ];

    return (
        <div className="right-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="tab-bar">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <span style={{ fontSize: 16 }}>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>
            <div style={{
                flexGrow: 1,
                overflow: 'hidden',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--panel-bg)',
            }}>
                {activeTab === 'BRAIN' && <BrainPanel />}
                {activeTab === 'METRICS' && <MetricsPanel />}
                {activeTab === 'LOG' && <LogPanel />}
            </div>
        </div>
    );
}
