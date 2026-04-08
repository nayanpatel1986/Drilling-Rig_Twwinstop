import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { Flame, AlertTriangle, Zap, Target, X, RefreshCw, ChevronRight, Activity, Settings, ArrowDownCircle, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRigData, writeModbusCoil, writeModbusFloat } from '../api';
import RadialGauge from '../components/RadialGauge';
import { ResponsiveGridLayout } from 'react-grid-layout';
import CalibrationModal from '../components/CalibrationModal';
import SinglePointModal from '../components/SinglePointModal';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Reusable Card component with a dark glassmorphic look, supporting grid layout props via forwardRef
const Card = React.forwardRef(({ title, children, className = '', style, customHeader, ...props }, ref) => (
    <div ref={ref} style={style} className={`bg-[#1a1c23] border border-white/5 rounded-xl shadow-xl flex flex-col overflow-hidden ${className}`} {...props}>
        {title && (
            <div className="drag-handle cursor-move bg-white/5 hover:bg-white/10 p-2 border-b border-white/5 flex items-center justify-between transition-colors relative group">
                <span className="text-sm text-gray-400 font-bold uppercase tracking-wider w-full text-center">{title}</span>
            </div>
        )}
        <div className="p-4 flex-1 flex flex-col min-h-0 relative">
            {children}
        </div>
    </div>
));

// KPI Card for the left column, supports grid layout props
const KPICard = React.forwardRef(({ title, value, subtitle, valueColor = 'text-white', className = '', style, ...props }, ref) => (
    <div ref={ref} style={style} className={`bg-[#1a1c23] border border-white/5 rounded-xl flex flex-col items-center justify-center shadow-lg hover:bg-white/5 transition-colors drag-handle cursor-move ${className}`} {...props}>
        <span className="text-sm text-gray-400 font-bold mb-2 text-center uppercase">{title}</span>
        <span className={`text-4xl font-bold font-mono ${valueColor}`}>{value}</span>
        {subtitle && <span className="text-xs text-gray-500 mt-1">{subtitle}</span>}
    </div>
));

