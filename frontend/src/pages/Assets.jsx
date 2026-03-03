import React, { useState, useEffect } from 'react';
import { EquipmentCard } from '../components/EquipmentCard';
import { getRigSensors } from '../api';

export default function Assets() {
    const [sensors, setSensors] = useState({});

    // Simulate live data feed tracking for Mud Pump run hours
    const [pumpHours, setPumpHours] = useState({ 1: 8500.1, 2: 8320.4 });

    useEffect(() => {
        const fetchSensors = async () => {
            const data = await getRigSensors();
            if (data && Object.keys(data).length > 0) setSensors(data);
        };
        fetchSensors();
        const interval = setInterval(fetchSensors, 2000);
        return () => clearInterval(interval);
    }, []);

    // Interval to actively increment running hours if SPM indicates running
    useEffect(() => {
        const simInterval = setInterval(() => {
            setPumpHours(prev => {
                const next = { ...prev };
                [1, 2].forEach(i => {
                    const key = `MudPump_${i}`;
                    const spm = sensors[key]?.SPM || 0;
                    if (spm > 10) {
                        // Increment by a tiny fraction so it moves visibly for demo purposes
                        next[i] = next[i] + (Math.random() * 0.005);
                    }
                });
                return next;
            });
        }, 1000);
        return () => clearInterval(simInterval);
    }, [sensors]);


    // Build pump cards from live Telegraf data
    const pumps = [1, 2].map(i => {
        const key = `MudPump_${i}`;
        const data = sensors[key] || {};
        const spm = data.SPM || 0;
        const isRunning = spm > 10;

        const runningHours = pumpHours[i];

        // Calculate alerts
        const activeAlerts = [];
        if (runningHours > 8550) {
            activeAlerts.push(`Liner Piston Change Recommended (Due at 8500h)`);
        } else if (spm > 120) {
            activeAlerts.push('High SPM Warning');
        }

        return {
            name: `Mud Pump #${i}`,
            type: 'Triplex Pump',
            health: isRunning ? Math.min(100, 70 + spm / 5) : 0,
            runningHours: runningHours,
            status: isRunning ? 'running' : 'standby',
            alerts: activeAlerts,
            metrics: [
                { label: 'SPM', value: spm.toFixed(0), unit: 'spm' },
                { label: 'Discharge', value: isRunning ? (3200 + Math.random() * 50).toFixed(0) : '0', unit: 'psi' },
                { label: 'Vibration', value: isRunning ? (0.2 + Math.random() * 0.3).toFixed(2) : '0', unit: 'ips' },
                { label: 'Lube Oil Press', value: isRunning ? (45 + Math.random() * 5).toFixed(1) : '0', unit: 'psi' },
                { label: 'Lube Oil Temp', value: isRunning ? (140 + Math.random() * 10).toFixed(1) : '75', unit: '°F' },
                { label: 'Motor Current', value: isRunning ? (850 + Math.random() * 50).toFixed(0) : '0', unit: 'A' },
            ]
        };
    });

    const hasData = Object.keys(sensors).length > 0;

    return (
        <div className="p-6 space-y-8">
            <header>
                <h1 className="text-3xl font-bold">Equipment Assets</h1>
                <p className="text-gray-400">
                    Digital Twin Condition Monitoring
                    {hasData ? (
                        <span className="ml-3 text-green-400 text-xs font-bold">● LIVE</span>
                    ) : (
                        <span className="ml-3 text-gray-500 text-xs">● CONNECTING...</span>
                    )}
                </p>
            </header>


            <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-nov-accent rounded-full" />
                    High Pressure Mud System
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pumps.map(p => (
                        <EquipmentCard key={p.name} {...p} />
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-nov-accent rounded-full" />
                    Hoisting System
                </h2>
                <div className="grid grid-cols-1 gap-6">
                    <EquipmentCard
                        name="Main Drawworks"
                        type="Gear Driven"
                        health={98}
                        runningHours={5000}
                        status="running"
                        metrics={[
                            { label: 'Hook Load', value: '205', unit: 'kdaN' },
                            { label: 'Block Vel', value: '0.5', unit: 'm/s' },
                            { label: 'Motor Current', value: '450', unit: 'A' }
                        ]}
                    />
                </div>
            </section>
        </div>
    );
}
