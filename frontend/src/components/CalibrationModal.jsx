import React, { useState } from 'react';
import { X, Target, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { writeModbusCoil, writeModbusFloat, writeModbusRegister } from '../api';
import SafetyGate from './SafetyGate';

const CalibrationModal = ({ isOpen, onClose, data }) => {
    const [hValues, setHValues] = useState({ h1: '', h2: '', h3: '' });
    const [loading, setLoading] = useState({});
    const [error, setError] = useState(null);
    const [showSafetyGate, setShowSafetyGate] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    if (!isOpen) return null;

    const deviceId = 1; // Twinstop Device ID

    const handleAction = (type, name, address, value) => {
        setPendingAction({ type, name, address, value });
        setShowSafetyGate(true);
    };

    const executeAction = async (pin) => {
        if (!pendingAction) return;
        const { type, name, address, value } = pendingAction;
        setPendingAction(null);
        setShowSafetyGate(false);

        setLoading(prev => ({ ...prev, [name]: true }));
        setError(null);
        try {
            let res;
            if (type === 'coil') {
                res = await writeModbusCoil(deviceId, address, value, pin);
            } else if (type === 'float') {
                res = await writeModbusFloat(deviceId, address, parseFloat(value), pin);
            } else if (type === 'pulse') {
                // Send 1 (Trigger)
                res = await writeModbusRegister(deviceId, address, 1, pin);
                if (res.success) {
                    // Wait 500ms
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // Send 0 (Return to zero)
                    await writeModbusRegister(deviceId, address, 0, pin);
                }
            }
            
            if (res && !res.success) {
                setError(`${name} failed: ${res.error}`);
            }
        } catch (err) {
            const apiError = err.response?.data?.detail || err.message || "Unknown error";
            setError(`${name}: ${apiError}`);
        } finally {
            setLoading(prev => ({ ...prev, [name]: false }));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1c23] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="text-cyan-400" size={20} />
                        <h2 className="text-lg font-bold text-white uppercase tracking-tight">Three Point Calibration</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Maintenance Section */}
                    <div className="flex gap-3 pb-4 border-b border-white/5">
                        <button 
                            onClick={() => handleAction('pulse', 'SET_ZERO', 34, 1)}
                            disabled={loading['SET_ZERO']}
                            className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} className={loading['SET_ZERO'] ? 'animate-spin' : ''} />
                            SET ZERO
                        </button>
                        <button 
                            onClick={() => handleAction('pulse', 'CAL_RESET', 33, 1)}
                            disabled={loading['CAL_RESET']}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} className={loading['CAL_RESET'] ? 'animate-spin' : ''} />
                            CAL RESET
                        </button>
                    </div>

                    {/* Calibration Points */}
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Point {i}</span>
                                    <div className="flex items-center gap-4">
                                        {/* Captured Value (Encoder Counts) - Raw data from PLC */}
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-gray-500 uppercase font-black leading-none mb-1">Captured</span>
                                            <span className="text-lg font-mono font-bold text-cyan-400 leading-none">
                                                {(data[`C${i}`] || 0).toFixed(0)}
                                            </span>
                                        </div>
                                        
                                        {/* Current Height Value - Displayed for operator validation */}
                                        <div className="flex flex-col items-end border-l border-white/10 pl-4">
                                            <span className="text-[10px] text-gray-500 uppercase font-black leading-none mb-1 text-amber-500/70">Current H{i}</span>
                                            <span className="text-lg font-mono font-bold text-amber-400 leading-none">
                                                {(data[`H${i}`] || 0).toFixed(2)}m
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button 
                                        onClick={() => handleAction('pulse', `CAPTURE_C${i}`, 29 + i, 1)}
                                        disabled={loading[`CAPTURE_C${i}`]}
                                        className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-bold px-4 py-2 rounded-lg border border-cyan-500/20 transition-all flex items-center gap-2 shrink-0"
                                    >
                                        <Target size={16} />
                                        CAPTURE
                                    </button>
                                    <span className="bg-amber-500/20 text-amber-400 font-mono font-bold text-sm px-2 py-2 rounded-lg border border-amber-500/30 shrink-0">
                                        H{i}
                                    </span>
                                    <div className="flex-1 flex bg-black/40 rounded-lg border border-white/10 overflow-hidden">
                                        <input 
                                            type="number" 
                                            placeholder={`Height ${i} (m)`}
                                            className="w-full bg-transparent px-3 py-2 text-white focus:outline-none font-mono placeholder:text-gray-600"
                                            value={hValues[`h${i}`]}
                                            onChange={(e) => setHValues(prev => ({ ...prev, [`h${i}`]: e.target.value }))}
                                        />
                                        <button 
                                            onClick={() => handleAction('float', `SET_H${i}`, 448 + (i-1)*16, hValues[`h${i}`])}
                                            disabled={loading[`SET_H${i}`]}
                                            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 transition-colors border-l border-white/10"
                                        >
                                            <Save size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Live Data Summary - For Monitoring During Calibration */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-cyan-500/5 rounded-xl p-3 border border-cyan-500/10 flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black text-cyan-500/70 uppercase tracking-widest mb-1 leading-none">Live Encoder</span>
                            <span className="text-2xl font-mono font-bold text-cyan-400 tracking-tighter leading-none pt-1">
                                {(data.EDMSCOUNT || 0).toFixed(0)}
                            </span>
                        </div>
                        <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mb-1 leading-none">Live Block Height</span>
                            <span className="text-2xl font-mono font-bold text-amber-400 tracking-tighter leading-none pt-1">
                                {(data.BLOCK_HEIGHT || 0).toFixed(2)}m
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
                        Calibration affects safety limits. Ensure block is steady before capture.
                    </p>
                </div>
            </div>

            <SafetyGate 
                isOpen={showSafetyGate} 
                onClose={() => setShowSafetyGate(false)} 
                onSuccess={(pin) => executeAction(pin)}
                title="Authorization Required"
            />
        </div>
    );
};

export default CalibrationModal;
