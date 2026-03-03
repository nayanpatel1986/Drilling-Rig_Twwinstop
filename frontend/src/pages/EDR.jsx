import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Layers, Settings } from 'lucide-react';
import { getRigData, getRigHistory } from '../api';

const DEFAULT_PARAMS = [
    { key: 'BitDepth', label: 'Bit Depth', unit: 'm' },
    { key: 'Depth', label: 'Hole Depth', unit: 'm' },
    { key: 'RPM', label: 'RPM', unit: 'rpm' },
    { key: 'ON_BOTTOM', label: 'On Bottom', unit: '' } // Special calculated param
];

const AVAILABLE_PARAMS = [
    { key: 'BitDepth', label: 'Bit Depth', unit: 'm' },
    { key: 'Depth', label: 'Hole Depth', unit: 'm' },
    { key: 'RPM', label: 'RPM', unit: 'rpm' },
    { key: 'ON_BOTTOM', label: 'On Bottom', unit: '' },
    { key: 'WOB', label: 'WOB', unit: 'ton' },
    { key: 'ROP', label: 'ROP', unit: 'm/hr' },
    { key: 'Torque', label: 'Torque', unit: 'kft-lb' },
    { key: 'SPM1', label: 'SPM 1', unit: 'spm' },
    { key: 'SPM2', label: 'SPM 2', unit: 'spm' },
    { key: 'PumpPress', label: 'Pump Press', unit: 'psi' },
    { key: 'HookLoad', label: 'Hook Load', unit: 'ton' },
];

