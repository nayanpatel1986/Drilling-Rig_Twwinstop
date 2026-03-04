import React, { useState, useEffect } from 'react';
import { Activity, Settings, X, Gauge, ArrowDownCircle } from 'lucide-react';
import { getRigData } from '../api';
import RadialGauge from '../components/RadialGauge';
import { useRealtimeData } from '../hooks/useRealtimeData';

/* ── All available parameters for selection ──── */
const ALL_PARAMS = [
    { key: 'BitDepth', label: 'BIT POSITION', unit: 'm' },
    { key: 'WOB', label: 'BIT WEIGHT (WOB)', unit: 'ton' },
    { key: 'BlockPosition', label: 'BLOCK HEIGHT', unit: 'm' },
    { key: 'TonMile', label: 'TON MILE (CUT & SLIP)', unit: 'ton miles' },
    { key: 'DiffPress', label: 'DIFF PRESS', unit: 'psi' },
    { key: 'FlowRate', label: 'FLOW IN RATE', unit: 'gpm' },
    { key: 'FlowOutPercent', label: 'FLOW OUT PERCENT', unit: '%' },
    { key: 'GainLoss', label: 'GAIN LOSS', unit: 'm3' },
    { key: 'H2SGas', label: 'H2S GAS SS', unit: 'ppm' },
    { key: 'Depth', label: 'HOLE DEPTH', unit: 'm' },
    { key: 'HookLoad', label: 'HOOK LOAD', unit: 'ton' },
    { key: 'TotalMudVolume', label: 'TOTAL MUD VOLUME', unit: 'm3' },
    { key: 'PitVolume1', label: 'PIT VOLUME 1', unit: 'm3' },
    { key: 'PitVolume2', label: 'PIT VOLUME 2', unit: 'm3' },
    { key: 'PitVolume3', label: 'PIT VOLUME 3', unit: 'm3' },
    { key: 'PitVolume4', label: 'PIT VOLUME 4', unit: 'm3' },
    { key: 'StandpipePressure', label: 'PUMP PRESSURE', unit: 'psi' },
    { key: 'SPM1', label: 'PUMP SPM 1', unit: 'spm' },
    { key: 'SPM2', label: 'PUMP SPM 2', unit: 'spm' },
    { key: 'SPM3', label: 'PUMP SPM 3', unit: 'spm' },
    { key: 'TotalSPM', label: 'TOTAL SPM', unit: 'spm' },
    { key: 'RigActivity', label: 'RIG ACTIVITY', unit: '-' },
    { key: 'ROP', label: 'ROP - AVERAGE', unit: 'ft/hr' },
    { key: 'RPM', label: 'ROTARY RPM', unit: 'rpm' },
    { key: 'Torque', label: 'ROTARY TORQUE', unit: 'ft-lb' },
    { key: 'SlipStatus', label: 'SLIP STATUS', unit: 'status' },
    { key: 'StringSpeed', label: 'STRING SPEED', unit: 'ft/min' },
    { key: 'TotalStrokes', label: 'TOTAL STROKES', unit: 'strokes' },
    { key: 'TopDriveRPM', label: 'TOP DRIVE RPM', unit: 'rpm' },
    { key: 'TopDriveTorque', label: 'TOP DRIVE TORQUE', unit: 'ft-lb' },
    { key: 'TripTank1', label: 'TRIP TANK 1', unit: 'bbl' },
    { key: 'TripTank2', label: 'TRIP TANK 2', unit: 'bbl' },
    { key: 'TripTankGL', label: 'TRIP TANK GL', unit: 'bbl' },
];

/* ── Gauge presets (configurable) ─────────────── */
const GAUGE_PRESETS = [
    { key: 'HookLoad', label: 'HOOK LOAD', unit: 'ton', min: 0, max: 150, majorStep: 10, minorStep: 1, subKey: 'WOB', subLabel: 'BIT WEIGHT', subUnit: 'ton' },
    { key: 'RPM', label: 'ROTARY RPM', unit: 'rpm', min: 0, max: 200, majorStep: 40, minorStep: 10 },
    { key: 'StandpipePressure', label: 'PUMP PRESSURE', unit: 'psi', min: 0, max: 5000, majorStep: 1000, minorStep: 250 },
    { key: 'Torque', label: 'ROTARY TORQUE', unit: 'ft-lb', min: 0, max: 50000, majorStep: 10000, minorStep: 2500 },
    { key: 'ROP', label: 'ROP - AVERAGE', unit: 'ft/hr', min: 0, max: 200, majorStep: 40, minorStep: 10 },
    { key: 'FlowRate', label: 'FLOW IN RATE', unit: 'gpm', min: 0, max: 1500, majorStep: 300, minorStep: 75 },
    { key: 'TotalSPM', label: 'MUD PUMPS', unit: 'spm', min: 0, max: 300, majorStep: 60, minorStep: 15, spmGauge: true },
];

