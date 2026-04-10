import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { Flame, AlertTriangle, Zap, Target, X, RefreshCw, ChevronRight, Activity, Settings, ArrowDownCircle, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRigData, writeModbusCoil, writeModbusFloat } from '../api';
import RadialGauge from '../components/RadialGauge';
import { ResponsiveGridLayout } from 'react-grid-layout';
import CalibrationModal from '../components/CalibrationModal';
import SinglePointModal from '../components/SinglePointModal';
import SafetyGate from '../components/SafetyGate';
import { canAccessCalibration, getStoredRole } from '../auth';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Reusable Card component with a dark layout props via forwardRef
const Card = React.forwardRef(({ title, children, className = '', contentClassName = '', style, customHeader, dragEnabled = true, ...props }, ref) => (
    <div ref={ref} style={style} className={`bg-[#1a1c23] border border-white/5 rounded-xl shadow-xl flex flex-col overflow-hidden ${className}`} {...props}>
        {title && (
            <div className={`${dragEnabled ? 'drag-handle cursor-move' : ''} bg-white/5 hover:bg-white/10 p-2 border-b border-white/5 flex items-center justify-between transition-colors relative group`}>
                <span className="text-sm text-gray-400 font-bold uppercase tracking-wider w-full text-center">{title}</span>
            </div>
        )}
        <div className={`p-4 flex-1 flex flex-col min-h-0 relative ${contentClassName}`}>
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

// Animated progress bar with high-fidelity glow effect
const ProgressBar = ({ title, value, max, displayValue, gradient, glowColor = 'rgba(6,182,212,0.3)' }) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const isActive = value > 0;
    return (
        <div className="w-full mb-1 group">
            <div className="flex justify-between items-baseline mb-1 px-1">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{title}</span>
                <span className={`text-xl font-mono font-black text-white ${isActive ? 'text-glow-green' : ''} drop-shadow-lg`}>{displayValue}</span>
            </div>
            <div className="h-2.5 w-full bg-slate-900/90 rounded-full overflow-hidden relative border border-white/5">
                <div 
                    className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-1000 ease-in-out relative`}
                    style={{ 
                        width: `${percent}%`,
                        boxShadow: isActive ? `0 0 15px ${glowColor}, 0 0 5px ${glowColor}` : 'none'
                    }}
                >
                    {isActive && (
                        <>
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-pulse rounded-full" />
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/60 blur-[2px]" />
                        </>
                    )}
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

const TWIN_LAYOUT_STORAGE_KEY = 'drillingTwinLayout';

function mergeWidgetsWithSavedLayout(defaultWidgets, savedLayout) {
    if (!Array.isArray(savedLayout) || savedLayout.length === 0) {
        return defaultWidgets;
    }

    const savedById = new Map(savedLayout.map((item) => [item.i || item.id, item]));

    return defaultWidgets.map((widget) => {
        const savedWidget = savedById.get(widget.i);
        if (!savedWidget) {
            return widget;
        }

        return {
            ...widget,
            x: typeof savedWidget.x === 'number' ? savedWidget.x : widget.x,
            y: typeof savedWidget.y === 'number' ? savedWidget.y : widget.y,
            w: typeof savedWidget.w === 'number' ? savedWidget.w : widget.w,
            h: typeof savedWidget.h === 'number' ? savedWidget.h : widget.h,
        };
    });
}

export default function DrillingTwin() {
    const navigate = useNavigate();
    const [data, setData] = useState({});
    const [history, setHistory] = useState([]);
    const [isCalModalOpen, setIsCalModalOpen] = useState(false);
    const [isSinglePointModalOpen, setIsSinglePointModalOpen] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isTwinstopModalOpen, setIsTwinstopModalOpen] = useState(false);
    const [isSafetyGateOpen, setIsSafetyGateOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const role = getStoredRole();
    const calibrationEnabled = canAccessCalibration(role);
    const canEditLayout = role === 'admin';
    const { ref: containerRef, width: containerWidth } = useActualContainerWidth();

    // Initial default widget configuration - Includes metadata for custom parameter mapping
    const defaultWidgets = [
        { id: 'twinstop', i: 'twinstop', type: 'Graphic', title: 'TWINSTOP', x: 0, y: 0, w: 2, h: 5, minW: 2, minH: 3 },
        { id: 'blockHeight', i: 'blockHeight', type: 'DualStatCard', title: '', x: 0, y: 5, w: 2, h: 1, minW: 2, minH: 1 },
        { id: 'slipStatus', i: 'slipStatus', type: 'SlipStatusCard', title: 'SLIP STATUS', x: 0, y: 6, w: 2, h: 1, minW: 2, minH: 1, dataKey: 'SLIPS_STAT' },
        { id: 'hookload', i: 'hookload', type: 'Gauge', title: 'HOOKLOAD', x: 2, y: 0, w: 3, h: 3, minW: 2, minH: 1, dataKey: 'HookLoad', subKey: 'WOV' },
        { id: 'mudPump', i: 'mudPump', type: 'PumpPanel', title: 'MUD PUMP', x: 5, y: 0, w: 4, h: 3, minW: 3, minH: 1 },
        { id: 'mudVol', i: 'mudVol', type: 'MudVolume', title: 'MUD VOLUME', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 1,
          keys: ['PitVolume1', 'PitVolume2', 'PitVolume3', 'TripTank1']
        },
        { id: 'rotary', i: 'rotary', type: 'StatusGrid', title: 'ROTARY PERFORMANCE', x: 2, y: 3, w: 3, h: 2, minW: 2, minH: 1, 
          params: [
              { label: 'RPM', key: 'RPM', color: 'cyan', icon: 'Activity', unit: 'rpm' },
              { label: 'TORQUE', key: 'Torque', color: 'amber', icon: 'Settings', unit: 'kNm' },
              { label: 'RAP', key: 'rap', color: 'cyan', icon: 'Zap', unit: 'psi' },
              { label: 'TONG TRQ', key: 'Pipe Torque', color: 'amber', icon: 'Settings', unit: 'kNm' }
          ]
        },
        { id: 'gas', i: 'gas', type: 'StatusGrid', title: 'GAS MONITORING', x: 5, y: 3, w: 2, h: 2, minW: 2, minH: 1,
          params: [
              { label: 'LEL SS', key: 'LELGasSS', color: 'cyan', icon: 'Flame', unit: '%' },
              { label: 'LEL BN', key: 'LELGasBN', color: 'amber', icon: 'Flame', unit: '%' },
              { label: 'H2S SS', key: 'H2SGasSS', color: 'cyan', icon: 'AlertTriangle', unit: 'ppm' },
              { label: 'H2S BN', key: 'H2SGasBN', color: 'amber', icon: 'AlertTriangle', unit: 'ppm' }
          ]
        },
        { id: 'powerPack', i: 'powerPack', type: 'PowerGrid', title: 'POWER PACK', x: 7, y: 3, w: 2, h: 2, minW: 2, minH: 2 },
        { id: 'bop', i: 'bop', type: 'BOPStatus', title: 'BOP STATUS', x: 9, y: 3, w: 3, h: 2, minW: 2, minH: 2,
          params: [
              { label: 'ANNULAR', key: 'AnnularPressure', color: 'purple', unit: 'psi' },
              { label: 'ACCUM', key: 'AccumPressure', color: 'sky', unit: 'psi' },
              { label: 'MANIFOLD', key: 'ManifoldPressure', color: 'violet', unit: 'psi' }
          ]
        }
    ];

    console.log("🚀 MISSION CONTROL UI v20 ACTIVE");
    
    const [widgets, setWidgets] = useState(() => {
        try {
            const saved = localStorage.getItem(TWIN_LAYOUT_STORAGE_KEY);
            if (!saved) {
                return defaultWidgets;
            }

            return mergeWidgetsWithSavedLayout(defaultWidgets, JSON.parse(saved));
        } catch (error) {
        // Version mismatch or no saved data — use defaults
            console.warn('Unable to restore dashboard layout, using defaults.', error);
            return defaultWidgets;
        }
    });

    const gridLayoutItems = widgets.map(widget => ({
        ...widget,
        static: !canEditLayout,
        isDraggable: canEditLayout,
        isResizable: canEditLayout,
        resizeHandles: canEditLayout ? ['s', 'e', 'se'] : [],
    }));

    const onLayoutChange = (newLayout) => {
        setWidgets(prev => prev.map(w => {
            const layoutItem = newLayout.find(l => l.i === w.i);
            return layoutItem ? { ...w, ...layoutItem } : w;
        }));
    };

    useEffect(() => {
        try {
            const layoutSnapshot = widgets.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
            localStorage.setItem(TWIN_LAYOUT_STORAGE_KEY, JSON.stringify(layoutSnapshot));
        } catch (error) {
            console.warn('Unable to persist dashboard layout.', error);
        }
    }, [widgets]);

    useEffect(() => {
        const fetch = async () => {
            const rigData = await getRigData();
            // Always update state to prevent freezing on old data
            setData(rigData || {});
            if (rigData) {
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


    const handleSafetyAction = (action) => {
        if (!calibrationEnabled) {
            alert('Viewer access is read-only. Sign in as operator or admin to use calibration controls.');
            return;
        }
        setPendingAction(() => action);
        setIsSafetyGateOpen(true);
    };

    const onSafetySuccess = () => {
        setIsSafetyGateOpen(false);
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    // Mud Volumes mapped to WITSML keys
    const mudVolumes = [
        { name: 'Tank 1', value: data.PitVolume1 || data.TANK1_VOL || 0, fill: '#60A5FA' },
        { name: 'Tank 2', value: data.PitVolume2 || data.TANK2_VOL || 0, fill: '#34D399' },
        { name: 'Tank 3', value: data.PitVolume3 || data.TANK3_VOL || 0, fill: '#FBBF24' },
        { name: 'Trip Tank', value: data.TripTank1 || data.TT1_VOL || 0, fill: '#F87171' }
    ];

    // Pump Data mapped to WITSML keys
    const spm1 = data.SPM1 || data.MP1_SPM || 0;
    const spm2 = data.SPM2 || data.MP2_SPM || 0;
    const totalSpm = data.TotalSPM || data.TOT_SPM || (spm1 + spm2);
    const pumpPressure = data.StandpipePressure || data['Standpipe Pressure'] || 0;
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
            case 'MudVolume':
                const mudVolumes = [
                    { name: 'Tank 1', value: data.PitVolume1 || data.MUD_TANK1_VOL || 0, fill: '#38bdf8' },
                    { name: 'Tank 2', value: data.PitVolume2 || data.MUD_TANK2_VOL || 0, fill: '#4ade80' },
                    { name: 'Tank 3', value: data.PitVolume3 || data.MUD_TANK3_VOL || 0, fill: '#fbbf24' },
                    { name: 'Trip Tank', value: data.TripTank1 || data.TRIP_TANK1_VOL || 0, fill: '#f87171' }
                ];
                return (
                    <div className="flex flex-col h-full gap-1 p-1">
                        <div className="flex-1 w-full flex items-end justify-around px-2 mb-1 pt-1 relative overflow-hidden">
                            {mudVolumes.map((tank, i) => (
                                <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end w-1/4 z-10 group">
                                    <div className="w-full flex justify-center items-end" style={{ height: '85%' }}>
                                        <div 
                                            className="w-8 sm:w-10 rounded-t-xl transition-all duration-1000 relative group-hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden" 
                                            style={{ 
                                                height: `${Math.max(5, Math.min(100, (tank.value / 62) * 100))}%`, 
                                                background: `linear-gradient(to top, ${tank.fill}, ${tank.fill}cc)`,
                                                border: `1px solid ${tank.fill}44`,
                                                boxShadow: `0 0 30px ${tank.fill}22, inset 0 0 10px white/10`
                                            }}
                                        >
                                            <div className="absolute inset-y-0 left-0.5 w-1.5 bg-white/20 blur-[1px] rounded-full" />
                                            <div className="absolute top-0 inset-x-0 h-1 bg-white/40 blur-[0.5px]" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-baseline justify-center gap-0.5" style={{ color: tank.fill }}>
                                            <span className="text-lg font-black font-mono leading-none">{(tank.value || 0).toFixed(1)}</span>
                                            <span className="text-[7px] font-bold opacity-60 uppercase">m³</span>
                                        </div>
                                        <span className="block text-[8px] text-gray-500 font-black tracking-widest uppercase mt-0.5">{tank.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex w-full pt-2 pb-1.5 border-t border-white/5 bg-black/20 rounded-xl">
                             {[
                                 { label: 'FLOW RATE', val: data.FlowRate || data.FLOW_RATE_IN || 0, unit: 'gpm', color: 'text-sky-400' },
                                 { label: 'FLOW OUT', val: data.FlowOutPercent || data.FLOW_OUT_PCT || 0, unit: '%', color: 'text-emerald-400' },
                                 { label: 'GAIN/LOSS', val: data.GainLoss || data.VOL_GAIN_LOSS || 0.0, unit: 'bbl', color: 'text-amber-400' }
                             ].map((s, i) => (
                                 <div key={i} className={`flex flex-col items-center flex-1 ${i === 1 ? 'border-x border-white/5' : ''}`}>
                                     <span className="text-[8px] text-gray-500 font-black tracking-widest mb-1 uppercase">{s.label}</span>
                                     <span className={`text-xl font-black font-mono leading-none ${s.color} drop-shadow-lg mb-0.5`}>{s.val.toFixed(1)}</span>
                                     <span className="text-[7px] text-gray-600 font-black uppercase tracking-widest">{s.unit}</span>
                                 </div>
                             ))}
                        </div>
                    </div>
                );
            case 'StatusGrid':
                return (
                    <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full pb-0.5 px-0.5">
                        {(w.params || []).map((p, idx) => {
                            const val = typeof data[p.key] === 'number' ? data[p.key] : 0;
                            // Reverting to simpler colors per screenshot
                            const colorClass = p.color === 'emerald' ? 'text-emerald-400' : p.color === 'amber' ? 'text-amber-500' : 'text-cyan-400';
                            
                            return (
                                <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center relative hover:bg-white/5 transition-all group overflow-hidden">
                                    <span className="text-[11px] text-gray-400 font-black uppercase tracking-widest mb-1.5 z-10">{p.label}</span>
                                    <div className="flex items-baseline gap-1.5 z-10">
                                        <span className={`text-3xl font-mono font-black ${colorClass}`}>
                                            {p.type === 'status'
                                                ? (data[p.key] > 0 ? 'ON' : 'OFF')
                                                : (typeof data[p.key] === 'number' ? data[p.key].toFixed(p.key.includes('TORQUE') || p.key.includes('Trq') ? 0 : 1) : data[p.key] || 0)
                                            }
                                        </span>
                                        {(!p.type && p.unit) && <span className="text-xs text-gray-500 font-black uppercase tracking-widest">{p.unit}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            case 'Graphic':
                if (w.id === 'twinstop') {
                    const rawHeight = data.BlockPosition || data.BLOCK_POS || 0;
                    const bh = data.BlockPosition || data.BLOCK_HEIGHT || 0;
                    const crownLimit = data.Crownomatic || 0;
                    const floorLimit = data.Flooromatic || 0;
                    const isCrownActive = crownLimit > 0 && bh >= crownLimit;
                    const isFloorActive = floorLimit > 0 && bh <= floorLimit;
                    const travelY = 220 - (Math.max(0, Math.min(1, rawHeight / 34)) * 190);
                    return (
                        <div 
                            className={`w-full h-full flex flex-col transition-colors group ${calibrationEnabled ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-90'}`}
                            onClick={() => calibrationEnabled && handleSafetyAction(() => setIsTwinstopModalOpen(true))}
                        >
                            <div className="flex-1 min-h-0 flex items-center justify-center pointer-events-none relative overflow-hidden px-1 py-1">
                                <svg viewBox="20 10 160 275" className="w-full h-full max-h-full drop-shadow-2xl" preserveAspectRatio="xMidYMid meet">
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
                                            <rect x="20" y="32" width="160" height="32" rx="10" fill="rgba(220, 38, 38, 0.4)" stroke="#f43f5e" strokeWidth="2" className="neon-border-red" />
                                            <text x="100" y="50" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="13" fontWeight="900" letterSpacing="2" fontFamily="monospace" className="text-glow-red">
                                                CROWN ALARM
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
                                            <rect x="20" y="242" width="160" height="32" rx="10" fill="rgba(220, 38, 38, 0.4)" stroke="#f43f5e" strokeWidth="2" className="neon-border-red" />
                                            <text x="100" y="260" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="13" fontWeight="900" letterSpacing="2" fontFamily="monospace" className="text-glow-red">
                                                FLOOR ALARM
                                            </text>
                                        </g>
                                    )}

                                    {/* Visual Banner Alert when either is active */}
                                    {(isCrownActive || isFloorActive) && (
                                        <g transform="translate(100, 140)">
                                            <rect x="-60" y="-15" width="120" height="30" rx="4" fill="rgba(244, 63, 94, 0.2)" stroke="#f43f5e" strokeWidth="1" className="animate-pulse" />
                                            <text x="0" y="2" textAnchor="middle" dominantBaseline="middle" fill="#f43f5e" fontSize="10" fontWeight="black" className="text-glow-red tracking-widest">
                                                SAFETY ALERT
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
                                                {(data.BlockPosition || data.BLOCK_POS || 0).toFixed(2)}m
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
                        className={`h-full flex flex-col items-center justify-center p-2 transition-colors group ${calibrationEnabled ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
                        onClick={() => calibrationEnabled && handleSafetyAction(() => setIsSelectorOpen(true))}
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
                             className={`bg-slate-800/30 flex flex-col items-center justify-center rounded-xl border border-white/5 p-1 sm:p-2 transition-colors relative overflow-hidden group ${calibrationEnabled ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
                             onClick={() => calibrationEnabled && handleSafetyAction(() => setIsSelectorOpen(true))}
                         >
                             <span className="text-[9px] sm:text-[10px] text-[#0ea5e9] opacity-80 font-black uppercase tracking-wider mb-1 text-center leading-tight">BH</span>
                             <div className="flex items-baseline gap-1">
                                 <span className="text-xl sm:text-2xl font-black text-[#0ea5e9] font-mono leading-none drop-shadow-md">
                                     {(data.BlockPosition || data.BLOCK_HEIGHT || 0).toFixed(2)}
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
            case 'SlipStatusCard':
                const rawSlipValue = data[w.dataKey] ?? data.SlipStatus ?? data.SLIP_STATUS ?? 0;
                const normalizedSlipValue = typeof rawSlipValue === 'string' ? rawSlipValue.trim().toUpperCase() : rawSlipValue;
                const slipsEngaged =
                    normalizedSlipValue === 1 ||
                    normalizedSlipValue === '1' ||
                    normalizedSlipValue === true ||
                    normalizedSlipValue === 'TRUE' ||
                    normalizedSlipValue === 'ON' ||
                    normalizedSlipValue === 'ENGAGED' ||
                    normalizedSlipValue === 'SET' ||
                    normalizedSlipValue === 'CLOSED';
                const slipLabel = slipsEngaged ? 'ENGAGED' : 'RELEASED';
                const slipToneClass = slipsEngaged
                    ? 'text-amber-400 border-amber-500/25 bg-amber-500/10'
                    : 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10';
                const slipDotClass = slipsEngaged ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                    <div className="h-full px-1 pb-1 w-full">
                        <div className={`h-full rounded-xl border flex items-center justify-between px-4 ${slipToneClass} shadow-inner`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${slipDotClass} shadow-[0_0_10px_currentColor]`} />
                                <span className="text-[11px] text-gray-400 font-black uppercase tracking-[0.22em]">SLIPS</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`text-lg sm:text-xl font-black uppercase tracking-wider ${slipsEngaged ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {slipLabel}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                    {String(rawSlipValue ?? 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            case 'PumpPanel':
                const pressure = data.StandpipePressure || data['Standpipe Pressure'] || 0;
                const pressurePercent = Math.min(100, (pressure / 5000) * 100);
                const totalSpm = (data.SPM1 || data.MP1_SPM || 0) + (data.SPM2 || data.MP2_SPM || 0);
                return (
                    <div className="flex flex-col h-full px-1 gap-2">
                        {/* Modern Pump Status Cards */}
                        <div className="flex gap-2">
                             {[1, 2].map(id => {
                                 const isOn = (data[`SPM${id}`] || data[`MP${id}_SPM`] || 0) > 0;
                                 const activeColor = 'emerald';
                                 const idleColor = 'red';
                                 const themeColor = isOn ? activeColor : idleColor;
                                 
                                 return (
                                     <div key={id} className={`flex-1 p-2.5 rounded-xl border flex items-center gap-3 transition-all duration-500 shadow-inner ${
                                         isOn ? `bg-${activeColor}-500/10 border-${activeColor}-500/30` : `bg-${idleColor}-500/5 border-${idleColor}-500/40`
                                     }`}>
                                         {/* Pulsing indicator */}
                                         <div className="relative">
                                             <div className={`w-2.5 h-2.5 rounded-full ${isOn ? `bg-${activeColor}-500 shadow-[0_0_10px_#10b981]` : `bg-${idleColor}-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]`}`}></div>
                                             {isOn && <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full bg-${activeColor}-500 animate-ping opacity-40`} />}
                                         </div>
                                         <div className="flex flex-col">
                                             <span className={`text-xs font-black uppercase tracking-widest ${isOn ? 'text-white/60' : `text-${idleColor}-400/60`}`}>PUMP {id}</span>
                                             <span className={`text-sm font-black uppercase ${isOn ? `text-${activeColor}-400` : `text-${idleColor}-400`}`}>
                                                 {isOn ? 'Active' : 'Idle'}
                                             </span>
                                         </div>
                                         <div className="ml-auto flex flex-col items-end">
                                             <div className="flex items-baseline gap-1">
                                                 <span className={`text-4xl font-mono font-black transition-all ${
                                                     isOn ? 'text-emerald-400 text-glow-green' : 'text-gray-400/80'
                                                 }`}>
                                                     {(data[`SPM${id}`] || data[`MP${id}_SPM`] || 0).toFixed(0)}
                                                 </span>
                                                 <span className={`text-[10px] font-black uppercase ${isOn ? 'text-white/40' : 'text-gray-600'}`}>spm</span>
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })}
                        </div>

                        {/* Modern Standpipe Pressure Panel - Hero Display */}
                        <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group">
                             {/* Ambient background glow for high pressure */}
                             {pressure > 3000 && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-sky-500/5 animate-pulse" />}
                             
                             <div className="flex justify-between items-end mb-4 relative z-10">
                                 <div className="flex flex-col">
                                     <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-2">Standpipe Pressure</span>
                                     <div className="h-2 bg-slate-900/90 rounded-full overflow-hidden border border-white/5 w-48 relative">
                                         <div 
                                             className="h-full bg-gradient-to-r from-sky-600 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                                             style={{ 
                                                 width: `${pressurePercent}%`,
                                                 boxShadow: pressure > 0 ? '0 0 15px rgba(56,189,248,0.5)' : 'none'
                                             }}
                                         />
                                         {pressure > 0 && <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-pulse" />}
                                     </div>
                                 </div>
                                 <div className="flex items-baseline gap-2">
                                     <span className={`text-5xl font-mono font-black tabular-nums tracking-tighter transition-colors duration-500 ${
                                         pressure > 4000 ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'text-sky-400 text-glow-blue'
                                     }`}>
                                         {pressure.toFixed(0)}
                                     </span>
                                     <span className="text-xs font-black text-gray-500 uppercase tracking-widest">psi</span>
                                 </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4 relative z-10 border-t border-white/5 pt-3">
                                 <div className="flex flex-col items-center border-r border-white/5">
                                     <span className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Total Strokes</span>
                                     <span className="text-3xl font-mono font-black text-emerald-400">{Math.floor(data.TotalStrokes || data.TOTAL_STROKES || 0).toLocaleString()}</span>
                                 </div>
                                 <div className="flex flex-col items-center">
                                     <span className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Total SPM</span>
                                     <span className="text-3xl font-mono font-black text-emerald-400">{totalSpm.toFixed(0)}</span>
                                 </div>
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
                            const isRunning = p.rpm > 500;
                            const statusOpacity = isRunning ? 'opacity-100' : 'opacity-60 grayscale-[40%] brightness-75';
                            const textColor = 'text-slate-900';
                            const labelColor = 'text-slate-900/60';
                            
                            return (
                                <div 
                                    key={p.id} 
                                    className={`${baseColor} ${statusOpacity} ${textColor} rounded-xl flex flex-col items-center justify-center shadow-lg transition-all duration-1000 border border-white/10 cursor-pointer`}
                                    onClick={() => navigate(`/engine/${p.id}`)}
                                >
                                    <span className={`${labelColor} text-[10px] font-black uppercase tracking-widest mb-1`}>{p.name.toUpperCase()}</span>
                                    <div className="flex flex-col items-center justify-center">
                                        <span className={`text-3xl font-black font-mono ${isRunning ? 'text-nov-accent' : 'text-red-500'}`}>
                                            {isRunning ? 'ON' : 'OFF'}
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
                    { label: 'ANNULAR', val: 0, unit: 'PSI', color: 'text-cyan-400' },
                    { label: 'ACCUM', val: 0, unit: 'PSI', color: 'text-cyan-400' },
                    { label: 'MANIFOLD', val: 0, unit: 'PSI', color: 'text-cyan-400' }
                ];

                return (
                    <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full pb-1 px-1">
                        {rams.map((r, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-1.5 flex flex-col items-center justify-center">
                                <span className="text-xs text-gray-500 font-black uppercase mb-1.5">{r.label}</span>
                                {r.status ? (
                                    <span className="text-lg font-black text-white/90">{r.status}</span>
                                ) : (
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-xl font-black font-mono ${r.color}`}>{r.val}</span>
                                        <span className="text-[9px] text-gray-600 font-black uppercase">{r.unit}</span>
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
            <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-0 pb-2 custom-scrollbar">
                <ResponsiveGridLayout
                    key={canEditLayout ? 'layout-admin' : 'layout-locked'}
                    className="layout"
                    width={containerWidth || 1200}
                    layouts={{ lg: gridLayoutItems }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={90}
                    onLayoutChange={canEditLayout ? onLayoutChange : () => {}}
                    draggableHandle={canEditLayout ? ".drag-handle" : undefined}
                    isDraggable={canEditLayout}
                    isResizable={canEditLayout}
                    resizeHandles={canEditLayout ? ['s', 'e', 'se'] : []}
                    margin={[8, 6]}
                >
                {gridLayoutItems.map(w => (
                    <div key={w.i} className="h-full">
                        <Card 
                            title={w.title} 
                            dragEnabled={canEditLayout}
                            contentClassName={w.id === 'twinstop' ? 'px-2 pt-2 pb-1' : ''}
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

            <SafetyGate 
                isOpen={isSafetyGateOpen} 
                onClose={() => setIsSafetyGateOpen(false)} 
                onSuccess={onSafetySuccess} 
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
    const [showSafetyGate, setShowSafetyGate] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState(null);

    if (!isOpen) return null;

    const handlePreUpdate = (type, address) => {
        const val = parseFloat(values[type]);
        if (isNaN(val)) return alert("Please enter a valid number");

        setPendingUpdate({ type, address, val });
        setShowSafetyGate(true);
    };

    const handleUpdate = async (pin) => {
        if (!pendingUpdate) return;
        const { type, address, val } = pendingUpdate;
        setPendingUpdate(null);
        setShowSafetyGate(false);

        setIsUpdating(true);
        try {
            // Using device_id 1 as standard for TWINSTOP PLC
            await writeModbusFloat(1, address, val, pin);
            alert(`${type.toUpperCase()} updated successfully!`);
        } catch (err) {
            console.error(err);
            alert(`Failed to update ${type}: ${err.response?.data?.detail || err.message}`);
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
                                    onClick={() => handlePreUpdate(item.id, item.addr)}
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

            <SafetyGate 
                isOpen={showSafetyGate}
                onClose={() => setShowSafetyGate(false)}
                onSuccess={handleUpdate}
                title="Calibration Safety Lock"
            />
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
