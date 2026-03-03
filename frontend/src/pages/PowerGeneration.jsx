import React, { useState, useEffect } from 'react';
import { Zap, Thermometer, Droplets, Gauge, Clock, Battery, Fuel, Settings, Activity } from 'lucide-react';
import { getRigSensors, getRigData } from '../api';
import RadialGauge from '../components/RadialGauge';

/* ───────────────────────────────────────────────
   CAT 3512 Engine Specifications (from nameplate)
   ─────────────────────────────────────────────── */
const ENGINE_SPEC = {
    manufacturer: 'CATERPILLAR INC.',
    model: '3512',
    serial: 'S2G00313',
    year: 2010,
    maxRPM: 1900,
    bore: '170 mm',
    stroke: '190 mm',
    cylinders: 12,
    type: '4-Stroke Turbocharged After Cooled',
    displacement: '51.8 L',   // 12 × π/4 × 0.17² × 0.19 ≈ 51.8L
    ratedPower: '1100 kW',    // CAT 3512 rated
    iso: 'ISO 9000 Compliant',
};

/* ── Parameter thresholds for status coloring ──── */
const getStatus = (key, value) => {
    const thresholds = {
        RPM: { warn: 1700, crit: 1850, unit: 'rpm' },
        OilPressure: { warn: 50, crit: 30, unit: 'psi', invert: true },
        CoolantTemp: { warn: 90, crit: 100, unit: '°C' },
        ExhaustTemp: { warn: 550, crit: 650, unit: '°C' },
        OilTemp: { warn: 100, crit: 115, unit: '°C' },
        FuelRate: { warn: 200, crit: 280, unit: 'L/hr' },
        BatteryVoltage: { warn: 23, crit: 22, unit: 'V', invert: true },
        BoostPressure: { warn: 200, crit: 250, unit: 'kPa' },
        HoursRun: { warn: 99999, crit: 999999, unit: 'hrs' },
        LoadPercent: { warn: 75, crit: 90, unit: '%' },
        kWOutput: { warn: 800, crit: 1000, unit: 'kW' },
        CoolantPressure: { warn: 100, crit: 120, unit: 'kPa' },
        InstFuelCons: { warn: 200, crit: 280, unit: 'L/hr' },
        TotalFuelCons: { warn: 99999, crit: 999999, unit: 'L' },
        OverallPowerFactor: { warn: 0.8, crit: 0.7, unit: '', invert: true },
        TotalReactivePower: { warn: 500, crit: 700, unit: 'kVAR' },
        TotalPercentKW: { warn: 75, crit: 90, unit: '%' },
    };
    const t = thresholds[key];
    if (!t) return { color: 'text-cyan-400', bg: 'bg-cyan-400/10', status: 'normal' };
    if (t.invert) {
        if (value < t.crit) return { color: 'text-red-400', bg: 'bg-red-400/10', status: 'critical' };
        if (value < t.warn) return { color: 'text-yellow-400', bg: 'bg-yellow-400/10', status: 'warning' };
    } else {
        if (value > t.crit) return { color: 'text-red-400', bg: 'bg-red-400/10', status: 'critical' };
        if (value > t.warn) return { color: 'text-yellow-400', bg: 'bg-yellow-400/10', status: 'warning' };
    }
    return { color: 'text-green-400', bg: 'bg-green-400/10', status: 'normal' };
};

/* ── Parameters displayed per engine ─────────── */
const ENGINE_PARAMS = [
    { key: 'RPM', label: 'ENGINE RPM', unit: 'rpm', icon: Gauge },
    { key: 'kWOutput', label: 'POWER OUTPUT', unit: 'kW', icon: Zap },
    { key: 'LoadPercent', label: 'LOAD', unit: '%', icon: Activity },
    { key: 'OilPressure', label: 'OIL PRESSURE', unit: 'psi', icon: Droplets },
    { key: 'OilTemp', label: 'OIL TEMP', unit: '°C', icon: Thermometer },
    { key: 'CoolantTemp', label: 'COOLANT TEMP', unit: '°C', icon: Thermometer },
    { key: 'CoolantPressure', label: 'COOLANT PRESS', unit: 'kPa', icon: Droplets },
    { key: 'ExhaustTemp', label: 'EXHAUST TEMP', unit: '°C', icon: Thermometer },
    { key: 'FuelRate', label: 'FUEL RATE', unit: 'L/hr', icon: Fuel },
    { key: 'BoostPressure', label: 'BOOST PRESSURE', unit: 'kPa', icon: Gauge },
    { key: 'BatteryVoltage', label: 'BATTERY', unit: 'V', icon: Battery },
    { key: 'HoursRun', label: 'HOURS RUN', unit: 'hrs', icon: Clock },
    { key: 'InstFuelCons', label: 'INST FUEL CONS', unit: 'L/hr', icon: Fuel },
    { key: 'TotalFuelCons', label: 'TOTAL FUEL', unit: 'L', icon: Fuel },
    { key: 'OverallPowerFactor', label: 'POWER FACTOR', unit: '', icon: Activity },
    { key: 'TotalReactivePower', label: 'REACTIVE POWER', unit: 'kVAR', icon: Zap },
    { key: 'TotalPercentKW', label: 'PERCENT KW', unit: '%', icon: Activity },
];

