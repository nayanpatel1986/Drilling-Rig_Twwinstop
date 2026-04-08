import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRigData, getRigHistory } from '../api';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
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

const COLORS = ['#38BDF8', '#4ADE80', '#FBBF24', '#F87171']; // Light Blue, Green, Yellow, Red
const GRAFANA_COLORS = ['#73bf69', '#3274d9', '#f2cc0c', '#e02f44', '#ca96e8'];

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

// Engine Telemetry Card from previous iteration (preserved at bottom)
const EngineTelemetryCard = ({ engine, color }) => {
    const data = engine.data;
    const ParameterRow = ({ label, value, unit }) => (
        <div className="flex items-center justify-between border-b border-[#2a2e33] py-1 px-2 hover:bg-white/5 transition-colors">
            <span className="text-[10px] text-[#b1b5ba]">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className="font-mono text-xs font-bold text-[#e2e8f0]">
                    {typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) : value || '0.0'}
                </span>
                {unit && <span className="text-[9px] text-[#8e9297]">{unit}</span>}
            </div>
        </div>
    );

    return (
        <GrafanaPanel title={`POWER PACK ${engine.id}`}>
             <div className="grid grid-cols-2 gap-x-4 gap-y-0 h-full content-start">
               {/* Left Column */}
               <div className="flex flex-col">
                   <ParameterRow label="RPM" value={data.RPM} unit="rpm" />
                   <ParameterRow label="Oil Pressure" value={data.OilPressure} unit="psi" />
                   <ParameterRow label="Oil Temp" value={data.OilTemperature} unit="°C" />
                   <ParameterRow label="Coolant Temp" value={data.CoolantTemp} unit="°C" />
                   <ParameterRow label="Exhaust Temp" value={data.ExhaustTemp} unit="°C" />
                   <ParameterRow label="Load Percent" value={data.LoadPercent} unit="%" />
                   <ParameterRow label="Total Pct KW" value={data.TotalPercentKW} unit="%" />
               </div>
               {/* Right Column */}
               <div className="flex flex-col">
                   <ParameterRow label="Fuel Rate" value={data.FuelRate} unit="L/hr" />
                   <ParameterRow label="Inst. Fuel" value={data.InstFuelCons} unit="L/hr" />
                   <ParameterRow label="Total Fuel" value={data.TotalFuelCons} unit="L" />
                   <ParameterRow label="Run Hours" value={data.RunHours} unit="hrs" />
                   <ParameterRow label="Power Factor" value={data.OverallPowerFact} unit="" />
                   <ParameterRow label="Reactive Pwr" value={data.TotalReactivePow} unit="kVAR" />
               </div>
            </div>
        </GrafanaPanel>
    );
};

export default function PowerGeneration() {
    const [rigData, setRigData] = useState(null);
    const [historyData, setHistoryData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const d = await getRigData();
            if (d) setRigData(d);
            
            const hist = await getRigHistory('-5m');
            if (hist && hist.length > 0) {
                const formatted = hist.map(item => {
                    const dObj = new Date(item.time);
                    return {
                        ...item,
                        timeStr: `${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}:${dObj.getSeconds().toString().padStart(2,'0')}`
                    }
                });
                setHistoryData(formatted);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, []);

    const engines = [1, 2, 3, 4].map(id => {
        const data = simulateEngine(id, rigData);
        // Fallback kW estimation
        if (!data.kWOutput && data.TotalPercentKW) data.kWOutput = data.TotalPercentKW * 11;
        
        return {
            name: `Power Pack ${id}`,
            id,
            data,
            isOnline: (data.RPM || 0) > 0 || (data.LoadPercent || 0) > 0,
            kWOutput: data.kWOutput || 0,
            LoadPercent: data.LoadPercent || 0,
            FuelRate: data.FuelRate || 0,
        };
    });

    const totalKW = engines.reduce((sum, e) => sum + e.kWOutput, 0);
    const totalFuel = engines.reduce((sum, e) => sum + e.data.FuelRate, 0);
    const instFuel = engines.reduce((sum, e) => sum + e.data.InstFuelCons, 0);
    const totalReactive = engines.reduce((sum, e) => sum + e.data.TotalReactivePow, 0);
    const activeEngines = engines.filter(e => e.isOnline);
    const avgLoad = activeEngines.length > 0 
        ? activeEngines.reduce((sum, e) => sum + e.data.LoadPercent, 0) / activeEngines.length 
        : 0;
    const onlineCount = activeEngines.length;

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
            {/* ROW 0: CAT Engine Navigation Symbols */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0 mb-2">
                {engines.map((engine) => (
                    <Link
                        key={engine.id}
                        to={`/engine/${engine.id}`}
                        className={`relative group bg-[#181b1f] border transition-all duration-300 hover:scale-[1.02] flex flex-col items-center justify-center p-4 rounded-lg overflow-hidden ${
                            engine.isOnline ? 'border-[#73bf69]' : 'border-[#f2495c]'
                        }`}
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-300"></div>
                        <div className="absolute top-2 right-2">
                            <span className={`w-3 h-3 rounded-full inline-block ${engine.isOnline ? 'bg-[#73bf69] animate-pulse shadow-[0_0_8px_#73bf69]' : 'bg-[#f2495c]'} shadow-sm`}></span>
                        </div>
                        <img src="/cat_engine.png" alt={`CAT Engine ${engine.id}`} className="h-24 w-auto object-contain filter drop-shadow-xl mb-3" />
                        <h3 className="text-[#e2e8f0] font-bold tracking-wider text-lg">{engine.name}</h3>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${engine.isOnline ? 'text-[#73bf69]' : 'text-[#f2495c]'}`}>
                            {engine.isOnline ? 'ONLINE' : 'OFFLINE'}
                        </p>
                    </Link>
                ))}
            </div>



            {/* Spacer for bottom padding */}
            <div className="h-8 flex-shrink-0 w-full"></div>
        </div>
    );
}
