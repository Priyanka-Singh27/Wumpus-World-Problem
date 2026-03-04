import React, { useState, useRef, useEffect } from 'react';

export default function PixelDropdown({ options, selected, onChange, label }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function clickOut(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', clickOut);
        return () => document.removeEventListener('mousedown', clickOut);
    }, []);

    const selectedOption = options.find(o => o.value === selected);

    return (
        <div className="pixel-dropdown" ref={ref}>
            <div className="dropdown-trigger" onClick={() => setOpen(!open)}>
                {label}: {selectedOption?.label} ▾
            </div>
            {open && (
                <div className="dropdown-list">
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            className={`dropdown-item ${opt.value === selected ? 'selected' : ''}`}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