/* ── Simulated data for power packs (until real data arrives) ── */
function simulateEngine(id, rigData) {
    // Try to get real sensor data, fall through to simulated values
    const base = {
        RPM: 0, kWOutput: 0, LoadPercent: 0,
        OilPressure: 0, OilTemp: 0,
        CoolantTemp: 0, CoolantPressure: 0,
        ExhaustTemp: 0, FuelRate: 0,
        BoostPressure: 0, BatteryVoltage: 0, HoursRun: 0,
        InstFuelCons: 0, TotalFuelCons: 0,
        OverallPowerFactor: 0, TotalReactivePower: 0, TotalPercentKW: 0,
    };

    if (rigData) {
        // Map any available fields from rig data
        const prefix = `PP${id}_`;
        Object.keys(base).forEach(k => {
            if (rigData[prefix + k] !== undefined) base[k] = rigData[prefix + k];
            else if (id === 1 && rigData[k] !== undefined) base[k] = rigData[k]; // fallback to main data for PP1
        });
        // Use RPM from sensors if available
        if (rigData.RPM && id === 1) base.RPM = rigData.RPM;
    }

    return base;
}

/* ── Power Pack Detail Component ───────────────── */
function PowerPackDetail({ id, data, isOnline }) {
    const statusColor = isOnline ? 'border-green-500/30' : 'border-gray-700';
    const statusDot = isOnline ? 'bg-green-500' : 'bg-gray-600';
    const statusText = isOnline ? 'ONLINE' : 'STANDBY';
    const rpm = data.RPM || 0;

    return (
        <div className={`card border ${statusColor} rounded-xl overflow-hidden mt-4 animate-in fade-in zoom-in-95 duration-300 mb-6 flex-shrink-0`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-slate-800/60">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusDot} ${isOnline ? 'animate-pulse' : ''}`} />
                    <span className="font-bold text-white text-lg tracking-wider">POWER PACK {id} DETAILS</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-500'}`}>
                        {statusText}
                    </span>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row min-h-0 bg-slate-900/50">
                {/* Left Side: Gauge and Core Info */}
                <div className="lg:w-1/3 p-6 border-r border-white/5 flex flex-col items-center justify-center gap-6">
                    <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-white/5 w-full justify-center">
                        <img src="/cat_engine.png" alt="CAT 3512 Engine" className="w-24 h-16 object-contain bg-white/5 p-2 rounded border border-white/10" />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-yellow-500 font-bold">CAT</span>
                                <span className="text-lg text-white font-bold">{ENGINE_SPEC.model}</span>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">S/N: {ENGINE_SPEC.serial}</span>
                        </div>
                    </div>

                    <div style={{ width: '220px', height: '160px' }}>
                        <RadialGauge
                            value={rpm}
                            min={0} max={2000}
                            majorStep={500} minorStep={100}
                            label="ENGINE RPM"
                            unit="RPM"
                            size="md"
                        />
                    </div>
                </div>

                {/* Right Side: Parameter Grid */}
                <div className="lg:w-2/3 p-6">
                    <h3 className="text-sm text-gray-400 font-bold mb-4 uppercase tracking-widest border-b border-white/5 pb-2">Live Parameters</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {ENGINE_PARAMS.map((param) => {
                            const val = data[param.key] ?? 0;
                            const { color, bg } = getStatus(param.key, val);
                            const Icon = param.icon;
                            return (
                                <div key={param.key} className="bg-slate-800/40 rounded-lg p-3 border border-white/5 hover:bg-slate-700/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`p-1.5 rounded-md ${bg}`}>
                                            <Icon size={14} className={color} />
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{param.label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <span className={`font-mono font-bold text-xl ${color}`}>
                                            {typeof val === 'number' ? (val > 1000 ? val.toFixed(0) : val.toFixed(1)) : val}
                                        </span>
                                        <span className="text-xs text-gray-500 font-medium">{param.unit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Main Page Component ─────────────────────── */
export default function PowerGeneration() {
    const [rigData, setRigData] = useState(null);
    const [expandedEngineId, setExpandedEngineId] = useState(1); // Default to first engine expanded

    useEffect(() => {
        const fetchData = async () => {
            const d = await getRigData();
            if (d) setRigData(d);
        };
        fetchData();
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, []);

    const engines = [1, 2, 3, 4].map(id => {
        const engineData = simulateEngine(id, rigData);
        return {
            id,
            data: engineData,
            isOnline: (engineData.RPM || 0) > 0 || (engineData.kWOutput || 0) > 10,
        };
    });

    // Totals
    const totalKW = engines.reduce((sum, e) => sum + (e.data.kWOutput || 0), 0);
    const totalFuel = engines.reduce((sum, e) => sum + (e.data.FuelRate || 0), 0);
    const avgLoad = engines.filter(e => e.isOnline).length > 0
        ? engines.filter(e => e.isOnline).reduce((sum, e) => sum + (e.data.LoadPercent || 0), 0) / engines.filter(e => e.isOnline).length
        : 0;
    const onlineCount = engines.filter(e => e.isOnline).length;

    const selectedEngine = engines.find(e => e.id === expandedEngineId);

    return (
        <div className="flex flex-col gap-4 -mt-4 w-full h-full overflow-y-auto overflow-x-hidden p-1">
            {/* Header Summary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
                {/* Engine Spec */}
                <div className="col-span-2 md:col-span-1 card border border-white/5 px-4 py-3 bg-slate-800/40">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap size={16} className="text-yellow-500" />
                        <span className="text-sm text-white font-bold tracking-wider">POWER GENERATION</span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                        <div><span className="text-yellow-500 font-bold">CAT {ENGINE_SPEC.model}</span> × 4 Units</div>
                        <div>{ENGINE_SPEC.cylinders} Cyl • {ENGINE_SPEC.type}</div>
                        <div>Bore: {ENGINE_SPEC.bore} • Stroke: {ENGINE_SPEC.stroke}</div>
                    </div>
                </div>

                {/* Total Power */}
                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">⚡ TOTAL POWER</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{totalKW.toFixed(0)}</span>
                            <span className="text-gray-500 text-sm font-medium">kW</span>
                        </div>
                    </div>
                </div>

                {/* Avg Load */}
                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">📊 AVG LOAD</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">{avgLoad.toFixed(1)}</span>
                            <span className="text-gray-500 text-sm font-medium">%</span>
                        </div>
                    </div>
                </div>

                {/* Total Fuel */}
                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">⛽ TOTAL FUEL RATE</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">{totalFuel.toFixed(1)}</span>
                            <span className="text-gray-500 text-sm font-medium">L/hr</span>
                        </div>
                    </div>
                </div>

                {/* Units Online */}
                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">🟢 UNITS ONLINE</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-white">{onlineCount}</span>
                            <span className="text-gray-500 text-sm font-medium">/ 4</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4 Engine Image Tabs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0 mt-2">
                {engines.map((engine) => {
                    const isActive = expandedEngineId === engine.id;
                    return (
                        <div
                            key={engine.id}
                            onClick={() => setExpandedEngineId(engine.id)}
                            className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 flex flex-col items-center justify-center gap-3 relative overflow-hidden group 
                                ${isActive ? 'bg-cyan-900/20 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-slate-800/40 border-white/10 hover:border-white/30 hover:bg-slate-700/40'}`}
                        >
                            {isActive && <div className="absolute inset-x-0 bottom-0 h-1 bg-cyan-500 shadow-[0_-2px_8px_rgba(6,182,212,0.5)]"></div>}

                            <div className="flex items-center justify-between w-full px-2">
                                <span className={`font-bold text-sm tracking-wider ${isActive ? 'text-cyan-400' : 'text-gray-300 group-hover:text-white'}`}>
                                    POWER PACK {engine.id}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${engine.isOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-500'}`}>
                                    {engine.isOnline ? "ON" : "OFF"}
                                </span>
                            </div>

                            <img
                                src="/cat_engine.png"
                                alt={`CAT 3512 Engine ${engine.id}`}
                                className={`h-24 object-contain p-2 rounded-lg transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-105'} bg-white/5 border border-white/5`}
                            />

                            <div className="flex gap-4 w-full justify-center text-xs">
                                <div className="flex flex-col items-center">
                                    <span className="text-gray-500 font-bold">RPM</span>
                                    <span className={`font-mono font-bold ${isActive ? 'text-cyan-400' : 'text-gray-300'}`}>{engine.data.RPM || 0}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-gray-500 font-bold">kW</span>
                                    <span className={`font-mono font-bold ${isActive ? 'text-green-400' : 'text-gray-300'}`}>{engine.data.kWOutput || 0}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selected Engine Detail View */}
            {selectedEngine && (
                <PowerPackDetail
                    id={selectedEngine.id}
                    data={selectedEngine.data}
                    isOnline={selectedEngine.isOnline}
                />
            )}
        </div>
    );
}
