import React, { useState, useEffect } from 'react';
import { getActiveWell, endWell } from '../api';
import { StopCircle, Save, Check } from 'lucide-react';

export default function WellManager() {
    const [activeWell, setActiveWell] = useState(null);

    const [savedLogo, setSavedLogo] = useState(() => localStorage.getItem('appLogoName') || 'DRILLBITTWIN');
    const [savedRig, setSavedRig] = useState(() => localStorage.getItem('appRigName') || 'E-1400 Rig Monitor');
    const [logoName, setLogoName] = useState(savedLogo);
    const [rigName, setRigName] = useState(savedRig);
    const [isSaved, setIsSaved] = useState(false);

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
        if (!activeWell) return;
        if (confirm("Are you sure you want to end the current well?")) {
            await endWell(activeWell.id);
            fetchWell();
        }
    };

    return (
        <div className="px-4 py-2 bg-gray-900 border-b border-white/10 flex justify-between items-center h-[65px]">
            <div className="flex items-center gap-3">
                <div className="overflow-hidden flex flex-col justify-center">
                    <input
                        type="text"
                        value={logoName}
                        onChange={(e) => setLogoName(e.target.value)}
                        className="text-xl font-black tracking-tighter text-nov-accent bg-transparent border border-transparent hover:border-white/10 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-nov-accent/50 rounded block w-full px-1 m-0 transition-colors"
                        placeholder="Enter Logo Name"
                    />
                    <input
                        type="text"
                        value={rigName}
                        onChange={(e) => setRigName(e.target.value)}
                        className="text-[10px] text-gray-400 uppercase tracking-wider bg-transparent border border-transparent hover:border-white/10 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-nov-accent/50 rounded block w-full px-1 m-0 transition-colors"
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
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">Active Well:</span>
                    {activeWell ? (
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-nov-accent">{activeWell.name}</span>
                            <span className="text-xs bg-green-500/20 text-green-500 px-2 rounded-full">Active</span>
                        </div>
                    ) : (
                        <span className="text-gray-500 italic">No Active Well</span>
                    )}
                </div>

                <div className="flex gap-2">
                    {activeWell && (
                        <button onClick={handleEnd} className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1 rounded hover:bg-red-500/20 text-sm">
                            <StopCircle size={16} /> End Well
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
