import React, { useRef, useEffect } from 'react';
import './CRTLog.css';

export default function CRTLog({ lines = [], maxLines = 500 }) {
    const logRef = useRef(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [lines]);

    const displayLines = lines.slice(-maxLines);

    return (
        <div className="crt-container">
            <div className="crt-screen" ref={logRef}>
                {displayLines.map((line, i) => (
                    <div key={i} className="crt-line">{line}</div>
                ))}
                <div className="crt-line">
                    <span className="crt-cursor">█</span>
                </div>
            </div>
        </div>
    );
}
