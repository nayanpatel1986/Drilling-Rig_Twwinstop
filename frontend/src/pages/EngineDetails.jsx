import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRigData, getRigHistory } from '../api';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import RadialGauge from '../components/RadialGauge';
import { ChevronLeft } from 'lucide-react';

const GRAFANA_COLORS = {
    green: '#73bf69',
    blue: '#3274d9',
    yellow: '#f2cc0c',
    red: '#f2495c',
    purple: '#ca96e8',
    text: '#c7d0d9',
    subtext: '#8e9297',
    panelBg: '#181b1f',
    panelBorder: '#2a2e33'
};

const GrafanaPanel = ({ title, children, className="" }) => (
    <div className={`bg-[#181b1f] border border-[#2a2e33] flex flex-col overflow-hidden ${className}`}>
        <div className="flex items-center text-[10px] text-[#8e9297] font-bold px-3 py-1.5 border-b border-[#2a2e33] tracking-widest uppercase">
            {title}
        </div>
        <div className="flex-1 p-2 relative overflow-hidden">
            {children}
        </div>
    </div>
);

const BlockValue = ({ label, value, unit, color }) => (
    <div className="flex flex-col border-b border-[#2a2e33] last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
        <span className="text-[10px] text-[#8e9297] font-bold uppercase tracking-wider mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
            <span style={{ color }} className="text-3xl font-bold tracking-tight">{value}</span>
            <span className="text-sm font-bold text-[#8e9297]">{unit}</span>
        </div>
    </div>
);

