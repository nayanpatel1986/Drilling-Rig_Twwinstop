import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Settings, Droplet, RadioReceiver, Gauge } from 'lucide-react';
import { getRigData } from '../api';

const BOP_PARAMS = [
    { key: 'AnnularPressure', label: 'Annular Pressure', unit: 'psi', max: 5000, type: 'analog' },
    { key: 'PipeRamUpperPress', label: 'Upper Pipe Ram Press', unit: 'psi', max: 5000, type: 'analog' },
    { key: 'PipeRamLowerPress', label: 'Lower Pipe Ram Press', unit: 'psi', max: 5000, type: 'analog' },
    { key: 'BlindRamPress', label: 'Blind Ram Pressure', unit: 'psi', max: 5000, type: 'analog' },
    { key: 'AccumulatorPress', label: 'Accumulator Press', unit: 'psi', max: 3000, type: 'analog' },
    { key: 'ManifoldPress', label: 'Manifold Pressure', unit: 'psi', max: 10000, type: 'analog' },

    { key: 'AnnularStatus', label: 'Annular Preventer', type: 'digital' },
    { key: 'PipeRamUpperStatus', label: 'Upper Pipe Ram', type: 'digital' },
    { key: 'PipeRamLowerStatus', label: 'Lower Pipe Ram', type: 'digital' },
    { key: 'BlindRamStatus', label: 'Blind/Shear Ram', type: 'digital' },
    { key: 'Pump1Status', label: 'Hydraulic Pump 1', type: 'digital' },
    { key: 'Pump2Status', label: 'Hydraulic Pump 2', type: 'digital' },
];

// Helper to simulate BOP data if real Modbus data isn't available
function simulateBOP(rigData) {
    if (rigData && rigData.AnnularPressure) return rigData; // Use real data if it shows up

    // Fallback Mock Data
    const t = Date.now() / 10000;
    const basePress = 1500;

    return {
        AnnularPressure: basePress + Math.sin(t) * 50 + Math.random() * 20,
        PipeRamUpperPress: basePress + Math.sin(t + 1) * 40 + Math.random() * 15,
        PipeRamLowerPress: basePress + Math.sin(t + 2) * 40 + Math.random() * 15,
        BlindRamPress: basePress + Math.sin(t + 3) * 30 + Math.random() * 10,
        AccumulatorPress: 2850 + Math.random() * 25,
        ManifoldPress: 4500 + Math.random() * 100,

        AnnularStatus: 'OPEN',
        PipeRamUpperStatus: 'OPEN',
        PipeRamLowerStatus: 'OPEN',
        BlindRamStatus: 'OPEN',
        Pump1Status: 'ON',
        Pump2Status: 'STANDBY',
    };
}

