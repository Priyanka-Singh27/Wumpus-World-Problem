import React, { useState } from 'react';
import BrainPanel from '../panels/BrainPanel';
import LogPanel from '../panels/LogPanel';
import MetricsPanel from '../panels/MetricsPanel';

export default function RightPanel() {
    const [activeTab, setActiveTab] = useState('BRAIN');

    return (
        <div className="right-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="tab-bar">
                {['BRAIN', 'METRICS', 'LOG'].map(tab => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            <div style={{ flexGrow: 1, overflow: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'BRAIN' && <BrainPanel />}
                {activeTab === 'METRICS' && <MetricsPanel />}
                {activeTab === 'LOG' && <LogPanel />}
            </div>
        </div>
    );
}