const ColorfulStatPanel = ({ title, value, unit, textHex, fromHex }) => (
    <div style={{ background: `linear-gradient(to bottom right, ${fromHex}, #181b1f)` }} 
         className="border border-[#2a2e33] flex flex-col items-center justify-center py-6 px-4 rounded-lg hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300">
        <span className="text-[11px] text-[#ffffff] opacity-70 font-bold uppercase tracking-widest mb-2">{title}</span>
        <div className="flex items-baseline gap-1">
            <span style={{ color: textHex }} className="text-4xl font-black tracking-tighter drop-shadow-md">{value}</span>
            <span style={{ color: textHex }} className="opacity-80 text-sm font-bold ml-1">{unit}</span>
        </div>
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
            if (rawData) {
                // Extract metrics just for this engine
                const prefix = `PP${id}_`;
                const extracted = {
                    RPM: rawData[`${prefix}RPM`] || 0,
                    OilPressure: rawData[`${prefix}OilPressure`] || 0,
                    CoolantTemp: rawData[`${prefix}CoolantTemp`] || 0,
                    ExhaustTemp: rawData[`${prefix}ExhaustTemp`] || 0,
                    OilTemperature: rawData[`${prefix}OilTemperature`] || 0,
                    FuelRate: rawData[`${prefix}FuelRate`] || 0,
                    RunHours: rawData[`${prefix}RunHours`] || 0,
                    LoadPercent: rawData[`${prefix}LoadPercent`] || 0,
                    InstFuelCons: rawData[`${prefix}InstFuelCons`] || 0,
                    TotalFuelCons: rawData[`${prefix}TotalFuelCons`] || 0,
                    TotalPercentKW: rawData[`${prefix}TotalPercentKW`] || 0,
                    kWOutput: rawData[`${prefix}kWOutput`] || (rawData[`${prefix}TotalPercentKW`] ? rawData[`${prefix}TotalPercentKW`] * 11 : 0),
                    TotalReactivePow: rawData[`${prefix}TotalReactivePow`] || 0,
                    OverallPowerFact: rawData[`${prefix}OverallPowerFact`] || 0
                };
                
                // RPM fallback for engine 1
                if (id === "1" && !extracted.RPM && rawData.RPM) {
                    extracted.RPM = rawData.RPM;
                }

                setEngineData(extracted);
                setIsOnline(extracted.RPM > 0 || extracted.LoadPercent > 0);
            }

            const hist = await getRigHistory('-15m');
            if (hist && hist.length > 0) {
                const formatted = hist.map(item => {
                    const dObj = new Date(item.time);
                    return {
                        ...item,
                        timeStr: `${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}:${dObj.getSeconds().toString().padStart(2,'0')}`,
                        LoadPercent: item[`PP${id}_LoadPercent`] || 0,
                        kWOutput: item[`PP${id}_kWOutput`] || 0
                    };
                });
                setHistoryData(formatted);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [id]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#181b1f] border border-[#2a2e33] p-2 rounded shadow-xl">
                    <p className="text-white font-bold text-xs mb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }} className="text-xs font-mono">
                            {entry.name}: {entry.value?.toFixed ? entry.value.toFixed(1) : entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full p-2 flex flex-col gap-2 overflow-x-hidden overflow-y-auto custom-scrollbar bg-[#111217] text-[#c7d0d9] font-sans">
            
            {/* Header row with navigation */}
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Link to="/power" className="text-[#8e9297] hover:text-white transition-colors flex items-center gap-1">
                        <ChevronLeft size={20} />
                        <span className="text-sm font-bold tracking-wider">BACK TO POWER GEN</span>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-white border-l border-[#2a2e33] pl-4">
                        POWER PACK {id} TELEMETRY
                    </h1>
                </div>
            </div>

            {/* Top Row: Global Status & Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[120px] flex-shrink-0">
                 {/* Status Block */}
                <GrafanaPanel title="Engine Status">
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <span style={{ color: isOnline ? GRAFANA_COLORS.green : GRAFANA_COLORS.red }} className="text-4xl font-bold tracking-widest drop-shadow-md">
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        <span className="text-[10px] text-[#8e9297] uppercase mt-1">Operational State</span>
                    </div>
                </GrafanaPanel>
                
                {/* Instant Info */}
                <GrafanaPanel title="Live Output Summary">
                     <div className="flex items-center justify-around h-full px-4">
                        <BlockValue label="Current Load" value={engineData.LoadPercent?.toFixed(1) || '0.0'} unit="%" color={GRAFANA_COLORS.yellow} />
                        <BlockValue label="Active Power" value={engineData.kWOutput?.toFixed(0) || '0'} unit="kW" color={GRAFANA_COLORS.blue} />
                     </div>
                </GrafanaPanel>

                <GrafanaPanel title="Fuel Metrics">
                     <div className="flex items-center justify-around h-full px-4">
                        <BlockValue label="Fuel Rate" value={engineData.FuelRate?.toFixed(1) || '0.0'} unit="L/hr" color={GRAFANA_COLORS.green} />
                        <BlockValue label="Inst. Fuel" value={engineData.InstFuelCons?.toFixed(1) || '0.0'} unit="L/hr" color={GRAFANA_COLORS.green} />
                     </div>
                </GrafanaPanel>

                <GrafanaPanel title="Run Info">
                     <div className="flex flex-col justify-center h-full px-4">
                        <BlockValue label="Total Hours" value={engineData.RunHours?.toFixed(1) || '0.0'} unit="hrs" color={GRAFANA_COLORS.text} />
                        <BlockValue label="Total Fuel" value={engineData.TotalFuelCons?.toFixed(0) || '0'} unit="L" color={GRAFANA_COLORS.text} />
                     </div>
                </GrafanaPanel>
            </div>

            {/* Colorful Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-shrink-0 mb-2">
                <ColorfulStatPanel title="Engine RPM" value={engineData.RPM || 0} unit="rpm" textHex="#38BDF8" fromHex="#0c2a3e" />
                <ColorfulStatPanel title="Coolant Temp" value={engineData.CoolantTemp || 0} unit="°C" textHex="#fb7185" fromHex="#3e131d" />
                <ColorfulStatPanel title="Oil Temp" value={engineData.OilTemperature || 0} unit="°C" textHex="#fb923c" fromHex="#3f200c" />
                <ColorfulStatPanel title="Oil Pressure" value={engineData.OilPressure || 0} unit="psi" textHex="#a78bfa" fromHex="#2e1d4c" />
                <ColorfulStatPanel title="Exhaust Temp" value={engineData.ExhaustTemp?.toFixed(1) || '0.0'} unit="°C" textHex="#f472b6" fromHex="#3a1528" />
                <ColorfulStatPanel title="Power Factor" value={engineData.OverallPowerFact?.toFixed(2) || '0.00'} unit="" textHex="#34d399" fromHex="#0f3526" />
                <ColorfulStatPanel title="Reactive Pwr" value={engineData.TotalReactivePow?.toFixed(0) || '0'} unit="kVAR" textHex="#fbbf24" fromHex="#3d310b" />
                <ColorfulStatPanel title="Health" value={isOnline ? '100' : '0'} unit="%" textHex="#a3e635" fromHex="#1e340b" />
            </div>

            {/* Historical Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-[280px] flex-shrink-0">
                <GrafanaPanel title="Engine Load Trend (15m)">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="loadColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={GRAFANA_COLORS.yellow} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={GRAFANA_COLORS.yellow} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e33" vertical={false} />
                            <XAxis dataKey="timeStr" tick={{ fill: '#8e9297', fontSize: 10 }} minTickGap={60} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#8e9297', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a2e33', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="LoadPercent" name="Load %" stroke={GRAFANA_COLORS.yellow} fillOpacity={1} fill="url(#loadColor)" strokeWidth={2} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </GrafanaPanel>

                <GrafanaPanel title="kW Output Trend (15m)">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                             <defs>
                                <linearGradient id="kwColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={GRAFANA_COLORS.blue} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={GRAFANA_COLORS.blue} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e33" vertical={false} />
                            <XAxis dataKey="timeStr" tick={{ fill: '#8e9297', fontSize: 10 }} minTickGap={60} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#8e9297', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a2e33', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="kWOutput" name="Power (kW)" stroke={GRAFANA_COLORS.blue} fillOpacity={1} fill="url(#kwColor)" strokeWidth={2} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </GrafanaPanel>
            </div>

            {/* Spacer */}
            <div className="h-8 flex-shrink-0 w-full"></div>
        </div>
    );
}
