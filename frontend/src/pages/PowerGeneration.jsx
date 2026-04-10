import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRigData, getRigHistory } from '../api';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import RadialGauge from '../components/RadialGauge';

function simulateEngine(id, rigData) {
    const base = {
        RPM: 0, 
        OilPressure: 0, 
        OilTemperature: 0, 
        CoolantTemp: 0, 
        ExhaustTemp: 0, 
        FuelRate: 0, 
        RunHours: 0, 
        LoadPercent: 0, 
        InstFuelCons: 0, 
        TotalFuelCons: 0, 
        OverallPowerFact: 0, 
        TotalReactivePow: 0, 
        TotalPercentKW: 0,
        kWOutput: 0
    };

    if (rigData) {
        const prefix = `PP${id}_`;
        Object.keys(base).forEach(k => {
            if (rigData[prefix + k] !== undefined) base[k] = rigData[prefix + k];
            else if (id === 1 && rigData[k] !== undefined) base[k] = rigData[k];
        });
        if (rigData.RPM && id === 1) base.RPM = rigData.RPM;
    }

    return base;
}

const StatBox = ({ label, value, unit, color }) => (
    <div className="flex flex-col">
        <span className="text-[9px] text-[#8e9297] font-bold uppercase tracking-wider">{label}</span>
        <div className="flex items-baseline gap-1">
            <span style={{ color }} className="text-lg font-black tracking-tight font-mono">{value}</span>
            <span className="text-[9px] font-bold text-[#8e9297]">{unit}</span>
        </div>
    </div>
);

const compactHistory = (id, history) => {
    return history.map(h => ({
        time: h.timeStr,
        value: h[`PP${id}_LoadPercent`] || 0
    })).slice(-15);
};

const EngineGensetCard = ({ engine, history }) => {
    const isOnline = engine.isOnline;
    const data = engine.data;
    
    return (
        <Link 
            to={`/engine/${engine.id}`}
            className={`glass-panel rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] border-t-2 ${
                isOnline ? 'neon-border-green border-t-emerald-500 animate-pulse-green' : 'neon-border-red border-t-rose-500'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                    <h3 className="text-white font-black text-sm tracking-tighter uppercase">{engine.name}</h3>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`}></span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isOnline ? 'Running' : 'Offline'}
                        </span>
                    </div>
                </div>
                <img src="/cat_engine.png" alt="CAT" className={`h-10 w-auto object-contain transition-opacity duration-500 ${isOnline ? 'opacity-80' : 'opacity-20 grayscale'}`} />
            </div>

            {/* Main Gauge / Value area */}
            <div className="flex items-center justify-between mb-4 bg-black/20 rounded-xl p-3 border border-white/5">
                <div className="flex flex-col">
                    <span className="text-[9px] text-[#8e9297] font-bold uppercase">Load Level</span>
                    <span className={`text-3xl font-black tracking-tighter ${isOnline ? 'text-white' : 'text-gray-600'}`}>
                        {data.LoadPercent?.toFixed(1) || '0.0'}<span className="text-sm ml-0.5">%</span>
                    </span>
                </div>
                <div className="h-12 w-24">
                   <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={compactHistory(engine.id, history)}>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={isOnline ? '#10b981' : '#475569'} 
                                fill={isOnline ? 'rgba(16,185,129,0.1)' : 'transparent'} 
                                strokeWidth={2} 
                                isAnimationActive={false} 
                            />
                        </AreaChart>
                   </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <StatBox label="Active Power" value={engine.kWOutput?.toFixed(0) || '0'} unit="kW" color={isOnline ? '#38bdf8' : '#475569'} />
                    <StatBox label="Frequency" value="60.0" unit="Hz" color={isOnline ? '#fcd34d' : '#475569'} />
                    <StatBox label="Fuel Rate" value={data.FuelRate?.toFixed(1) || '0.0'} unit="L/h" color={isOnline ? '#a78bfa' : '#475569'} />
                </div>
                <div className="space-y-3">
                    <StatBox label="Engine RPM" value={data.RPM?.toFixed(0) || '0'} unit="rpm" color={isOnline ? '#38bdf8' : '#475569'} />
                    <StatBox label="Coolant Temp" value={data.CoolantTemp?.toFixed(0) || '0'} unit="°C" color={isOnline ? '#fb7185' : '#475569'} />
                    <StatBox label="Oil Pressure" value={data.OilPressure?.toFixed(0) || '0'} unit="psi" color={isOnline ? '#a3e635' : '#475569'} />
                </div>
            </div>

            {/* Progress Health bar */}
            <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Mechanical Health</span>
                    <span className="text-[8px] font-bold text-white/60">{isOnline ? '98%' : 'N/A'}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${isOnline ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gray-700'}`}
                        style={{ width: isOnline ? '98%' : '0%' }}
                    ></div>
                </div>
            </div>
        </Link>
    );
};

