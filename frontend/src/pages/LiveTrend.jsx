import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Legend, CartesianGrid, Brush
} from 'recharts';
import { TrendingUp, Download, ChevronDown, Check, Clock, Calendar, RefreshCw, X, Loader2 } from 'lucide-react';
import { getRigHistory, getRigHistoryRange, exportExcel } from '../api';

/* ── All available parameters ────────────────────────────── */
const ALL_PARAMS = [
    { key: 'BitDepth', label: 'Bit Depth', unit: 'm', group: 'Depth' },
    { key: 'Depth', label: 'Hole Depth', unit: 'm', group: 'Depth' },
    { key: 'BlockPosition', label: 'Block Height', unit: 'm', group: 'Depth' },
    { key: 'WOB', label: 'Weight on Bit', unit: 'ton', group: 'Drilling' },
    { key: 'ROP', label: 'Rate of Penetration', unit: 'ft/hr', group: 'Drilling' },
    { key: 'RPM', label: 'Rotary RPM', unit: 'rpm', group: 'Drilling' },
    { key: 'Torque', label: 'Rotary Torque', unit: 'ft-lb', group: 'Drilling' },
    { key: 'TopDriveRPM', label: 'Top Drive RPM', unit: 'rpm', group: 'Drilling' },
    { key: 'TopDriveTorque', label: 'Top Drive Torque', unit: 'ft-lb', group: 'Drilling' },
    { key: 'HookLoad', label: 'Hook Load', unit: 'ton', group: 'Drilling' },
    { key: 'StringSpeed', label: 'String Speed', unit: 'ft/min', group: 'Drilling' },
    { key: 'StandpipePressure', label: 'Pump Pressure', unit: 'psi', group: 'Hydraulics' },
    { key: 'DiffPress', label: 'Diff Pressure', unit: 'psi', group: 'Hydraulics' },
    { key: 'SPM1', label: 'Pump SPM 1', unit: 'spm', group: 'Hydraulics' },
    { key: 'SPM2', label: 'Pump SPM 2', unit: 'spm', group: 'Hydraulics' },
    { key: 'SPM3', label: 'Pump SPM 3', unit: 'spm', group: 'Hydraulics' },
    { key: 'TotalSPM', label: 'Total SPM', unit: 'spm', group: 'Hydraulics' },
    { key: 'TotalStrokes', label: 'Total Strokes', unit: 'strokes', group: 'Hydraulics' },
    { key: 'FlowRate', label: 'Flow In Rate', unit: 'gpm', group: 'Mud' },
    { key: 'FlowOutPercent', label: 'Flow Out %', unit: '%', group: 'Mud' },
    { key: 'TotalMudVolume', label: 'Total Mud Volume', unit: 'm³', group: 'Mud' },
    { key: 'PitVolume1', label: 'Pit Volume 1', unit: 'm³', group: 'Mud' },
    { key: 'PitVolume2', label: 'Pit Volume 2', unit: 'm³', group: 'Mud' },
    { key: 'PitVolume3', label: 'Pit Volume 3', unit: 'm³', group: 'Mud' },
    { key: 'PitVolume4', label: 'Pit Volume 4', unit: 'm³', group: 'Mud' },
    { key: 'GainLoss', label: 'Gain/Loss', unit: 'm³', group: 'Mud' },
    { key: 'TripTank1', label: 'Trip Tank 1', unit: 'bbl', group: 'Mud' },
    { key: 'TripTank2', label: 'Trip Tank 2', unit: 'bbl', group: 'Mud' },
    { key: 'TripTankGL', label: 'Trip Tank GL', unit: 'bbl', group: 'Mud' },
    { key: 'TonMile', label: 'Ton Mile', unit: 'ton·mi', group: 'Other' },
    { key: 'H2SGas', label: 'H₂S Gas', unit: 'ppm', group: 'Other' },
    { key: 'SlipStatus', label: 'Slip Status', unit: '-', group: 'Other' },
];

const PARAM_GROUPS = [...new Set(ALL_PARAMS.map(p => p.group))];

const DEFAULT_SELECTED = ['WOB', 'ROP', 'RPM', 'HookLoad'];

/* ── Color palette for chart lines ────────────────────── */
const LINE_COLORS = [
    '#00A3E0', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9', '#D946EF',
    '#22D3EE', '#FBBF24', '#FB923C', '#4ADE80', '#A78BFA',
];

/* ── Quick time range options ────────────────────────── */
const TIME_RANGES = [
    { label: '5m', value: '-5m', minutes: 5 },
    { label: '15m', value: '-15m', minutes: 15 },
    { label: '30m', value: '-30m', minutes: 30 },
    { label: '1h', value: '-1h', minutes: 60 },
    { label: '6h', value: '-6h', minutes: 360 },
    { label: '12h', value: '-12h', minutes: 720 },
    { label: '24h', value: '-24h', minutes: 1440 },
];

