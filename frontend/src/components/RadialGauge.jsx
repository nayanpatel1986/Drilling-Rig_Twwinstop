import React from 'react';

/**
 * Reusable radial gauge component.
 * Props:
 *   value       - current value (number)
 *   min         - minimum value (default 0)
 *   max         - maximum value
 *   majorStep   - interval for major tick marks with labels
 *   minorStep   - interval for minor tick marks
 *   label       - gauge title (e.g. "HOOK LOAD")
 *   unit        - unit string (e.g. "ton")
 *   size        - 'sm' | 'md' | 'lg'  (default 'md')
 *   subValue    - optional secondary value to display
 *   subLabel    - label for the secondary value
 *   subUnit     - unit for the secondary value
 */
const RadialGauge = ({
    value = 0,
    min = 0,
    max = 100,
    majorStep = 10,
    minorStep = 5,
    label = '',
    unit = '',
    size = 'md',
    subValue,
    subLabel,
    subUnit,
    subValues,  // array of {value, label} for multiple sub-displays
}) => {
    const cx = 150, cy = 150, r = 120;
    const startAngle = 225;
    const totalSweep = 270;
    const clamped = Math.min(max, Math.max(min, value));

    const valToAngle = (v) => startAngle - ((v - min) / (max - min)) * totalSweep;

    const toXY = (deg, radius) => {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + Math.cos(rad) * radius, y: cy - Math.sin(rad) * radius };
    };

    const arcPath = (sDeg, eDeg, radius) => {
        const s = toXY(sDeg, radius);
        const e = toXY(eDeg, radius);
        const sweep = sDeg - eDeg;
        const large = sweep > 180 ? 1 : 0;
        return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
    };

    const endAngle = startAngle - totalSweep;
    const needleAngle = valToAngle(clamped);

    // Color thresholds at 50% and 75% of range
    const mid = min + (max - min) * 0.5;
    const high = min + (max - min) * 0.75;
    const getColor = (v) => v > high ? '#EF4444' : v > mid ? '#F59E0B' : '#22D3EE';

    // Ticks
    const majors = [];
    const minors = [];
    for (let v = min; v <= max; v += minorStep) {
        const angle = valToAngle(v);
        const isMajor = (v - min) % majorStep === 0;
        const innerR = isMajor ? r - 20 : r - 12;
        const p1 = toXY(angle, innerR);
        const p2 = toXY(angle, r - 2);
        if (isMajor) majors.push({ v, angle, p1, p2 });
        else minors.push({ v, angle, p1, p2 });
    }

    // Needle
    const tip = toXY(needleAngle, r - 28);
    const b1 = toXY(needleAngle + 90, 5);
    const b2 = toXY(needleAngle - 90, 5);

    const hasSubValue = subValue !== undefined && subLabel;
    const hasSubValues = subValues && subValues.length > 0;
    const viewH = hasSubValues ? 360 : hasSubValue ? 260 : 240;

    const sizeClass = size === 'lg' ? 'max-w-[320px]' : size === 'sm' ? 'max-w-[200px]' : 'max-w-[260px]';

    // Colors for SPM sub-values
    const spmColors = ['#FFFFFF', '#22C55E', '#F59E0B'];

    return (
        <div className="flex flex-col items-center">
            <svg viewBox={`0 0 300 ${viewH}`} width="100%" height="100%" className={sizeClass}>
                {/* Background track */}
                <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="#1E293B" strokeWidth="22" strokeLinecap="round" />

                {/* Color zone arcs */}
                <path d={arcPath(startAngle, valToAngle(mid), r)} fill="none" stroke="#22D3EE" strokeWidth="6" opacity="0.25" strokeLinecap="round" />
                <path d={arcPath(valToAngle(mid), valToAngle(high), r)} fill="none" stroke="#F59E0B" strokeWidth="6" opacity="0.25" strokeLinecap="round" />
                <path d={arcPath(valToAngle(high), endAngle, r)} fill="none" stroke="#EF4444" strokeWidth="6" opacity="0.25" strokeLinecap="round" />

                {/* Active arc */}
                {clamped > min && (
                    <path d={arcPath(startAngle, needleAngle, r)} fill="none" stroke={getColor(clamped)} strokeWidth="6" strokeLinecap="round" />
                )}

                {/* Minor ticks */}
                {minors.map((t, i) => (
                    <line key={i} x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y} stroke="#4B5563" strokeWidth="1" />
                ))}

                {/* Major ticks + labels */}
                {majors.map((t, i) => (
                    <g key={i}>
                        <line x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y} stroke="#9CA3AF" strokeWidth="2.5" />
                        <text
                            x={toXY(t.angle, r - 32).x} y={toXY(t.angle, r - 32).y}
                            textAnchor="middle" dominantBaseline="central"
                            fill="#9CA3AF" fontSize="12" fontWeight="bold" fontFamily="monospace"
                        >
                            {t.v}
                        </text>
                    </g>
                ))}

                {/* Label at top */}
                {label && (
                    <text x={cx} y={cy - 45} textAnchor="middle" fill="#6B7280" fontSize="14" fontWeight="bold" letterSpacing="1">
                        {label}
                    </text>
                )}

                {/* Needle */}
                <polygon points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`} fill={getColor(clamped)} />
                <circle cx={cx} cy={cy} r="7" fill="#1E293B" stroke="#6B7280" strokeWidth="2" />
                <circle cx={cx} cy={cy} r="3" fill="#9CA3AF" />

                {/* Value display */}
                <text x={cx} y={cy + 35} textAnchor="middle" fill="white" fontSize="42" fontWeight="bold" fontFamily="monospace">
                    {Number.isInteger(clamped) ? clamped : clamped.toFixed(1)}
                </text>
                <text x={cx} y={cy + 55} textAnchor="middle" fill="#6B7280" fontSize="14" fontWeight="bold">
                    {unit}
                </text>

                {/* Sub value */}
                {hasSubValue && (
                    <>
                        <text x={cx} y={cy + 75} textAnchor="middle" fill="#F59E0B" fontSize="22" fontWeight="bold" fontFamily="monospace">
                            {typeof subValue === 'number' ? subValue.toFixed(1) : subValue}
                        </text>
                        <text x={cx} y={cy + 92} textAnchor="middle" fill="#6B7280" fontSize="12" fontWeight="bold">
                            {subLabel}{subUnit ? ` (${subUnit})` : ''}
                        </text>
                    </>
                )}

                {/* MUD PUMPS style sub-values: SPM1 / SPM2 / SPM3 with colors + STROKES */}
                {hasSubValues && !hasSubValue && (
                    <>
                        {/* SPM labels row */}
                        {subValues.map((sv, idx) => {
                            const cols = subValues.length;
                            // Widen the allotted column space for each SPM value so they sit further apart
                            const colW = 280 / cols;
                            const xPos = cx - 140 + colW * idx + colW / 2;
                            const color = spmColors[idx] || '#FFFFFF';
                            return (
                                <g key={idx}>
                                    <text x={xPos} y={cy + 94} textAnchor="middle" fill="#6B7280" fontSize="14" fontWeight="bold" letterSpacing="0.5">
                                        {sv.label}
                                    </text>
                                    <text x={xPos} y={cy + 118} textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" fontFamily="monospace">
                                        {typeof sv.value === 'number' ? sv.value.toFixed(0) : sv.value}
                                    </text>
                                </g>
                            );
                        })}
                        {/* STROKES counter */}
                        <text x={cx} y={cy + 140} textAnchor="middle" fill="#6B7280" fontSize="10" fontWeight="bold" letterSpacing="1">
                            TOTAL STROKES
                        </text>
                        <text x={cx} y={cy + 164} textAnchor="middle" fill="#EF4444" fontSize="24" fontWeight="bold" fontFamily="monospace">
                            {subValues.reduce((sum, s) => sum + (s.value || 0), 0).toFixed(0)}
                        </text>
                    </>
                )}
            </svg>
        </div>
    );
};

export default RadialGauge;
