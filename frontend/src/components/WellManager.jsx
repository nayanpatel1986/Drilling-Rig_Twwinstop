import React, { useState, useEffect } from 'react';
import { getActiveWell, endWell } from '../api';
import { Save, Check, Gauge, ArrowDownCircle, MapPin, Settings, Activity } from 'lucide-react';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { useLocation } from 'react-router-dom';

export default function WellManager() {
    const location = useLocation();
    const [activeWell, setActiveWell] = useState(null);

    const [savedLogo, setSavedLogo] = useState(() => localStorage.getItem('appLogoName') || 'DRILLBITTWIN');
    const [savedRig, setSavedRig] = useState(() => localStorage.getItem('appRigName') || 'E-1400 Rig Monitor');
    const [logoName, setLogoName] = useState(savedLogo);
    const [rigName, setRigName] = useState(savedRig);
    const [isSaved, setIsSaved] = useState(false);

    const { data: wsData } = useRealtimeData();
    const val = (k) => wsData?.[k] || 0;
    const rop = val('ROP');
    const hkld = val('HookLoad');
    const rigActivity = rop > 0.5 ? 'DRILLING' : hkld > 5 ? 'TRIPPING' : 'IDLE';
    const activityColor = rigActivity === 'DRILLING' ? 'bg-green-500' : rigActivity === 'TRIPPING' ? 'bg-yellow-500' : 'bg-cyan-500';
    const activityText = rigActivity === 'DRILLING' ? 'text-green-400' : rigActivity === 'TRIPPING' ? 'text-yellow-400' : 'text-cyan-400';

    const isEditing = logoName !== savedLogo || rigName !== savedRig;

    const fetchWell = async () => {
        const well = await getActiveWell();
        setActiveWell(well);
    };

    useEffect(() => {
        fetchWell();
    }, []);

    const handleSaveConfig = () => {
        localStorage.setItem('appLogoName', logoName);
        localStorage.setItem('appRigName', rigName);
        setSavedLogo(logoName);
        setSavedRig(rigName);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await createWell(form);
            setIsOpen(false);
            fetchWell();
        } catch (err) {
            alert("Failed to start well. Ensure no other well is active.");
        }
    };

    const handleEnd = async () => {
        // Shifted to Users.jsx Well Management Tab
        window.location.href = '/users';
    };

    return (
        <div className="px-3 py-1.5 bg-gray-900 border-b border-white/10 flex items-center h-[78px] relative">
            {/* Left: Logo and Rig Name */}
            <div className="flex-1 flex items-center">
                <div className="flex items-center gap-2 ml-12">
                    <div className="overflow-hidden flex flex-col justify-center">
                        <input
                            type="text"
                            value={logoName}
                            onChange={(e) => setLogoName(e.target.value)}
                            className="text-[18px] leading-none font-black tracking-tighter text-nov-accent bg-transparent border border-transparent hover:border-white/10 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-nov-accent/50 rounded block w-full px-1 m-0 transition-colors"
                            placeholder="Enter Logo Name"
                        />
                        <input
                            type="text"
                            value={rigName}
                            onChange={(e) => setRigName(e.target.value)}
                            className="text-[9px] leading-none text-gray-400 uppercase tracking-wider bg-transparent border border-transparent hover:border-white/10 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-nov-accent/50 rounded block w-full px-1 mt-1 transition-colors"
                            placeholder="Enter Rig Monitor Name"
                        />
                    </div>
                    {(isEditing || isSaved) && (
                        <button
                            onClick={handleSaveConfig}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Save Changes"
                        >
                            {isSaved ? <Check size={16} className="text-green-500" /> : <Save size={16} />}
                        </button>
                    )}

                    {/* ENHANCED DASHBOARD EDIT TOGGLE - Always checked case-insensitive for robustness */}
                    {/* DASHBOARD EDIT TOGGLE - Enabled for the Drilling Twin dashboard */}

                </div>
            </div>

            {/* Live Stats Center segment - Expanded to use space */}
            <div className="flex items-center gap-10 px-6 py-1 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="flex flex-col items-center min-w-[124px]">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.18em] mb-0.5 flex items-center gap-1.5">
                        <Gauge size={12} className={activityText} /> ACTIVITY
                    </span>
                    <span className={`text-[18px] leading-none font-black tracking-tighter ${activityText} drop-shadow-[0_0_10px_rgba(56,189,248,0.2)]`}>
                        {rigActivity}
                    </span>
                </div>
                
                <div className="w-px h-10 bg-white/10"></div>

                <div className="flex flex-col items-center min-w-[140px]">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.18em] mb-0.5 flex items-center gap-1.5">
                        <ArrowDownCircle size={12} className="text-cyan-500" /> HOLE DEPTH
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[17px] font-black text-blue-400 tracking-tighter tabular-nums leading-none">
                            {val('Depth').toFixed(2)}
                        </span>
                        <span className="text-[10px] text-blue-400/80 font-black">m</span>
                    </div>
                </div>

                <div className="w-px h-10 bg-white/10"></div>

                <div className="flex flex-col items-center min-w-[140px]">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.18em] mb-0.5 flex items-center gap-1.5">
                        <MapPin size={12} className="text-cyan-500" /> BIT POSITION
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[17px] font-black text-blue-400 tracking-tighter tabular-nums leading-none">
                            {val('BitDepth').toFixed(2)}
                        </span>
                        <span className="text-[10px] text-blue-400/80 font-black">m</span>
                    </div>
                </div>
            </div>

            {/* Right: Well Info and Actions */}
            <div className="flex-1 flex justify-end items-center gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Active Well:</span>
                    {activeWell ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-black text-nov-accent tracking-tight">{activeWell.name}</span>
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30 font-bold">LIVE</span>
                        </div>
                    ) : (
                        <span className="text-gray-600 italic text-xs tracking-tight">None</span>
                    )}
                </div>

                <div className="flex gap-2">
                    {/* Shifted to Well Management Tab */}
                </div>
            </div>
        </div>
    );
}