export default function EDR() {
    const [activeTab, setActiveTab] = useState('realtime');
    const [drillData, setDrillData] = useState([]);
    const [liveParams, setLiveParams] = useState({});
    const [pvrData, setPvrData] = useState([]);

    // Configurable Panels State
    const [panels, setPanels] = useState(() => {
        const saved = localStorage.getItem('edrConfigPanels');
        return saved ? JSON.parse(saved) : DEFAULT_PARAMS;
    });
    const [editingPanelIndex, setEditingPanelIndex] = useState(null);

    // Persist layout
    useEffect(() => {
        localStorage.setItem('edrConfigPanels', JSON.stringify(panels));
    }, [panels]);

    // Fetch depth-indexed data for EDR tracks
    useEffect(() => {
        const fetchData = async () => {
            const rows = await getRigHistory('-10m');
            if (rows.length > 0) {
                const mapped = rows.map(r => ({
                    depth: r.Depth || 0,
                    rop: r.ROP || 0,
                    wob: r.WOB || 0,
                    rpm: r.RPM || 0,
                    torque: r.Torque || 0,
                }));
                setDrillData(mapped);

                // Build PVR data from recent data
                const pvr = mapped.filter(r => r.wob > 0 && r.rop > 0).map(r => ({
                    wob: r.wob,
                    rop: r.rop,
                    mse: r.wob > 0 && r.rop > 0 ? (r.wob * 1000) / (8.5 * 8.5) + (1000 * r.rpm) / r.rop : 500,
                }));
                setPvrData(pvr);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    // Fetch live params for sidebar
    useEffect(() => {
        const fetchLive = async () => {
            const data = await getRigData();
            if (data) setLiveParams(data);
        };
        fetchLive();
        const interval = setInterval(fetchLive, 1000);
        return () => clearInterval(interval);
    }, []);

    const getParamValue = (key) => {
        if (key === 'ON_BOTTOM') {
            const bitDepth = liveParams.BitDepth || liveParams.Depth || 0;
            const holeDepth = liveParams.Depth || 0;
            const onBottom = Math.abs(bitDepth - holeDepth) < 1;
            return { value: onBottom ? 'YES' : 'NO', className: onBottom ? "text-green-500" : "text-red-400" };
        }
        return { value: (liveParams[key] || 0).toFixed(key.includes('Depth') ? 1 : 0), className: '' };
    };

    const handleParamSelect = (paramConfig) => {
        const newPanels = [...panels];
        newPanels[editingPanelIndex] = paramConfig;
        setPanels(newPanels);
        setEditingPanelIndex(null);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">EDR & Performance</h1>
                    <p className="text-gray-400">Electronic Drilling Recorder / Parameter vs Rate (Live)</p>
                </div>

                <div className="flex gap-2">
                    <button
                        className={`btn ${activeTab === 'realtime' ? 'btn-primary' : 'bg-nov-card'}`}
                        onClick={() => setActiveTab('realtime')}
                    >
                        <ActivityIcon className="inline mr-2" size={16} /> Real-Time Logs
                    </button>
                    <button
                        className={`btn ${activeTab === 'pvr' ? 'btn-primary' : 'bg-nov-card'}`}
                        onClick={() => setActiveTab('pvr')}
                    >
                        <Layers className="inline mr-2" size={16} /> PVR Analytics
                    </button>
                </div>
            </header>

            {activeTab === 'realtime' ? (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
                    {/* Depth Track: ROP */}
                    <div className="card flex flex-col">
                        <h3 className="text-sm font-bold text-gray-500 mb-2">ROP (m/hr)</h3>
                        <div className="flex-1">
                            {drillData.length > 0 ? (
                                <ResponsiveContainer>
                                    <LineChart layout="vertical" data={drillData}>
                                        <YAxis dataKey="depth" type="number" domain={['dataMin', 'dataMax']} reversed stroke="#6B7280" />
                                        <XAxis type="number" domain={[0, 'auto']} stroke="#6B7280" orientation="top" />
                                        <Tooltip cursor={{ stroke: 'white', strokeWidth: 1 }} contentStyle={{ backgroundColor: '#151E32' }} />
                                        <Line dataKey="rop" stroke="#10B981" strokeWidth={2} dot={false} type="stepAfter" />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <div className="flex items-center justify-center h-full text-gray-600 text-sm">Waiting for data...</div>}
                        </div>
                    </div>

                    {/* Depth Track: WOB */}
                    <div className="card flex flex-col">
                        <h3 className="text-sm font-bold text-gray-500 mb-2">WOB (ton)</h3>
                        <div className="flex-1">
                            {drillData.length > 0 ? (
                                <ResponsiveContainer>
                                    <LineChart layout="vertical" data={drillData}>
                                        <YAxis dataKey="depth" type="number" domain={['dataMin', 'dataMax']} reversed hide />
                                        <XAxis type="number" domain={[0, 'auto']} stroke="#6B7280" orientation="top" />
                                        <Tooltip cursor={{ stroke: 'white', strokeWidth: 1 }} contentStyle={{ backgroundColor: '#151E32' }} />
                                        <Line dataKey="wob" stroke="#F59E0B" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <div className="flex items-center justify-center h-full text-gray-600 text-sm">Waiting...</div>}
                        </div>
                    </div>

                    {/* Depth Track: Torque */}
                    <div className="card flex flex-col">
                        <h3 className="text-sm font-bold text-gray-500 mb-2">Torque (kft-lb)</h3>
                        <div className="flex-1">
                            {drillData.length > 0 ? (
                                <ResponsiveContainer>
                                    <LineChart layout="vertical" data={drillData}>
                                        <YAxis dataKey="depth" type="number" domain={['dataMin', 'dataMax']} reversed hide />
                                        <XAxis type="number" domain={[0, 'auto']} stroke="#6B7280" orientation="top" />
                                        <Tooltip cursor={{ stroke: 'white', strokeWidth: 1 }} contentStyle={{ backgroundColor: '#151E32' }} />
                                        <Line dataKey="torque" stroke="#EF4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <div className="flex items-center justify-center h-full text-gray-600 text-sm">Waiting...</div>}
                        </div>
                    </div>

                    {/* Live Parameters Panel */}
                    <div className="card space-y-4">
                        <h3 className="font-bold border-b border-white/10 pb-2">Live Parameters</h3>
                        <div className="space-y-4">
                            {panels.map((panel, idx) => {
                                const { value, className } = getParamValue(panel.key);
                                return (
                                    <ParamBox
                                        key={idx}
                                        label={panel.label}
                                        value={value}
                                        unit={panel.unit}
                                        className={className}
                                        onEdit={() => setEditingPanelIndex(idx)}
                                    />
                                );
                            })}
                        </div>

                        <div className="mt-8 p-4 bg-nov-blue/20 rounded border border-nov-blue/30">
                            <h4 className="text-nov-accent font-bold mb-2">Live MSE</h4>
                            <p className="text-sm text-gray-300">
                                MSE: <span className="font-bold text-white">{(liveParams.MSE || 0).toFixed(0)} psi</span>
                            </p>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex-1 card min-h-0 flex flex-col">
                    <h3 className="text-lg font-bold mb-4">Drilling Optimization (WOB vs ROP vs MSE) — Live</h3>
                    <div className="flex-1">
                        {pvrData.length > 0 ? (
                            <ResponsiveContainer>
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <XAxis type="number" dataKey="wob" name="WOB" unit="ton" stroke="#9CA3AF" label={{ value: 'Weight on Bit', position: 'bottom', fill: '#9CA3AF' }} />
                                    <YAxis type="number" dataKey="rop" name="ROP" unit="m/hr" stroke="#9CA3AF" label={{ value: 'Rate of Penetration', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                                    <ZAxis type="number" dataKey="mse" range={[50, 400]} name="MSE" unit="psi" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#151E32' }} />
                                    <Scatter name="Drilling Performance" data={pvrData} fill="#00A3E0" shape="circle" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-full text-gray-500">Waiting for drill data...</div>}
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-2">Bubble Size = Mechanical Specific Energy (MSE). Smaller bubbles = More Efficient.</p>
                </div>
            )}

            {/* Parameter Selection Dialog */}
            {editingPanelIndex !== null && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-nov-dark border border-gray-700 p-6 rounded-lg shadow-xl w-96">
                        <h3 className="text-xl font-bold mb-4">Select Parameter</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {AVAILABLE_PARAMS.map(param => (
                                <button
                                    key={param.key}
                                    className="w-full text-left p-3 rounded hover:bg-white/5 border border-transparent hover:border-white/10 flex justify-between items-center"
                                    onClick={() => handleParamSelect(param)}
                                >
                                    <span>{param.label}</span>
                                    {param.unit && <span className="text-xs text-gray-500">({param.unit})</span>}
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button className="btn bg-gray-700 hover:bg-gray-600" onClick={() => setEditingPanelIndex(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const ActivityIcon = ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);

const ParamBox = ({ label, value, unit, className, onEdit }) => (
    <div className="flex justify-between items-center group relative">
        <span className="text-gray-400">{label}</span>
        <div className="flex items-center gap-3">
            <span className={`font-mono font-bold text-lg ${className}`}>
                {value} <span className="text-sm text-gray-600 ml-1">{unit}</span>
            </span>
            <button
                onClick={onEdit}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                title="Change parameter"
            >
                <Settings size={14} />
            </button>
        </div>
    </div>
);