export default function BOP() {
    const [rigData, setRigData] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            const d = await getRigData();
            if (d) setRigData(d);
        };
        fetchData();
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, []);

    const data = rigData || {};

    // KPI Calculations
    const accPress = data.AccumulatorPress || 0;
    const usableFluid = Math.max(0, ((accPress - 1200) / 3000) * 160); // Mock formula: 160gal total, min 1200psi
    const timeToClose = (usableFluid > 50) ? 8.5 : 14.2;

    return (
        <div className="flex flex-col gap-4 -mt-4 w-full h-full p-1 overflow-y-auto overflow-x-hidden">
            {/* Header / Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
                <div className="col-span-2 md:col-span-1 card border border-white/5 px-4 py-3 bg-slate-800/40">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert size={16} className="text-red-500" />
                        <span className="text-sm text-white font-bold tracking-wider">BOP SYSTEM</span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                        <div><span className="text-red-500 font-bold">MAKE:</span> Sara Sea</div>
                        <div><span className="text-red-500 font-bold">STACK:</span> 13-5/8" 10M</div>
                        <div><span className="text-red-500 font-bold">CONTROL:</span> Koomey Unit</div>
                    </div>
                </div>

                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">ACCUMULATOR PRESS</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                                {accPress.toFixed(0)}
                            </span>
                            <span className="text-gray-500 text-sm font-medium">psi</span>
                        </div>
                    </div>
                </div>

                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">USABLE FLUID</span>
                        <div className="flex items-baseline gap-1">
                            <span className={`font-mono font-bold text-3xl ${usableFluid < 80 ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]'}`}>
                                {usableFluid.toFixed(1)}
                            </span>
                            <span className="text-gray-500 text-sm font-medium">gal</span>
                        </div>
                    </div>
                </div>

                <div className="card border border-white/5 px-4 py-3 flex items-center justify-between bg-slate-800/40">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-bold tracking-wider">EST. TIME TO CLOSE</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-3xl text-white">
                                {timeToClose.toFixed(1)}
                            </span>
                            <span className="text-gray-500 text-sm font-medium">sec</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content: Diagram + Parameters */}
            <div className="flex flex-col lg:flex-row gap-4 h-full min-h-[500px]">

                {/* Left Side: BOP Schematic/Image */}
                <div className="lg:w-1/3 card border border-white/5 bg-slate-800/20 p-4 flex flex-col items-center justify-center relative min-h-[400px]">
                    <h3 className="absolute top-4 left-4 text-xs text-gray-500 font-bold uppercase tracking-wider">Stack Visualization</h3>

                    {/* Placeholder for the BOP Image */}
                    <div className="relative w-full h-full flex items-center justify-center p-8">
                        <img
                            src="/bop_stack.png"
                            alt="Sara Sea BOP Stack Schematic"
                            className="max-h-full object-contain filter drop-shadow-[0_0_25px_rgba(239,68,68,0.15)]"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400" viewBox="0 0 200 400"><rect x="50" y="20" width="100" height="60" fill="%23475569" stroke="%2394a3b8" stroke-width="4" rx="10"/><rect x="60" y="80" width="80" height="30" fill="%23334155"/><rect x="40" y="110" width="120" height="50" fill="%230f172a" stroke="%23475569" stroke-width="4"/><rect x="60" y="160" width="80" height="30" fill="%23334155"/><rect x="40" y="190" width="120" height="50" fill="%230f172a" stroke="%23475569" stroke-width="4"/><rect x="60" y="240" width="80" height="30" fill="%23334155"/><rect x="40" y="270" width="120" height="50" fill="%230f172a" stroke="%23475569" stroke-width="4"/><rect x="60" y="320" width="80" height="60" fill="%23334155"/><text x="100" y="55" fill="white" font-size="12" font-family="sans-serif" text-anchor="middle">ANNULAR</text><text x="100" y="140" fill="white" font-size="10" font-family="sans-serif" text-anchor="middle">UPPER RAM</text><text x="100" y="220" fill="white" font-size="10" font-family="sans-serif" text-anchor="middle">LOWER RAM</text><text x="100" y="300" fill="white" font-size="10" font-family="sans-serif" text-anchor="middle">BLIND RAM</text></svg>';
                            }}
                        />

                        {/* Status Overlays */}
                        <div className="absolute left-0 top-[15%] text-[10px] font-bold px-2 py-1 rounded bg-slate-900/80 border border-white/10">
                            {data.AnnularStatus === 'OPEN' ? <span className="text-green-400">OPEN</span> : <span className="text-red-500 animate-pulse">CLOSED</span>}
                        </div>
                        <div className="absolute right-0 top-[35%] text-[10px] font-bold px-2 py-1 rounded bg-slate-900/80 border border-white/10">
                            {data.PipeRamUpperStatus === 'OPEN' ? <span className="text-green-400">OPEN</span> : <span className="text-red-500 animate-pulse">CLOSED</span>}
                        </div>
                        <div className="absolute left-0 top-[55%] text-[10px] font-bold px-2 py-1 rounded bg-slate-900/80 border border-white/10">
                            {data.PipeRamLowerStatus === 'OPEN' ? <span className="text-green-400">OPEN</span> : <span className="text-red-500 animate-pulse">CLOSED</span>}
                        </div>
                        <div className="absolute right-0 top-[75%] text-[10px] font-bold px-2 py-1 rounded bg-slate-900/80 border border-white/10">
                            {data.BlindRamStatus === 'OPEN' ? <span className="text-green-400">OPEN</span> : <span className="text-red-500 animate-pulse">CLOSED</span>}
                        </div>
                    </div>
                </div>

                {/* Right Side: Parameter Grid */}
                <div className="lg:w-2/3 flex flex-col gap-4 overflow-y-auto pr-2">

                    {/* Sub-section: Analog Readouts (Pressures) */}
                    <div>
                        <h3 className="text-sm text-gray-400 font-bold mb-3 uppercase tracking-widest border-b border-white/5 pb-2">Analog Parameters</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {BOP_PARAMS.filter(p => p.type === 'analog').map((param) => {
                                const val = data[param.key] ?? 0;
                                const isHigh = val > param.max * 0.8;
                                const color = isHigh ? 'text-red-500' : 'text-cyan-400';
                                return (
                                    <div key={param.key} className="bg-slate-800/60 rounded-xl p-4 border border-white/10 shadow-lg transition-all hover:bg-slate-700/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Gauge size={16} className="text-nov-accent" />
                                            <span className="text-xs text-gray-300 font-black uppercase tracking-widest truncate" title={param.label}>{param.label}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className={`font-mono font-black text-3xl drop-shadow-md ${color}`}>
                                                {val.toFixed(0)}
                                            </span>
                                            <span className="text-sm text-gray-400 font-bold ml-1">{param.unit}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sub-section: Digital Readouts (Statuses) */}
                    <div>
                        <h3 className="text-sm text-gray-400 font-bold mb-3 uppercase tracking-widest border-b border-white/5 pb-2 mt-4">Digital Parameters</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {BOP_PARAMS.filter(p => p.type === 'digital').map((param) => {
                                const status = data[param.key] || 'UNKNOWN';
                                const isSafe = status === 'OPEN' || status === 'ON';
                                const color = isSafe ? 'text-green-400' : (status === 'STANDBY' ? 'text-yellow-400' : 'text-red-500');
                                const bg = isSafe ? 'bg-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]' : (status === 'STANDBY' ? 'bg-yellow-500/20 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]');

                                return (
                                    <div key={param.key} className="bg-slate-800/60 rounded-xl p-4 border border-white/10 shadow-lg flex flex-col gap-3 justify-center items-center text-center transition-all hover:bg-slate-700/50">
                                        <span className="text-xs text-gray-300 font-black uppercase tracking-widest w-full truncate" title={param.label}>{param.label}</span>
                                        <span className={`font-black text-sm tracking-widest px-4 py-1.5 rounded-full w-fit border border-current ${color} ${bg}`}>
                                            {status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