const DEFAULT_GAUGES = [
    GAUGE_PRESETS[2], // Pump Pressure
    GAUGE_PRESETS[0], // Hook Load
    GAUGE_PRESETS[6], // Total SPM (Mud Pumps)
];

const DEFAULT_STATS = [
    { key: 'Depth', label: 'HOLE DEPTH', unit: 'm' },
    { key: 'BitDepth', label: 'BIT POSITION', unit: 'm' },
];

const DEFAULT_KPIS = [
    { key: 'StandpipePressure', label: 'PUMP PRESSURE', unit: 'psi' },
    { key: 'Torque', label: 'ROTARY TORQUE', unit: 'ft-lb' },
    { key: 'ROP', label: 'ROP - AVERAGE', unit: 'ft/hr' },
    { key: 'WOB', label: 'BIT WEIGHT', unit: 'ton' },
    { key: 'RPM', label: 'ROTARY RPM', unit: 'rpm' },
    { key: 'FlowRate', label: 'FLOW IN RATE', unit: 'gpm' },
    { key: 'HookLoad', label: 'HOOK LOAD', unit: 'ton' },
    { key: 'BlockPosition', label: 'BLOCK HEIGHT', unit: 'm' },
    { key: 'SPM1', label: 'PUMP SPM 1', unit: 'spm' },
    { key: 'TripTank1', label: 'TRIP TANK 1', unit: 'bbl' },
    { key: 'PitVolume1', label: 'PIT VOLUME 1', unit: 'm3' },
    { key: 'GainLoss', label: 'GAIN LOSS', unit: 'm3' },
];

function load(key, def) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
}

/* ── Simple Rig Silhouette ────────────────────── */
function SimpleRig({ blockPosition = 0, depth = 0 }) {
    const maxTravel = 30;
    const clamped = Math.max(0, Math.min(blockPosition, maxTravel));
    const ratio = clamped / maxTravel;
    const topY = 40;
    const bottomY = 320;
    const blockY = bottomY - ratio * (bottomY - topY - 50);

    return (
        <svg viewBox="0 0 200 400" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 15px rgba(0,163,224,0.1))' }}>
            <defs>
                <linearGradient id="rigLeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4B5563" />
                    <stop offset="100%" stopColor="#374151" />
                </linearGradient>
            </defs>

            {/* Derrick legs */}
            <line x1="50" y1="340" x2="82" y2={topY} stroke="#6B7280" strokeWidth="3.5" />
            <line x1="150" y1="340" x2="118" y2={topY} stroke="#6B7280" strokeWidth="3.5" />

            {/* Cross braces */}
            {[80, 130, 180, 230, 280].map((y, i) => {
                const r2 = (340 - y) / (340 - topY);
                const lx = 50 + r2 * (82 - 50);
                const rx = 150 - r2 * (150 - 118);
                return <line key={i} x1={lx} y1={y} x2={rx} y2={y} stroke="#4B5563" strokeWidth="1" opacity="0.6" />;
            })}

            {/* Crown block */}
            <rect x="78" y={topY - 5} width="44" height="14" rx="3" fill="#374151" stroke="#6B7280" strokeWidth="1" />
            <circle cx="92" cy={topY + 2} r="4" fill="none" stroke="#6B7280" strokeWidth="1.5" />
            <circle cx="108" cy={topY + 2} r="4" fill="none" stroke="#6B7280" strokeWidth="1.5" />

            {/* Wireline */}
            <line x1="92" y1={topY + 6} x2="92" y2={blockY} stroke="#9CA3AF" strokeWidth="1" />
            <line x1="108" y1={topY + 6} x2="108" y2={blockY} stroke="#9CA3AF" strokeWidth="1" />

            {/* Traveling block */}
            <rect x="82" y={blockY} width="36" height="20" rx="4" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" />
            <rect x="88" y={blockY + 5} width="24" height="10" rx="2" fill="#B45309" />

            {/* Hook */}
            <line x1="100" y1={blockY + 20} x2="100" y2={blockY + 30} stroke="#D1D5DB" strokeWidth="2" />

            {/* Drill string */}
            <rect x="97" y={blockY + 30} width="6" height={340 - blockY - 30} fill="#6B7280" />

            {/* Rig floor */}
            <rect x="30" y="340" width="140" height="6" rx="1" fill="#374151" />

            {/* Substructure legs */}
            <rect x="40" y="346" width="8" height="40" fill="#4B5563" />
            <rect x="152" y="346" width="8" height="40" fill="#4B5563" />

            {/* Base */}
            <rect x="25" y="384" width="150" height="8" rx="2" fill="#1F2937" stroke="#374151" strokeWidth="1" />

            {/* Bit (drill bit at bottom) */}
            <polygon points="94,380 100,395 106,380" fill="#EF4444" stroke="#DC2626" strokeWidth="1" />

            {/* Block Position label inside rig */}
            <rect x="24" y="345" width="95" height="20" rx="3" fill="rgba(0,0,0,0.7)" stroke="#22D3EE" strokeWidth="0.8" />
            <text x="32" y="358" fill="#9CA3AF" fontSize="8" fontFamily="monospace" fontWeight="bold">BLK POS:</text>
            <text x="112" y="358" textAnchor="end" fill="#22D3EE" fontSize="9" fontWeight="bold" fontFamily="monospace">{clamped.toFixed(2)}m</text>
        </svg>
    );
}

