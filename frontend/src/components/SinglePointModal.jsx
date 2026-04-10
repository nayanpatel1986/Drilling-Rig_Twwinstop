import React, { useState } from 'react';
import { X, Target, Save, AlertCircle } from 'lucide-react';
import { writeModbusCoil, writeModbusFloat, writeModbusRegister } from '../api';
import SafetyGate from './SafetyGate';

const SinglePointModal = ({ isOpen, onClose, data }) => {
    const [knownHeight, setKnownHeight] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showSafetyGate, setShowSafetyGate] = useState(false);

    if (!isOpen) return null;

    const deviceId = 1; // Twinstop Device ID
    
    // --> IMPORTANT: UPDATE THESE PLACEHOLDER MODBUS ADDRESSES <-- //
    const HEIGHT_ADDRESS = 528; // Modbus Address for the Float (Known Height)
    const CALIBRATION_DONE_COIL = 403; // Modbus Coil Address for MX50.3 boolean flag

    const handlePreSubmit = () => {
        if (!knownHeight) return;
        setShowSafetyGate(true);
    };

    const handleAction = async (pin) => {
        setShowSafetyGate(false);
        setLoading(true);
        setError(null);
        let errors = [];

        // 1. Write known height float
        try {
            const floatRes = await writeModbusFloat(deviceId, HEIGHT_ADDRESS, parseFloat(knownHeight || 0), pin);
            if (floatRes && !floatRes.success) {
                errors.push(`Height error: ${floatRes.error}`);
            }
        } catch (err) {
            errors.push(`Height exception: ${err.response?.data?.detail || err.message}`);
        }

        // 2. Write calibration done register pulse
        try {
            const regRes = await writeModbusRegister(deviceId, 36, 1, pin);
            if (regRes && !regRes.success) {
                errors.push(`Trigger error: ${regRes.error}`);
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
                await writeModbusRegister(deviceId, 36, 0, pin);
            }
        } catch (err) {
            errors.push(`Trigger exception: ${err.response?.data?.detail || err.message}`);
        }

        setLoading(false);

        if (errors.length > 0) {
            setError(errors.join(" | "));
        } else {
            // Success - Close Modal automatically
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1c23] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="text-purple-400" size={20} />
                        <h2 className="text-lg font-bold text-white uppercase tracking-tight">Single Point Config</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                            <span className="text-sm font-bold text-gray-400 uppercase">1. Block Height</span>
                            <div className="flex bg-black/40 rounded-lg border border-white/10 overflow-hidden">
                                <input 
                                    type="number" 
                                    placeholder="Enter Height (m)"
                                    className="w-full bg-transparent px-4 py-3 text-white focus:outline-none font-mono placeholder:text-gray-600 text-xl"
                                    value={knownHeight}
                                    onChange={(e) => setKnownHeight(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handlePreSubmit}
                            disabled={loading || !knownHeight}
                            className={`w-full py-3 rounded-xl font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg ${loading || !knownHeight ? 'bg-purple-500/20 text-purple-500/50 cursor-not-allowed border outline-none border-purple-500/10' : 'bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] active:scale-95 border border-purple-400/30'}`}
                        >
                            <Save size={20} className={loading ? 'animate-pulse' : ''} />
                            {loading ? 'CALIBRATING...' : 'CALIBRATION DONE'}
                        </button>
                    </div>

                    {/* Live Data Monitoring */}
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

                <div className="p-4 bg-white/5 border-t border-white/5 text-center flex flex-col items-center">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-relaxed">
                        This workflow assigns the known block height and triggers MX50.3 boolean flag simultaneously on the PLC.
                    </p>
                </div>
            </div>

            <SafetyGate 
                isOpen={showSafetyGate} 
                onClose={() => setShowSafetyGate(false)} 
                onSuccess={(pin) => handleAction(pin)}
                title="Calibration Safety Lock"
            />
        </div>
    );
};

export default SinglePointModal;
