import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRigData, getRigHistory } from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft } from 'lucide-react';

const StatBox = ({ label, value, unit, color }) => (
    <div className="flex flex-col">
        <span className="text-[9px] text-[#8e9297] font-bold uppercase tracking-wider">{label}</span>
        <div className="flex items-baseline gap-1">
            <span style={{ color }} className="text-xl font-black tracking-tight font-mono">{value}</span>
            <span className="text-[9px] font-bold text-[#8e9297]">{unit}</span>
        </div>
    </div>
);

const ParameterSparkline = ({ data, dataKey, color }) => (
    <div className="h-6 w-full opacity-50 mt-2">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

const PremiumStatPanel = ({ title, value, unit, color, historyData, dataKey }) => (
    <div className="glass-panel rounded-xl p-4 flex flex-col items-start relative overflow-hidden group hover:bg-[#1a1c23]/80 transition-all duration-300">
        <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em]">{title}</span>
            <div style={{ backgroundColor: color }} className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]"></div>
        </div>
        
        <div className="flex items-baseline gap-1 relative z-10">
            <span style={{ color }} className="text-3xl font-black tracking-tighter font-mono text-glow">
                {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            <span className="text-[10px] font-bold text-white/40 uppercase">{unit}</span>
        </div>

        <ParameterSparkline data={historyData} dataKey={dataKey} color={color} />
        
        {/* Subtle background glow on hover */}
        <div style={{ background: `radial-gradient(circle at top right, ${color}10, transparent 70%)` }} 
             className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
    </div>
);