/* ── Main Component ───────────────────────────── */
export default function DrillingOverview() {
    // WebSocket real-time data (Phase 2 optimization)
    const { 
        data: wsData, 
        isConnected, 
        connectionStatus, 
        latency 
    } = useRealtimeData();
    
    const [data, setData] = useState(null);
    const [gauges, setGauges] = useState(() => load('drillOvGauges_v7', DEFAULT_GAUGES));
    const [stats, setStats] = useState(() => load('drillOvStats_v2', DEFAULT_STATS));
    const [kpis, setKpis] = useState(() => load('drillOvKpis_v3', DEFAULT_KPIS));

    // Edit modals
    const [editGaugeIdx, setEditGaugeIdx] = useState(null);
    const [editStatIdx, setEditStatIdx] = useState(null);   // top stats
    const [editKpiIdx, setEditKpiIdx] = useState(null);      // bottom KPIs


    // Persist
    useEffect(() => { localStorage.setItem('drillOvGauges_v7', JSON.stringify(gauges)); }, [gauges]);
    useEffect(() => { localStorage.setItem('drillOvStats_v2', JSON.stringify(stats)); }, [stats]);
    useEffect(() => { localStorage.setItem('drillOvKpis_v3', JSON.stringify(kpis)); }, [kpis]);

    // Update data from WebSocket
    useEffect(() => {
        if (wsData) {
            setData(wsData);
        }
    }, [wsData]);

    // Fallback HTTP polling when WebSocket is not connected
    useEffect(() => {
        if (!isConnected) {
            const fetchData = async () => {
                const d = await getRigData();
                if (d) setData(d);
            };
            fetchData();
            const interval = setInterval(fetchData, 2000);  // 2s fallback polling
            return () => clearInterval(interval);
        }
    }, [isConnected]);

    const val = (key) => {
        if (!data) return 0;
        if (key === 'TripTank') return data.TripTank1 ?? data.TripTank ?? 0;
        if (key === 'BitDepth') return data.BitDepth ?? data.Depth ?? 0;
        if (key === 'TotalSPM') return (data.SPM1 ?? 0) + (data.SPM2 ?? 0);
        return data[key] ?? 0;
    };

    const blockPos = val('BlockPosition');
    const depth = val('Depth');
    const rop = val('ROP');
    const hkld = val('HookLoad');
    const rigActivity = rop > 0.5 ? 'DRILLING' : hkld > 5 ? 'TRIPPING' : 'IDLE';
    const activityColor = rigActivity === 'DRILLING' ? 'bg-green-500' : rigActivity === 'TRIPPING' ? 'bg-yellow-500' : 'bg-cyan-500';

    return (
        <div className="flex flex-col -mt-4 gap-2 overflow-hidden" style={{ height: 'calc(100vh - 90px)' }}>
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded border border-white/5 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                    'bg-red-500'
                }`}></div>
                <span className="text-xs text-gray-400 font-medium">
                    {connectionStatus === 'connected' ? `⚡ Real-time (${latency || 0}ms latency)` : 
                     connectionStatus === 'connecting' ? '🔄 Connecting...' : 
                     '📡 Polling Mode'}
                </span>
            </div>
            
            {/* Top Status Bar */}
            <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                <div className="card border border-white/5 px-4 py-2 flex items-center justify-between gap-3 bg-slate-800/40">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5"><Gauge size={14} className="text-yellow-400" /> Rig Activity</span>
                    <span className={`${activityColor} text-black font-bold text-sm px-4 py-1 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>
                        {rigActivity}
                    </span>
                </div>
                {stats.map((s, i) => (
                    <div key={i} className="group card border border-white/5 px-4 py-2 flex items-center justify-between relative bg-slate-800/40">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5"><ArrowDownCircle size={14} className="text-cyan-400" /> {s.label}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{val(s.key).toFixed(1)}</span>
                            <span className="text-gray-400 text-sm font-medium">{s.unit}</span>
                        </div>
                        <button onClick={() => setEditStatIdx(i)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white">
                            <Settings size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Middle: Rig + Gauges — takes remaining vertical space */}
            <div className="flex-1 grid grid-cols-12 gap-2 min-h-0 overflow-hidden">
                {/* Left: Rig (with BLK POS inside) */}
                <div className="col-span-3 min-h-0">
                    <div className="card border border-white/5 h-full flex items-center justify-center p-1 overflow-hidden">
                        <SimpleRig blockPosition={blockPos} depth={depth} />
                    </div>
                </div>

                {/* Right: Three Gauges */}
                <div className="col-span-9 flex items-center justify-center gap-2 min-h-0">
                    {gauges.map((g, i) => (
                        <div key={i} className="group card border border-white/5 p-2 flex-1 relative flex items-center justify-center" style={{ maxWidth: i === 1 ? '340px' : '260px' }}>
                            <RadialGauge
                                value={val(g.key)}
                                min={g.min} max={g.max}
                                majorStep={g.majorStep} minorStep={g.minorStep}
                                label={g.label}
                                unit={g.unit}
                                size={i === 1 ? 'lg' : 'sm'}
                                subValue={g.subKey ? val(g.subKey) : undefined}
                                subLabel={g.subLabel}
                                subUnit={g.subUnit}
                                subValues={g.spmGauge ? [
                                    { value: val('SPM1'), label: 'SPM 1' },
                                    { value: val('SPM2'), label: 'SPM 2' },
                                ] : undefined}
                            />
                            <button onClick={() => setEditGaugeIdx(i)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white" title="Change gauge">
                                <Settings size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom: KPIs — fixed height */}
            <div className="flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <Activity size={12} className="text-cyan-400" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Key Performance Indicators</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {kpis.map((kpi, i) => (
                        <div key={i} className="group card border border-white/5 px-3 py-3 text-center hover:border-white/10 transition-colors relative bg-slate-800/40">
                            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">{kpi.label}</div>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="font-mono font-bold text-2xl text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">{val(kpi.key).toFixed(['PitVolume1', 'PitVolume2', 'PitVolume3', 'PitVolume4', 'TripTank1', 'TripTank2', 'TripTankGL', 'BlockPosition'].includes(kpi.key) ? 2 : kpi.key === 'ROP' ? 1 : 0)}</span>
                                <span className="text-xs text-gray-500 font-medium">{kpi.unit}</span>
                            </div>
                            <button onClick={() => setEditKpiIdx(i)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white">
                                <Settings size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Gauge Selection Modal ── */}
            {editGaugeIdx !== null && (
                <SelectionModal
                    title="Select Gauge"
                    items={GAUGE_PRESETS}
                    onSelect={(item) => { const u = [...gauges]; u[editGaugeIdx] = item; setGauges(u); setEditGaugeIdx(null); }}
                    onClose={() => setEditGaugeIdx(null)}
                    renderItem={(g) => <><span className="text-white text-sm">{g.label}</span><span className="text-xs text-gray-500">({g.min}-{g.max} {g.unit})</span></>}
                />
            )}

            {/* ── Stat Selection Modal (top bar) ── */}
            {editStatIdx !== null && (
                <SelectionModal
                    title="Select Parameter"
                    items={ALL_PARAMS}
                    onSelect={(item) => { const u = [...stats]; u[editStatIdx] = item; setStats(u); setEditStatIdx(null); }}
                    onClose={() => setEditStatIdx(null)}
                    renderItem={(p) => <><span className="text-white text-sm">{p.label}</span><span className="text-xs text-gray-500">({p.unit})</span></>}
                />
            )}

            {/* ── KPI Selection Modal ── */}
            {editKpiIdx !== null && (
                <SelectionModal
                    title="Select KPI"
                    items={ALL_PARAMS}
                    onSelect={(item) => { const u = [...kpis]; u[editKpiIdx] = item; setKpis(u); setEditKpiIdx(null); }}
                    onClose={() => setEditKpiIdx(null)}
                    renderItem={(p) => <><span className="text-white text-sm">{p.label}</span><span className="text-xs text-gray-500">({p.unit})</span></>}
                />
            )}


        </div>
    );
}

/* ── Reusable Selection Modal ─────────────────── */
function SelectionModal({ title, items, onSelect, onClose, renderItem }) {
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-nov-dark border border-gray-700 rounded-xl shadow-2xl w-[400px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto p-2 flex-1">
                    {items.map((item, i) => (
                        <button
                            key={item.key + i}
                            className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 flex justify-between items-center mb-0.5 transition-colors"
                            onClick={() => onSelect(item)}
                        >
                            {renderItem(item)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
