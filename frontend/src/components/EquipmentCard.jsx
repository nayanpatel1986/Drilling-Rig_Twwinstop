import React from 'react';
import { Settings, Thermometer, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

export const EquipmentCard = ({ name, type, health, runningHours, metrics = [], status = 'running', alerts = [] }) => {
    const isWarning = health < 70;
    const isCritical = health < 40;

    return (
        <div className={`card group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
      ${isCritical ? 'border-nov-danger/50 bg-nov-danger/5' :
                isWarning ? 'border-nov-warning/50 bg-nov-warning/5' : 'hover:border-nov-accent/30'}
    `}>
            {/* Status Overlays */}
            {isCritical && <AlertTriangle className="absolute -bottom-4 -right-4 text-nov-danger/10 w-24 h-24" />}
            {!isCritical && !isWarning && <CheckCircle className="absolute -bottom-4 -right-4 text-nov-success/10 w-24 h-24" />}

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-nov-accent transition-colors">{name}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{type}</p>
                </div>
                <div className={`
          px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1
          ${status === 'running' ? 'bg-nov-success/20 text-nov-success' : 'bg-gray-700 text-gray-400'}
        `}>
                    {status === 'running' && <div className="w-2 h-2 rounded-full bg-nov-success animate-pulse" />}
                    {status}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
                <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Health Index</p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-nov-danger' : isWarning ? 'bg-nov-warning' : 'bg-nov-success'
                                    }`}
                                style={{ width: `${health}%` }}
                            />
                        </div>
                        <span className="text-sm font-bold">{health}%</span>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Run Hours</p>
                    <p className="font-mono">{runningHours.toLocaleString()} h</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/5 pt-3 relative z-10">
                {metrics.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-slate-800/50 px-2 py-1.5 rounded border border-white/5">
                        <span className="text-gray-400 text-xs truncate max-w-[60%]" title={m.label}>{m.label}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono font-medium text-white">{m.value}</span>
                            <span className="text-[10px] text-gray-500">{m.unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {alerts.length > 0 && (
                <div className="mt-3 space-y-2 relative z-10">
                    {alerts.map((alert, idx) => (
                        <div key={idx} className="bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2 flex items-start gap-2">
                            <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-yellow-200">{alert}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