/* ── Helpers ─────────────────────────────────────────── */
function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDateTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function toLocalDatetimeString(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function load(key, def) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
}

/* ── Custom Tooltip ─────────────────────────────────── */
function CustomTooltip({ active, payload, label, selectedParams }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl p-3 shadow-2xl max-w-xs">
            <p className="text-[11px] font-mono text-gray-400 mb-2 border-b border-white/10 pb-1.5">
                {formatDateTime(label)}
            </p>
            <div className="space-y-1">
                {payload.map((entry, idx) => {
                    const param = ALL_PARAMS.find(p => p.key === entry.dataKey);
                    return (
                        <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="text-gray-300">{param?.label || entry.dataKey}</span>
                            </div>
                            <span className="font-mono font-bold text-white">
                                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                                <span className="text-gray-500 text-xs ml-1">{param?.unit}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ═════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                      */
/* ═════════════════════════════════════════════════════ */
export default function LiveTrend() {
    // Parameter selection
    const [selectedKeys, setSelectedKeys] = useState(() => load('liveTrendParams_v2', DEFAULT_SELECTED));
    const [showParamPanel, setShowParamPanel] = useState(false);
    const paramPanelRef = useRef(null);

    // Data & time range
    const [chartData, setChartData] = useState([]);
    const [timeRange, setTimeRange] = useState('-5m');
    const [isCustomRange, setIsCustomRange] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [showCustomPicker, setShowCustomPicker] = useState(false);

    // States
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Persist selected params
    useEffect(() => {
        localStorage.setItem('liveTrendParams_v2', JSON.stringify(selectedKeys));
    }, [selectedKeys]);

    // Click-outside to close param panel
    useEffect(() => {
        const handler = (e) => {
            if (paramPanelRef.current && !paramPanelRef.current.contains(e.target)) {
                setShowParamPanel(false);
            }
        };
        if (showParamPanel) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showParamPanel]);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let rows;
            if (isCustomRange && customStart && customEnd) {
                const startISO = new Date(customStart).toISOString();
                const endISO = new Date(customEnd).toISOString();
                rows = await getRigHistoryRange(startISO, endISO);
            } else {
                rows = await getRigHistory(timeRange);
            }
            setChartData(rows || []);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Fetch trend data error:', err);
        }
        setLoading(false);
    }, [timeRange, isCustomRange, customStart, customEnd]);

    // Initial fetch + auto-refresh
    useEffect(() => {
        fetchData();
        if (autoRefresh && !isCustomRange) {
            const interval = setInterval(fetchData, 3000);
            return () => clearInterval(interval);
        }
    }, [fetchData, autoRefresh, isCustomRange]);

    // Time range selection
    const handleQuickRange = (range) => {
        setIsCustomRange(false);
        setShowCustomPicker(false);
        setTimeRange(range);
        setAutoRefresh(true);
    };

    const handleCustomApply = () => {
        if (!customStart || !customEnd) return;
        setIsCustomRange(true);
        setAutoRefresh(false);
        setShowCustomPicker(false);
    };

    // Parameter toggle
    const toggleParam = (key) => {
        setSelectedKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const selectGroup = (group) => {
        const groupKeys = ALL_PARAMS.filter(p => p.group === group).map(p => p.key);
        const allSelected = groupKeys.every(k => selectedKeys.includes(k));
        if (allSelected) {
            setSelectedKeys(prev => prev.filter(k => !groupKeys.includes(k)));
        } else {
            setSelectedKeys(prev => [...new Set([...prev, ...groupKeys])]);
        }
    };

    // Excel export
    const handleExport = async () => {
        setExporting(true);
        try {
            let startDate, endDate;
            if (isCustomRange && customStart && customEnd) {
                startDate = new Date(customStart).toISOString();
                endDate = new Date(customEnd).toISOString();
            } else {
                // Default: export visible range
                const currentRange = TIME_RANGES.find(t => t.value === timeRange);
                endDate = new Date().toISOString();
                startDate = new Date(Date.now() - (currentRange?.minutes || 5) * 60000).toISOString();
            }
            const success = await exportExcel(startDate, endDate, selectedKeys.length > 0 ? selectedKeys : null);
            if (!success) alert('Export failed. Please try again.');
        } catch {
            alert('Export failed. Please try again.');
        }
        setExporting(false);
    };

    // Export 6 months
    const handleExport6Months = async () => {
        setExporting(true);
        try {
            const endDate = new Date().toISOString();
            const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
            const success = await exportExcel(startDate, endDate, selectedKeys.length > 0 ? selectedKeys : null);
            if (!success) alert('Export failed. No data may exist for this range.');
        } catch {
            alert('Export failed. Please try again.');
        }
        setExporting(false);
    };

    const selectedParams = ALL_PARAMS.filter(p => selectedKeys.includes(p.key));

    // Determine time format based on range
    const isLongRange = isCustomRange || ['-6h', '-12h', '-24h'].includes(timeRange);
    const tickFormatter = isLongRange ? formatDateTime : formatTime;

    return (
        <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 120px)' }}>
            {/* ── HEADER ─────────────────────────── */}
            <header className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Live Trends</h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Real-time parameter monitoring
                            {lastUpdate && (
                                <span className="ml-2 text-gray-500">
                                    Last update: {lastUpdate.toLocaleTimeString()}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Auto-refresh indicator */}
                <div className="flex items-center gap-3">
                    {autoRefresh && !isCustomRange && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-xs text-green-400 font-medium">LIVE</span>
                        </div>
                    )}
                    {isCustomRange && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <Calendar size={12} className="text-amber-400" />
                            <span className="text-xs text-amber-400 font-medium">HISTORICAL</span>
                        </div>
                    )}
                </div>
            </header>

            {/* ── TOOLBAR ────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                {/* Parameter Selector */}
                <div className="relative" ref={paramPanelRef}>
                    <button
                        onClick={() => setShowParamPanel(!showParamPanel)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-white/10 hover:border-white/20 transition-all text-sm text-white hover:shadow-lg hover:shadow-black/20"
                    >
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>{selectedKeys.length} Parameter{selectedKeys.length !== 1 ? 's' : ''}</span>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${showParamPanel ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Parameter Dropdown Panel */}
                    {showParamPanel && (
                        <div className="absolute top-full left-0 mt-2 w-[420px] bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in">
                            <div className="p-3 border-b border-white/5 flex items-center justify-between">
                                <span className="text-sm font-bold text-white">Select Parameters</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedKeys(ALL_PARAMS.map(p => p.key))}
                                        className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                                    >All</button>
                                    <button
                                        onClick={() => setSelectedKeys([])}
                                        className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                                    >None</button>
                                    <button
                                        onClick={() => setSelectedKeys([...DEFAULT_SELECTED])}
                                        className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                                    >Default</button>
                                </div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                                {PARAM_GROUPS.map(group => {
                                    const groupParams = ALL_PARAMS.filter(p => p.group === group);
                                    const allInGroupSelected = groupParams.every(p => selectedKeys.includes(p.key));
                                    return (
                                        <div key={group} className="mb-2">
                                            <button
                                                onClick={() => selectGroup(group)}
                                                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-white px-2 py-1.5 w-full transition-colors"
                                            >
                                                <span
                                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${allInGroupSelected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'}`}
                                                >
                                                    {allInGroupSelected && <Check size={10} className="text-white" />}
                                                </span>
                                                {group}
                                            </button>
                                            <div className="grid grid-cols-2 gap-0.5">
                                                {groupParams.map(param => {
                                                    const isSelected = selectedKeys.includes(param.key);
                                                    const colorIdx = selectedKeys.indexOf(param.key);
                                                    return (
                                                        <button
                                                            key={param.key}
                                                            onClick={() => toggleParam(param.key)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isSelected ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-300'}`}
                                                        >
                                                            <span
                                                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${isSelected ? 'border-transparent' : 'border-gray-600'}`}
                                                                style={isSelected ? { backgroundColor: LINE_COLORS[colorIdx % LINE_COLORS.length] } : {}}
                                                            >
                                                                {isSelected && <Check size={10} className="text-white" />}
                                                            </span>
                                                            <span className="truncate">{param.label}</span>
                                                            <span className="text-[10px] text-gray-600 ml-auto">{param.unit}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-8 bg-white/10" />

                {/* Quick Time Range Buttons */}
                <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1 border border-white/5">
                    <Clock size={14} className="text-gray-500 ml-2 mr-1" />
                    {TIME_RANGES.map(t => (
                        <button
                            key={t.value}
                            onClick={() => handleQuickRange(t.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!isCustomRange && timeRange === t.value
                                ? 'bg-cyan-500/20 text-cyan-400 shadow-inner shadow-cyan-500/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Custom Range */}
                <button
                    onClick={() => {
                        setShowCustomPicker(!showCustomPicker);
                        if (!customStart) {
                            const now = new Date();
                            const oneHourAgo = new Date(now.getTime() - 3600000);
                            setCustomStart(toLocalDatetimeString(oneHourAgo));
                            setCustomEnd(toLocalDatetimeString(now));
                        }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${isCustomRange
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-slate-800/80 border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                        }`}
                >
                    <Calendar size={14} />
                    <span>Custom Range</span>
                </button>

                {/* Separator */}
                <div className="w-px h-8 bg-white/10" />

                {/* Refresh */}
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2.5 rounded-xl bg-slate-800/80 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all disabled:opacity-50"
                    title="Refresh data"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>

                {/* Export Buttons — pushed right */}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting || selectedKeys.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 transition-all text-sm font-medium disabled:opacity-40"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>Export Visible</span>
                    </button>
                    <button
                        onClick={handleExport6Months}
                        disabled={exporting || selectedKeys.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-all text-sm font-medium disabled:opacity-40"
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>Export 6 Months</span>
                    </button>
                </div>
            </div>

            {/* ── CUSTOM DATE PICKER ─────────────── */}
            {showCustomPicker && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-800/60 border border-white/10 flex-shrink-0 animate-in">
                    <Calendar size={16} className="text-gray-400" />
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 font-medium">From</label>
                        <input
                            type="datetime-local"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 font-medium">To</label>
                        <input
                            type="datetime-local"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                        />
                    </div>
                    <button
                        onClick={handleCustomApply}
                        disabled={!customStart || !customEnd}
                        className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm transition-colors disabled:opacity-40"
                    >
                        Apply Range
                    </button>
                    {isCustomRange && (
                        <button
                            onClick={() => { setIsCustomRange(false); setAutoRefresh(true); setShowCustomPicker(false); handleQuickRange('-5m'); }}
                            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-colors flex items-center gap-1"
                        >
                            <X size={14} /> Reset to Live
                        </button>
                    )}
                </div>
            )}

            {/* ── CHART AREA ─────────────────────── */}
            <div className="flex-1 min-h-0 rounded-2xl bg-slate-800/40 border border-white/5 p-4 relative overflow-hidden">
                {loading && chartData.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={32} className="animate-spin text-cyan-400" />
                            <span className="text-sm text-gray-400">Loading trend data...</span>
                        </div>
                    </div>
                )}

                {selectedKeys.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center">
                            <TrendingUp size={48} className="text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">Select parameters to display trends</p>
                            <button
                                onClick={() => setShowParamPanel(true)}
                                className="mt-3 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                            >
                                Choose Parameters
                            </button>
                        </div>
                    </div>
                )}

                {chartData.length === 0 && !loading && selectedKeys.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center">
                            <Clock size={48} className="text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">No data available for this time range</p>
                        </div>
                    </div>
                )}

                {chartData.length > 0 && selectedKeys.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                                dataKey="time"
                                stroke="#4B5563"
                                tick={{ fill: '#6B7280', fontSize: 11 }}
                                tickFormatter={tickFormatter}
                                minTickGap={60}
                            />
                            <YAxis
                                stroke="#4B5563"
                                tick={{ fill: '#6B7280', fontSize: 11 }}
                                width={60}
                            />
                            <Tooltip
                                content={<CustomTooltip selectedParams={selectedParams} />}
                                animationDuration={150}
                            />
                            <Legend
                                wrapperStyle={{ paddingTop: '10px' }}
                                formatter={(value) => {
                                    const param = ALL_PARAMS.find(p => p.key === value);
                                    return <span className="text-xs text-gray-300">{param?.label || value}</span>;
                                }}
                            />
                            {selectedParams.map((param, idx) => (
                                <Line
                                    key={param.key}
                                    type="monotone"
                                    dataKey={param.key}
                                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                    connectNulls
                                    isAnimationActive={false}
                                />
                            ))}
                            {chartData.length > 50 && (
                                <Brush
                                    dataKey="time"
                                    height={30}
                                    stroke="#00A3E0"
                                    fill="rgba(0,0,0,0.3)"
                                    tickFormatter={formatTime}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── SELECTED PARAM CHIPS ───────────── */}
            {selectedKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                    {selectedParams.map((param, idx) => (
                        <span
                            key={param.key}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-default"
                            style={{
                                borderColor: `${LINE_COLORS[idx % LINE_COLORS.length]}33`,
                                backgroundColor: `${LINE_COLORS[idx % LINE_COLORS.length]}10`,
                                color: LINE_COLORS[idx % LINE_COLORS.length],
                            }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: LINE_COLORS[idx % LINE_COLORS.length] }} />
                            {param.label}
                            <button
                                onClick={() => toggleParam(param.key)}
                                className="ml-0.5 hover:opacity-70 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* ── Inline Styles for animations ──── */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
                .animate-in { animation: slideIn 0.2s ease-out; }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