export default function PowerGeneration() {
    const [rigData, setRigData] = useState(null);
    const [historyData, setHistoryData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const d = await getRigData();
            // Always update state to prevent freezing on old data
            setRigData(d || {});
            
            const hist = await getRigHistory('-15m');
            const formatted = (hist || []).map(item => {
                const dObj = new Date(item.time);
                return {
                    ...item,
                    timeStr: `${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}:${dObj.getSeconds().toString().padStart(2,'0')}`
                }
            });
            setHistoryData(formatted);
        };
        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, []);

    const engines = [1, 2, 3, 4].map(id => {
        const data = simulateEngine(id, rigData);
        if (!data.kWOutput && data.TotalPercentKW) data.kWOutput = data.TotalPercentKW * 11;
        return {
            name: `Power Pack ${id}`,
            id,
            data,
            isOnline: (data.RPM || 0) > 0 || (data.LoadPercent || 0) > 0,
            kWOutput: data.kWOutput || 0,
        };
    });

    const totalKW = engines.reduce((sum, e) => sum + (e.kWOutput || 0), 0);
    const totalFuel = engines.reduce((sum, e) => sum + (e.data.FuelRate || 0), 0);
    const onlineCount = engines.filter(e => e.isOnline).length;

    return (
        <div className="w-full h-full p-4 flex flex-col gap-6 overflow-x-hidden overflow-y-auto deep-space-bg text-[#c7d0d9] font-sans">
            {/* Header & Global Stats */}
            <div className="flex flex-col md:flex-row items-baseline justify-between gap-6 border-b border-white/5 pb-6">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">Fleet Telemetry</h1>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{onlineCount} GENS ONLINE</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase">Power Generation Node 01</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Active Power</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-white tracking-tighter text-glow-green">{totalKW.toLocaleString()}</span>
                            <span className="text-sm font-bold text-white/40">kW</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Fuel Flow</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-white tracking-tighter text-glow-amber">{totalFuel.toFixed(1)}</span>
                            <span className="text-sm font-bold text-white/40">L/hr</span>
                        </div>
                    </div>
                    <div className="hidden md:flex flex-col">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Sync Stability</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-emerald-400 tracking-tighter">99.8</span>
                            <span className="text-sm font-bold text-white/40">%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Engine Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {engines.map((engine) => (
                    <EngineGensetCard key={engine.id} engine={engine} history={historyData} />
                ))}
            </div>

            {/* Bottom Footer Info */}
            <div className="mt-auto pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
                    <span>Secure Node: 10.207.96.209</span>
                    <span>•</span>
                    <span>Last Handshake: {new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex gap-4">
                    <div className="h-6 w-32 bg-white/5 rounded flex items-center justify-center border border-white/5">
                         <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.1em]">Telegraf Active</span>
                    </div>
                    <div className="h-6 w-32 bg-emerald-500/5 rounded flex items-center justify-center border border-emerald-500/20">
                         <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.1em]">System Healthy</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