// Animated progress bar with glow effect for Mud Pump section
const ProgressBar = ({ title, value, max, displayValue, gradient, glowColor = 'rgba(56,189,248,0.3)' }) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const isActive = value > 0;
    return (
        <div className="w-full mb-1">
            <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</span>
                <span className="text-lg font-mono font-black text-white drop-shadow-lg">{displayValue}</span>
            </div>
            <div className="h-3 w-full bg-slate-900/80 rounded-full overflow-hidden relative border border-white/5">
                <div 
                    className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-700 ease-out relative`}
                    style={{ 
                        width: `${percent}%`,
                        boxShadow: isActive ? `0 0 12px ${glowColor}, 0 0 4px ${glowColor}` : 'none'
                    }}
                >
                    {isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-pulse rounded-full" />}
                </div>
            </div>
        </div>
    );
};

function useActualContainerWidth() {
    const [width, setWidth] = useState(1200);
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries && entries.length > 0) {
                // adding a small tweak to avoid grid scrollbar wrapping collisions
                setWidth(entries[0].contentRect.width - 10);
            }
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return { ref, width };
}

export default function DrillingTwin() {
    const navigate = useNavigate();
    const [data, setData] = useState({});
    const [history, setHistory] = useState([]);
    const [isCalModalOpen, setIsCalModalOpen] = useState(false);
    const [isSinglePointModalOpen, setIsSinglePointModalOpen] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isTwinstopModalOpen, setIsTwinstopModalOpen] = useState(false);
    const { ref: containerRef, width: containerWidth } = useActualContainerWidth();

    // Initial default widget configuration - Includes metadata for custom parameter mapping
    const defaultWidgets = [
        { id: 'twinstop', i: 'twinstop', type: 'Graphic', title: 'TWINSTOP', x: 0, y: 0, w: 2, h: 5, minW: 2, minH: 3 },
        { id: 'blockHeight', i: 'blockHeight', type: 'DualStatCard', title: '', x: 0, y: 5, w: 2, h: 1, minW: 2, minH: 1 },
        { id: 'hookload', i: 'hookload', type: 'Gauge', title: 'HOOKLOAD', x: 2, y: 0, w: 3, h: 3, minW: 2, minH: 1, dataKey: 'HOOKLOAD_MAX', subKey: 'WOV' },
        { id: 'mudPump', i: 'mudPump', type: 'PumpPanel', title: 'MUD PUMP', x: 5, y: 0, w: 4, h: 3, minW: 3, minH: 1 },
        { id: 'mudVol', i: 'mudVol', type: 'BarChart', title: 'MUD VOLUME', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 1,
          keys: ['TANK1_VOL', 'TANK2_VOL', 'TANK3_VOL', 'TT1_VOL']
        },
        { id: 'rotary', i: 'rotary', type: 'StatusGrid', title: 'ROTARY PERFORMANCE', x: 2, y: 3, w: 3, h: 2, minW: 2, minH: 1, 
          params: [
              { label: 'RPM', key: 'ROT_SPEED', color: 'cyan', icon: 'Activity', unit: 'rpm' },
              { label: 'TORQUE', key: 'ROT_TORQUE', color: 'amber', icon: 'Settings', unit: 'kNm' },
              { label: 'RAP', key: 'rap', color: 'blue', icon: 'Zap', unit: 'psi' },
              { label: 'TONG TRQ', key: 'Pipe Torque', color: 'orange', icon: 'Settings', unit: 'kNm' }
          ]
        },
        { id: 'gas', i: 'gas', type: 'StatusGrid', title: 'GAS MONITORING', x: 5, y: 3, w: 2, h: 2, minW: 2, minH: 1,
          params: [
              { label: 'LEL SS', key: 'LEL Gas SS', color: 'cyan', icon: 'Flame', unit: '%' },
              { label: 'LEL BN', key: 'LEL Gas BN', color: 'purple', icon: 'Flame', unit: '%' },
              { label: 'H2S SS', key: 'h2s_ss', color: 'yellow', icon: 'AlertTriangle', unit: 'ppm' },
              { label: 'H2S BN', key: 'H2S Gas BN', color: 'rose', icon: 'AlertTriangle', unit: 'ppm' }
          ]
        },
        { id: 'powerPack', i: 'powerPack', type: 'PowerGrid', title: 'POWER PACK', x: 7, y: 3, w: 2, h: 2, minW: 2, minH: 1 },
        { id: 'bop', i: 'bop', type: 'BOPStatus', title: 'BOP STATUS', x: 9, y: 3, w: 3, h: 2, minW: 2, minH: 2 }
    ];

    const VERSION = 'v16';
    
    const [widgets, setWidgets] = useState(() => {
        // Force-clear all old versions on every load
        for (let i = 1; i <= 15; i++) {
            localStorage.removeItem(`drillingTwinWidgets_v${i}`);
        }
        
        const savedVersion = localStorage.getItem('drillingTwinLayoutVersion');
        if (savedVersion === VERSION) {
            const saved = localStorage.getItem(`drillingTwinWidgets_${VERSION}`);
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { /* ignore */ }
            }
        }
        // Version mismatch or no saved data — use defaults
        localStorage.setItem('drillingTwinLayoutVersion', VERSION);
        return defaultWidgets;
    });

    const onLayoutChange = (newLayout) => {
        setWidgets(prev => prev.map(w => {
            const layoutItem = newLayout.find(l => l.i === w.i);
            return layoutItem ? { ...w, ...layoutItem } : w;
        }));
    };

    useEffect(() => {
        localStorage.setItem(`drillingTwinWidgets_${VERSION}`, JSON.stringify(widgets));
    }, [widgets]);

    useEffect(() => {
        const fetch = async () => {
            const rigData = await getRigData();
            if (rigData) {
                setData(rigData);
                setHistory(prev => {
                    const newHist = [...prev, { time: new Date().toLocaleTimeString(), ...rigData }].slice(-30);
                    return newHist;
                });
            }
        };
        fetch();
        const interval = setInterval(fetch, 1000);
        return () => clearInterval(interval);
    }, []);

    // Mud Volumes mapped to WITSML keys
    const mudVolumes = [
        { name: 'Tank 1', value: data.TANK1_VOL || 0, fill: '#60A5FA' },
        { name: 'Tank 2', value: data.TANK2_VOL || 0, fill: '#34D399' },
        { name: 'Tank 3', value: data.TANK3_VOL || 0, fill: '#FBBF24' },
        { name: 'Trip Tank', value: data.TT1_VOL || 0, fill: '#F87171' }
    ];

    // Pump Data mapped to WITSML keys
    const spm1 = data.MP1_SPM || 0;
    const spm2 = data.MP2_SPM || 0;
    const totalSpm = data.TOT_SPM || (spm1 + spm2);
    const pumpPressure = data['Standpipe Pressure'] || 0;
    const pump1Status = spm1 > 0 ? "ON" : "OFF";
    const pump2Status = spm2 > 0 ? "ON" : "OFF";

    // Power Pack Engines Status
    const powerPacks = [1, 2, 3, 4].map(id => {
        const rawRpm = data[`PP${id}_RPM`] || (data.RPM ? data.RPM * (0.95 + (id * 0.01)) : 0);
        const rpm = rawRpm > 10 ? Math.floor(rawRpm) : 0;
        return {
            id,
            name: `Eng ${id}`,
            rpm,
            isOn: rpm > 500,
        };
    });

    const activeEngines = powerPacks.filter(p => p.isOn).length;



    // Helper to render widget content based on type
    const renderWidgetContent = (w) => {
        switch(w.type) {
            case 'Gauge':
                const isHookload = w.id === 'hookload';
                return (
                    <div className="w-full h-full flex flex-col items-center justify-start relative pt-2">
                        <RadialGauge 
                            value={data[w.dataKey] || 0} 
                            min={0} max={isHookload ? 200 : 100} 
                            majorStep={isHookload ? 20 : 10}
                            minorStep={isHookload ? 4 : 2}
                            label={isHookload ? 'WOH' : w.title} 
                            unit={isHookload ? 'ton' : (w.unit || '')} 
                            size="lg"
                            subValue={isHookload ? (data['WOB'] || data['Weight on Bit'] || 0) : (w.subKey ? data[w.subKey] : null)}
                            subLabel={isHookload ? 'WOB' : w.subLabel}
                            subUnit={isHookload ? 'ton' : undefined}
                        />
                    </div>
                );
            case 'BarChart':
                return (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 w-full flex items-end justify-around px-2 mb-3 pt-4">
                            {mudVolumes.map((tank, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 h-full justify-end w-1/4">
                                    <div className="w-full flex justify-center items-end" style={{ height: '75%' }}>
                                        <div 
                                            className="w-8 sm:w-10 md:w-12 rounded-t-md transition-all duration-1000 shadow-lg" 
                                            style={{ height: `${Math.max(4, Math.min(100, tank.value))}%`, backgroundColor: tank.fill }}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-xs text-gray-400 font-bold mb-0.5">{tank.value.toFixed(1)} m³</span>
                                        <span className="block text-xs text-[#60A5FA] font-bold tracking-tight">{tank.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex w-full pt-3 pb-2 border-t border-white/10">
                             {[
                                 { label: 'FLOW RATE', val: data.FLOW_RATE_IN || 0, unit: 'gpm', color: 'text-[#38BDF8]' },
                                 { label: 'FLOW OUT', val: data.FLOW_OUT_PCT || 0, unit: '%', color: 'text-[#4ADE80]' },
                                 { label: 'GAIN/LOSS', val: data.VOL_GAIN_LOSS || -100.0, unit: 'bbl', color: 'text-[#FBBF24]' }
                             ].map((s, i) => (
                                 <div key={i} className={`flex flex-col items-center flex-1 ${i === 1 ? 'border-x border-white/10' : ''}`}>
                                     <span className="text-xs text-gray-400 font-black tracking-tighter mb-1">{s.label}</span>
                                     <span className={`text-xl font-black font-mono leading-none ${s.color}`}>{s.val.toFixed(1)}</span>
                                     <span className="text-[10px] text-gray-500 font-bold mt-1">{s.unit}</span>
                                 </div>
                             ))}
                        </div>
                    </div>
                );
            case 'StatusGrid':
                return (
                    <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full pb-1 px-1">
                        {(w.params || []).map((p, idx) => (
                            <div key={idx} className="bg-slate-800/30 border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center relative hover:bg-white/5 transition-colors">
                                <span className="text-xs text-gray-500 font-black uppercase tracking-widest mb-0.5">{p.label}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-3xl font-mono font-bold ${p.color === 'cyan' ? 'text-cyan-400' : p.color === 'amber' ? 'text-amber-500' : p.color === 'blue' ? 'text-blue-400' : 'text-orange-400'}`}>
                                        {p.type === 'status'
                                            ? (data[p.key] > 0 ? <span className="text-nov-accent font-black">ON</span> : <span className="text-red-500 font-black">OFF</span>)
                                            : (typeof data[p.key] === 'number' ? data[p.key].toFixed(p.key.includes('TORQUE') || p.key.includes('Trq') ? 0 : 1) : data[p.key] || 0)
                                        }
                                    </span>
                                    {(!p.type && p.unit) && <span className="text-[10px] text-gray-600 font-bold uppercase">{p.unit}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'Graphic':
                if (w.id === 'twinstop') {
                    const rawHeight = data.BLOCK_POS || 0;
                    const bh = data.BLOCK_HEIGHT || 0;
                    const crownLimit = data.Crownomatic || 0;
                    const floorLimit = data.Flooromatic || 0;
                    const isCrownActive = crownLimit > 0 && bh >= crownLimit;
                    const isFloorActive = floorLimit > 0 && bh <= floorLimit;
                    const travelY = 220 - (Math.max(0, Math.min(1, rawHeight / 34)) * 190);
                    return (
                        <div 
                            className="w-full h-full flex flex-col cursor-pointer hover:bg-white/5 transition-colors group"
                            onClick={() => setIsTwinstopModalOpen(true)}
                        >
                            <div className="flex-1 min-h-0 flex items-center justify-center pointer-events-none relative">
                                <svg viewBox="20 10 160 275" className="w-full h-full drop-shadow-2xl" preserveAspectRatio="xMidYMid meet">
                                    <defs>
                                        <style>{`
                                            @keyframes alarmBlink {
                                                0%, 100% { opacity: 1; }
                                                50% { opacity: 0.3; }
                                            }
                                            .alarm-blink { animation: alarmBlink 0.8s ease-in-out infinite; }
                                        `}</style>
                                    </defs>
                                    {/* 1. Derrick Background Fill */}
                                    <polygon points="35,280 165,280 125,25 75,25" fill="#334155" />

                                    {/* 2. Top Safety Zones (Crown Saver) */}
                                    {/* Top Red Zone */}
                                    <polygon points="75,25 125,25 119,65 81,65" fill={isCrownActive ? "#dc2626" : "#ef4444"} />
                                    {/* Top Yellow Zone */}
                                    <polygon points="81,65 119,65 113,95 87,95" fill="#fbbf24" />

                                    {/* CROWNOMATIC ON - Top Area */}
                                    {isCrownActive && (
                                        <g className="alarm-blink">
                                            <rect x="20" y="32" width="160" height="32" rx="6" fill="#dc2626" fillOpacity="0.95" stroke="#fbbf24" strokeWidth="2.5" />
                                            <text x="100" y="50" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="13" fontWeight="900" letterSpacing="1" fontFamily="monospace">
                                                CROWNOMATIC ON
                                            </text>
                                        </g>
                                    )}

                                    {/* 3. Bottom Safety Zones (Floor Saver) */}
                                    {/* Bottom Yellow Zone */}
                                    <polygon points="41,240 159,240 155,265 45,265" fill="#fbbf24" />
                                    {/* Bottom Red Zone */}
                                    <polygon points="45,265 155,265 151,280 49,280" fill={isFloorActive ? "#dc2626" : "#ef4444"} />

                                    {/* FLOOROMATIC ON - Bottom Area */}
                                    {isFloorActive && (
                                        <g className="alarm-blink">
                                            <rect x="20" y="242" width="160" height="32" rx="6" fill="#dc2626" fillOpacity="0.95" stroke="#fbbf24" strokeWidth="2.5" />
                                            <text x="100" y="260" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="13" fontWeight="900" letterSpacing="1" fontFamily="monospace">
                                                FLOOROMATIC ON
                                            </text>
                                        </g>
                                    )}

                                    {/* Crown Block with Dual Pulleys */}
                                    <rect x="70" y="10" width="60" height="15" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                                    <circle cx="85" cy="18" r="4" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                                    <circle cx="115" cy="18" r="4" fill="none" stroke="#94a3b8" strokeWidth="1.5" />

                                    {/* Vertical Rope Lines */}
                                    <line x1="85" y1="20" x2="85" y2="280" stroke="#1e293b" strokeWidth="1.5" />
                                    <line x1="115" y1="20" x2="115" y2="280" stroke="#1e293b" strokeWidth="1.5" />

                                    {/* Main Derrick Frame */}
                                    <line x1="75" y1="25" x2="35" y2="280" stroke="#1e293b" strokeWidth="4" />
                                    <line x1="125" y1="25" x2="165" y2="280" stroke="#1e293b" strokeWidth="4" />

                                    {/* Cross Bars */}
                                    {[80, 130, 180, 230].map((y, i) => {
                                        const t = (y - 25) / (280 - 25);
                                        const lx = 75 - t * (75 - 35);
                                        const rx = 125 + t * (165 - 125);
                                        return <line key={i} x1={lx} y1={y} x2={rx} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />;
                                    })}

                                    {/* Traveling Block (Moving) */}
                                    <g transform={`translate(0, ${travelY})`} className="transition-transform duration-500">
                                        <line x1="85" y1="-10" x2="85" y2="10" stroke="#94a3b8" strokeWidth="1.5" />
                                        <line x1="115" y1="-10" x2="115" y2="10" stroke="#94a3b8" strokeWidth="1.5" />
                                        <rect x="75" y="0" width="50" height="25" rx="6" fill="#f59e0b" stroke="#92400e" strokeWidth="1.5" className="shadow-lg" />
                                        <rect x="80" y="5" width="40" height="15" rx="3" fill="rgba(146, 64, 14, 0.2)" />
                                        
                                        {/* Block Position Display Pill (Attached to block) */}
                                        <g transform="translate(100, 32)">
                                            <rect x="-60" y="0" width="120" height="24" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="#0ea5e9" strokeWidth="2" />
                                            <text x="-52" y="12" textAnchor="start" dominantBaseline="middle" fill="#9ca3af" fontSize="10" fontWeight="bold" letterSpacing="1">
                                                BLK POS:
                                            </text>
                                            <text x="52" y="12" textAnchor="end" dominantBaseline="middle" fill="#0ea5e9" fontSize="13" fontWeight="900" fontFamily="monospace">
                                                {(data.BLOCK_POS || 0).toFixed(2)}m
                                            </text>
                                        </g>
                                    </g>

                                    {/* Drill Floor / Base Line */}
                                    <line x1="25" y1="280" x2="175" y2="280" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    );
                }
                return null;
            case 'StatCard':
                return (
                    <div 
                        className="h-full flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-white/5 transition-colors group"
                        onClick={() => setIsSelectorOpen(true)}
                    >
                         <div className="flex items-baseline gap-2">
                             <span className="text-4xl font-black text-[#0ea5e9] font-mono leading-none drop-shadow-md group-hover:scale-110 transition-transform">
                                 {(data[w.dataKey] || 0).toFixed(2)}
                             </span>
                             <span className="text-sm text-gray-500 font-bold uppercase">{w.unit}</span>
                         </div>
                         <div className="mt-2 text-[10px] text-gray-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">
                            Click to Calibrate
                         </div>
                    </div>
                );
            case 'DualStatCard':
                return (
                    <div 
                        className="grid grid-cols-2 gap-2 h-full pb-1 px-1 w-full drag-handle"
                    >
                         {/* Block Height */}
                         <div 
                             className="bg-slate-800/30 flex flex-col items-center justify-center rounded-xl border border-white/5 p-1 sm:p-2 hover:bg-white/5 transition-colors relative overflow-hidden cursor-pointer group"
                             onClick={() => setIsSelectorOpen(true)}
                         >
                             <span className="text-[9px] sm:text-[10px] text-[#0ea5e9] opacity-80 font-black uppercase tracking-wider mb-1 text-center leading-tight">BH</span>
                             <div className="flex items-baseline gap-1">
                                 <span className="text-xl sm:text-2xl font-black text-[#0ea5e9] font-mono leading-none drop-shadow-md">
                                     {(data.BLOCK_HEIGHT || 0).toFixed(2)}
                                 </span>
                                 <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">m</span>
                             </div>
                         </div>
                         {/* ROP */}
                         <div className="bg-slate-800/30 flex flex-col items-center justify-center rounded-xl border border-white/5 p-1 sm:p-2 hover:bg-white/5 transition-colors relative overflow-hidden">
                             <span className="text-[9px] sm:text-[10px] text-[#4ade80] opacity-80 font-black uppercase tracking-wider mb-1 text-center leading-tight">ROP</span>
                             <div className="flex items-baseline gap-1">
                                 <span className="text-xl sm:text-2xl font-black text-[#4ade80] font-mono leading-none drop-shadow-md">
                                     {(data.ROP || 0).toFixed(2)}
                                 </span>
                                 <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase">m/hr</span>
                             </div>
                         </div>
                    </div>
                );
            case 'PumpPanel':
                const pressure = data['Standpipe Pressure'] || 0;
                const pressurePercent = Math.min(100, (pressure / 5000) * 100);
                return (
                    <div className="flex flex-col h-full px-1 gap-2">
                        {/* Pump Status Cards with Pulsing Indicators */}
                        <div className="flex gap-2">
                             {[1, 2].map(id => {
                                 const isOn = (data[`MP${id}_SPM`] || 0) > 0;
                                 return (
                                     <div key={id} className={`flex-1 p-2.5 rounded-xl border flex items-center gap-3 transition-all duration-500 ${
                                         isOn 
                                             ? 'bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                                             : 'bg-slate-800/30 border-white/5'
                                     }`}>
                                         {/* Pulsing dot */}
                                         <div className="relative flex-shrink-0">
                                             <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-green-400' : 'bg-red-500/70'}`} />
                                             {isOn && <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-40" />}
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-xs text-gray-500 font-black tracking-widest leading-none">PUMP {id}</span>
                                             <span className={`text-base font-black font-mono leading-tight ${isOn ? 'text-green-400' : 'text-red-400'}`}>
                                                 {isOn ? 'RUNNING' : 'IDLE'}
                                             </span>
                                         </div>
                                         <span className="ml-auto text-2xl font-black font-mono text-white">
                                             {(data[`MP${id}_SPM`] || 0).toFixed(0)}
                                             <span className="text-[10px] text-gray-500 ml-1">spm</span>
                                         </span>
                                     </div>
                                 );
                             })}
                        </div>

                        {/* Pressure Gauge - Hero Element */}
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/80 rounded-xl border border-white/5 p-3 relative overflow-hidden">
                                {/* Subtle background glow */}
                                {pressure > 0 && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-transparent" />}
                                <div className="flex justify-between items-center mb-2 relative z-10">
                                    <span className="text-xs text-gray-500 font-black uppercase tracking-widest">STANDPIPE PRESSURE</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black font-mono text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                                            {pressure.toFixed(0)}
                                        </span>
                                        <span className="text-xs text-cyan-600 font-bold">PSI</span>
                                    </div>
                                </div>
                                {/* Full-width animated pressure bar */}
                                <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative z-10">
                                    <div 
                                        className="h-full rounded-full transition-all duration-700 ease-out relative"
                                        style={{ 
                                            width: `${pressurePercent}%`,
                                            background: `linear-gradient(90deg, #06b6d4, #3b82f6, ${pressurePercent > 70 ? '#f59e0b' : '#6366f1'})`,
                                            boxShadow: pressure > 0 ? '0 0 12px rgba(56,189,248,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none'
                                        }}
                                    >
                                        {pressure > 0 && <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 animate-pulse rounded-full" />}
                                    </div>
                                </div>
                            </div>
                        </div>



                        {/* Footer Stats */}
                        <div className="flex gap-2 pt-1 border-t border-white/5">
                            <div className="flex-1 bg-slate-800/30 rounded-lg p-2 flex flex-col items-center border border-white/5">
                                <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">TOTAL STROKES</span>
                                <span className="text-2xl font-black text-white font-mono leading-tight">{data.TOT_STRKS || 0}</span>
                            </div>
                            <div className="flex-1 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-lg p-2 flex flex-col items-center border border-cyan-500/20">
                                <span className="text-[10px] text-cyan-600 font-black uppercase tracking-widest">TOTAL SPM</span>
                                <span className="text-2xl font-black text-cyan-400 font-mono leading-tight drop-shadow-[0_0_6px_rgba(34,211,238,0.3)]">{totalSpm.toFixed(0)}</span>
                            </div>
                        </div>
                    </div>
                );
            case 'PowerGrid':
                const engineColors = ['bg-[#38bdf8]', 'bg-[#4ade80]', 'bg-[#fbbf24]', 'bg-[#a78bfa]'];
                return (
                    <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full p-1">
                        {powerPacks.map((p, idx) => {
                            const baseColor = engineColors[idx];
                            const statusOpacity = p.isOn ? 'opacity-100' : 'opacity-60 grayscale-[40%] brightness-75';
                            const textColor = 'text-slate-900';
                            const labelColor = 'text-slate-900/60';
                            const unitColor = 'text-slate-900/40';
                            
                            return (
                                <div key={p.id} className={`${baseColor} ${statusOpacity} ${textColor} rounded-xl flex flex-col items-center justify-center shadow-lg transition-all duration-1000 border border-white/10`}>
                                    <span className={`${labelColor} text-[10px] font-black uppercase tracking-widest mb-1`}>{p.name.toUpperCase()}</span>
                                    <div className="flex flex-col items-center justify-center">
                                        <span className={`text-3xl font-black font-mono ${p.isOn ? 'text-nov-accent' : 'text-red-500'}`}>
                                            {p.isOn ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            case 'BOPStatus':
                const rams = [
                    { label: 'PIPE', status: '???', color: 'bg-slate-700' },
                    { label: 'BLIND', status: '???', color: 'bg-slate-700' },
                    { label: 'ANNLR', status: '???', color: 'bg-slate-700' },
                    { label: 'ANNULAR', val: 0, unit: 'PSI', color: 'text-green-400' },
                    { label: 'ACCUM', val: 0, unit: 'PSI', color: 'text-blue-400' },
                    { label: 'MANIFOLD', val: 0, unit: 'PSI', color: 'text-amber-500' }
                ];
                return (
                    <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full p-1">
                        {rams.map((r, i) => (
                            <div key={i} className="bg-slate-800/40 border border-white/5 rounded-xl flex flex-col items-center justify-center p-1.5 hover:bg-white/5 transition-colors">
                                <span className="text-[10px] text-gray-500 font-black tracking-tighter uppercase mb-1">{r.label}</span>
                                {r.status ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${r.color} shadow-sm`} />
                                        <span className="text-xs text-gray-400 font-black font-mono">{r.status}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center -space-y-1">
                                        <span className={`text-xl font-black font-mono ${r.color}`}>{r.val}</span>
                                        <span className="text-[9px] text-gray-600 font-bold">{r.unit}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col relative bg-[#0b0c10]">
            <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
                <ResponsiveGridLayout
                    className="layout"
                    width={containerWidth || 1200}
                    layouts={{ lg: widgets }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={90}
                    onLayoutChange={onLayoutChange}
                    draggableHandle=".drag-handle"
                    isDraggable={true}
                    isResizable={true}
                    resizeHandles={['s', 'e', 'se']}
                    margin={[20, 20]}
                >
                {widgets.map(w => (
                    <div key={w.i} className="h-full">
                        <Card 
                            title={w.title} 
                            className="h-full border-white/5 transition-all duration-300 shadow-2xl relative group"
                        >
                            {renderWidgetContent(w)}
                        </Card>
                    </div>
                ))}
                </ResponsiveGridLayout>
            </div>



            {/* Legacy Modals */}
            <CalibrationModal isOpen={isCalModalOpen} onClose={() => setIsCalModalOpen(false)} data={data} />
            <SinglePointModal isOpen={isSinglePointModalOpen} onClose={() => setIsSinglePointModalOpen(false)} data={data} />
            
            {/* Calibration Selector Modal */}
            <CalSelectorModal 
                isOpen={isSelectorOpen} 
                onClose={() => setIsSelectorOpen(false)} 
                onSelectSingle={() => { setIsSelectorOpen(false); setIsSinglePointModalOpen(true); }}
                onSelectThree={() => { setIsSelectorOpen(false); setIsCalModalOpen(true); }}
            />

            {/* Twinstop Setpoints Modal */}
            <TwinstopSettingsModal 
                isOpen={isTwinstopModalOpen} 
                onClose={() => setIsTwinstopModalOpen(false)} 
                data={data} 
            />
        </div>
    );
}

const TwinstopSettingsModal = ({ isOpen, onClose, data }) => {
    const [values, setValues] = useState({
        crown: '',
        floor: '',
        offset: ''
    });
    const [isUpdating, setIsUpdating] = useState(false);

    if (!isOpen) return null;

    const handleUpdate = async (type, address) => {
        const val = parseFloat(values[type]);
        if (isNaN(val)) return alert("Please enter a valid number");
        
        setIsUpdating(true);
        try {
            // Using device_id 1 as standard for TWINSTOP PLC
            await writeModbusFloat(1, address, val);
            alert(`${type.toUpperCase()} updated successfully!`);
        } catch (err) {
            console.error(err);
            alert(`Failed to update ${type}: ${err.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#1a1c23] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-cyan-400" />
                        <span className="text-sm font-black text-white uppercase tracking-widest">Twinstop Setpoints</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {[
                        { id: 'crown', label: 'Crownomatic', addr: 496, field: 'Crownomatic' },
                        { id: 'floor', label: 'Flooromatic', addr: 504, field: 'Flooromatic' },
                        { id: 'offset', label: 'Alarm Offset', addr: 512, field: 'AlarmOffset' }
                    ].map((item) => (
                        <div key={item.id} className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{item.label}</span>
                                <span className="text-xs text-cyan-400 font-bold">CURRENT: {(data[item.field] || 0).toFixed(2)}m</span>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="number"
                                    value={values[item.id]}
                                    onChange={(e) => setValues({...values, [item.id]: e.target.value})}
                                    placeholder="Enter value"
                                    className="flex-1 bg-[#0f172a] border border-white/5 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                                />
                                <button 
                                    onClick={() => handleUpdate(item.id, item.addr)}
                                    disabled={isUpdating}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-[10px] font-black text-white uppercase tracking-wider rounded-lg transition-colors active:scale-95"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">Warning: Setpoints affect rig safety shutdown logic.</p>
                </div>
            </div>
        </div>
    );
};

const CalSelectorModal = ({ isOpen, onClose, onSelectSingle, onSelectThree }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#1a1c23] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-black text-white uppercase tracking-widest">Select Calibration Type</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <button 
                        onClick={onSelectSingle}
                        className="w-full flex flex-col items-center gap-2 p-6 bg-[#1e293b] hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 rounded-xl transition-all group"
                    >
                        <div className="w-10 h-10 rounded-full border-[1.5px] border-blue-400/50 flex items-center justify-center group-hover:border-blue-400 transition-colors">
                            <div className="w-5 h-5 rounded-full border-[1.5px] border-blue-400/50 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                            </div>
                        </div>
                        <span className="text-white font-black text-lg uppercase tracking-wider">SINGLE POINT CONFIG</span>
                        <span className="text-gray-500 text-xs font-bold uppercase">Quick Zero / Single Height Assignment</span>
                    </button>
                    
                    <button 
                        onClick={onSelectThree}
                        className="w-full flex flex-col items-center gap-2 p-6 bg-[#1e293b] hover:bg-cyan-600/20 border border-white/5 hover:border-cyan-500/50 rounded-xl transition-all group"
                    >
                        <div className="w-10 h-10 flex items-center justify-center border-[1.5px] border-cyan-400/50 rounded-lg group-hover:border-cyan-400 transition-colors">
                           <Activity className="w-5 h-5 text-cyan-400" />
                        </div>
                        <span className="text-white font-black text-lg uppercase tracking-wider">THREE POINT CALIBRATION</span>
                        <span className="text-gray-500 text-xs font-bold uppercase">Full Range Accuracy Calibration</span>
                    </button>
                </div>
                <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">Calibration affects drilling safety system limits.</p>
                </div>
            </div>
        </div>
    );
};