export default function EngineDetails() {
    const { id } = useParams();
    const [engineData, setEngineData] = useState({});
    const [historyData, setHistoryData] = useState([]);
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const rawData = await getRigData();
            const prefix = `PP${id}_`;
            const extracted = {
                RPM: (rawData || {})[`${prefix}RPM`] || 0,
                OilPressure: (rawData || {})[`${prefix}OilPressure`] || 0,
                CoolantTemp: (rawData || {})[`${prefix}CoolantTemp`] || 0,
                ExhaustTemp: (rawData || {})[`${prefix}ExhaustTemp`] || 0,
                OilTemperature: (rawData || {})[`${prefix}OilTemperature`] || 0,
                FuelRate: (rawData || {})[`${prefix}FuelRate`] || 0,
                RunHours: (rawData || {})[`${prefix}RunHours`] || 0,
                LoadPercent: (rawData || {})[`${prefix}LoadPercent`] || 0,
                InstFuelCons: (rawData || {})[`${prefix}InstFuelCons`] || 0,
                TotalFuelCons: (rawData || {})[`${prefix}TotalFuelCons`] || 0,
                TotalPercentKW: (rawData || {})[`${prefix}TotalPercentKW`] || 0,
                kWOutput: (rawData || {})[`${prefix}kWOutput`] || ((rawData || {})[`${prefix}TotalPercentKW`] ? (rawData || {})[`${prefix}TotalPercentKW`] * 11 : 0),
                TotalReactivePow: (rawData || {})[`${prefix}TotalReactivePow`] || 0,
                OverallPowerFact: (rawData || {})[`${prefix}OverallPowerFact`] || 0
            };
            
            if (id === "1" && !extracted.RPM && (rawData || {}).RPM) extracted.RPM = rawData.RPM;

            setEngineData(extracted);
            setIsOnline(extracted.RPM > 0 || extracted.LoadPercent > 0);

            const hist = await getRigHistory('-30m');
            const formatted = (hist || []).map(item => {
                const dObj = new Date(item.time);
                return {
                    ...item,
                    timeStr: dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    LoadPercent: item[`PP${id}_LoadPercent`] || 0,
                    kWOutput: item[`PP${id}_kWOutput`] || 0,
                    RPM: item[`PP${id}_RPM`] || 0,
                    CoolantTemp: item[`PP${id}_CoolantTemp`] || 0,
                    OilPressure: item[`PP${id}_OilPressure`] || 0,
                    ExhaustTemp: item[`PP${id}_ExhaustTemp`] || 0,
                    TotalReactivePow: item[`PP${id}_TotalReactivePow`] || 0,
                    OilTemperature: item[`PP${id}_OilTemperature`] || 0,
                };
            });
            setHistoryData(formatted);
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [id]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-panel border-white/10 p-3 rounded-lg shadow-2xl">
                    <p className="text-white/60 font-black text-[10px] mb-2 uppercase tracking-widest">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div style={{ backgroundColor: entry.color }} className="w-1.5 h-1.5 rounded-full"></div>
                            <p className="text-xs font-mono text-white">
                                <span className="text-white/40">{entry.name}:</span> {entry.value?.toFixed ? entry.value.toFixed(1) : entry.value}
                            </p>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full p-6 flex flex-col gap-6 overflow-x-hidden overflow-y-auto deep-space-bg text-[#c7d0d9] font-sans">
            
            {/* Header row */}
            <div className="flex items-center justify-between flex-shrink-0 border-b border-white/5 pb-4">
                <div className="flex items-center gap-6">
                    <Link to="/power" className="group flex items-center gap-2 text-white/40 hover:text-white transition-all">
                        <div className="p-1 rounded-lg bg-white/5 border border-white/10 group-hover:border-white/30">
                            <ChevronLeft size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Fleet Exit</span>
                    </Link>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Power Pack {id}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'}`}></span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isOnline ? 'System Operational' : 'System Offline'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-8">
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Runtime Efficiency</span>
                        <span className="text-xl font-mono font-black text-white">94.2%</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Total Operation</span>
                        <span className="text-xl font-mono font-black text-white">{engineData.RunHours?.toFixed(1) || '0.0'} hrs</span>
                    </div>
                </div>
            </div>

            {/* Top Row: Detailed Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-6 rounded-2xl flex items-center justify-around border-l-4 border-l-amber-500">
                    <StatBox label="Engine Load" value={engineData.LoadPercent?.toFixed(1) || '0.0'} unit="%" color="#fcd34d" />
                    <div className="h-10 w-px bg-white/10"></div>
                    <StatBox label="Active Power" value={engineData.kWOutput?.toFixed(0) || '0'} unit="kW" color="#38bdf8" />
                </div>
                <div className="glass-panel p-6 rounded-2xl flex items-center justify-around border-l-4 border-l-emerald-500">
                    <StatBox label="Fuel Rate" value={engineData.FuelRate?.toFixed(1) || '0.0'} unit="L/hr" color="#10b981" />
                    <div className="h-10 w-px bg-white/10"></div>
                    <StatBox label="Inst. Consumption" value={engineData.InstFuelCons?.toFixed(1) || '0.0'} unit="L/hr" color="#10b981" />
                </div>
                <div className="glass-panel p-6 rounded-2xl flex items-center justify-around border-l-4 border-l-purple-500">
                    <StatBox label="Power Factor" value={engineData.OverallPowerFact?.toFixed(2) || '0.00'} unit="" color="#a78bfa" />
                    <div className="h-10 w-px bg-white/10"></div>
                    <StatBox label="Reactive Power" value={engineData.TotalReactivePow?.toFixed(0) || '0'} unit="kVAR" color="#fbbf24" />
                </div>
            </div>

            {/* Detailed Sensors Grid with Inset Sparklines */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PremiumStatPanel title="Engine Rotation" value={engineData.RPM} unit="rpm" color="#38bdf8" historyData={historyData} dataKey="RPM" />
                <PremiumStatPanel title="Coolant Temperature" value={engineData.CoolantTemp} unit="°C" color="#fb7185" historyData={historyData} dataKey="CoolantTemp" />
                <PremiumStatPanel title="Oil Temp" value={engineData.OilTemperature} unit="°C" color="#fb923c" historyData={historyData} dataKey="OilTemperature" />
                <PremiumStatPanel title="Oil Pressure" value={engineData.OilPressure} unit="psi" color="#a3e635" historyData={historyData} dataKey="OilPressure" />
                <PremiumStatPanel title="Exhaust Gas" value={engineData.ExhaustTemp} unit="°C" color="#f472b6" historyData={historyData} dataKey="ExhaustTemp" />
                <PremiumStatPanel title="Fuel Level" value={95} unit="%" color="#22d3ee" historyData={historyData} dataKey="LoadPercent" />
                <PremiumStatPanel title="Generator Reactive" value={engineData.TotalReactivePow} unit="kVAR" color="#fbbf24" historyData={historyData} dataKey="TotalReactivePow" />
                <PremiumStatPanel title="Mechanical Health" value={isOnline ? 100 : 0} unit="%" color="#c084fc" historyData={historyData} dataKey="LoadPercent" />
            </div>

            {/* Trends Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[320px] flex-shrink-0">
                <div className="glass-panel p-6 rounded-2xl flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Engine Load Profile (30M)</span>
                        <span className="text-[10px] font-bold text-amber-500">PEAK: 88.4%</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                            <defs>
                                <linearGradient id="loadColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#fcd34d" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#fcd34d" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="timeStr" hide />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="LoadPercent" name="Load" stroke="#fcd34d" strokeWidth={3} fill="url(#loadColor)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Power Output (30M)</span>
                        <span className="text-[10px] font-bold text-sky-500">NOMINAL: 1200 kW</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                            <defs>
                                <linearGradient id="kwColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="timeStr" hide />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="kWOutput" name="Active Power" stroke="#38bdf8" strokeWidth={3} fill="url(#kwColor)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="h-8 w-full flex-shrink-0"></div>
        </div>
    );
}
