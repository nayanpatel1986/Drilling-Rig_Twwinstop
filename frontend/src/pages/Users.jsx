import React, { useState, useEffect } from 'react';
import { getUsers, registerUser, getWitsmlConfigs, createWitsmlConfig, updateWitsmlConfig, activateWitsmlConfig, deleteWitsmlConfig, bulkUpdateMappings, getModbusDevices, createModbusDevice, updateModbusDevice, deleteModbusDevice, toggleModbusDevice, bulkUpdateRegisters, testWitsmlConnection, browseWitsmlWells, browseWitsmlWellbores, browseWitsmlLogs, getRigData, getHealth, getActiveWell, createWell } from '../api';
import { User, Plus, Shield, ShieldAlert, Server, Trash2, Edit3, Power, CheckCircle, XCircle, ChevronDown, ChevronRight, Save, RotateCcw, ArrowRightLeft, Cpu, Wifi, WifiOff, LayoutPanelTop, Search, Loader2 } from 'lucide-react';

export default function Users() {
    const [activeTab, setActiveTab] = useState('users');

    return (
        <div className="p-6">
            <header className="mb-6">
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-gray-400">Manage system access, roles, WITSML and Modbus configuration</p>
            </header>

            {/* Tab Bar */}
            <div className="flex gap-1 mb-6 bg-gray-800/60 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'users'
                        ? 'bg-nov-accent text-white shadow-lg shadow-nov-accent/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <User size={16} /> Users
                </button>
                <button
                    onClick={() => setActiveTab('witsml')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'witsml'
                        ? 'bg-nov-accent text-white shadow-lg shadow-nov-accent/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Server size={16} /> WITSML Configuration
                </button>
                <button
                    onClick={() => setActiveTab('modbus')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'modbus'
                        ? 'bg-nov-accent text-white shadow-lg shadow-nov-accent/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Cpu size={16} /> Modbus Configuration
                </button>
                <button
                    onClick={() => setActiveTab('wells')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'wells'
                        ? 'bg-nov-accent text-white shadow-lg shadow-nov-accent/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <LayoutPanelTop size={16} /> Well Management
                </button>
            </div>

            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'witsml' && <WitsmlTab />}
            {activeTab === 'modbus' && <ModbusTab />}
            {activeTab === 'wells' && <WellManagementTab />}
        </div>
    );
}

// ─── Well Management Tab ────────────────────────────────────
function WellManagementTab() {
    const [activeWell, setActiveWell] = useState(null);
    const [form, setForm] = useState({ name: '', api_number: '', operator: 'NOV', description: '' });

    const fetchWell = async () => {
        const well = await getActiveWell();
        setActiveWell(well);
    };

    useEffect(() => {
        fetchWell();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await createWell(form);
            setForm({ name: '', api_number: '', operator: 'NOV', description: '' });
            fetchWell();
            alert("New well created and activated successfully.");
        } catch (err) {
            alert("Failed to start well. Ensure no other well is active.");
        }
    };

    return (
        <div className="card bg-gray-800/40 border border-white/5 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <LayoutPanelTop className="text-nov-accent" /> Start New Well
            </h2>

            {activeWell ? (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg mb-4">
                    <p className="font-semibold text-sm">A well is currently active.</p>
                    <p className="text-xs text-gray-400 mt-1">
                        You cannot start a new well until the current active well ({activeWell.name}) is ended from the top navigation bar.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleCreate} className="space-y-4 max-w-xl">
                    <FormField label="Well Name *">
                        <input
                            placeholder="e.g. Well A"
                            required
                            className={inputClass}
                            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </FormField>
                    <FormField label="API Number *">
                        <input
                            placeholder="e.g. 42-123-45678"
                            required
                            className={inputMonoClass}
                            value={form.api_number} onChange={e => setForm({ ...form, api_number: e.target.value })}
                        />
                    </FormField>
                    <div className="pt-2">
                        <button type="submit" className="w-full py-2.5 bg-nov-accent rounded-lg text-white font-bold hover:bg-nov-accent/80 transition-colors">
                            Start Active Well
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// ─── Users Tab ──────────────────────────────────────────────
function UsersTab() {
    const [users, setUsers] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data);
            setError('');
        } catch (err) {
            if (err.response) {
                if (err.response.status === 401) {
                    setError('Session expired or unauthorized. Please log in again.');
                } else if (err.response.status === 403) {
                    setError('Access denied: Only administrators can view users.');
                } else {
                    setError(`Failed to fetch users: ${err.response.data?.detail || err.response.statusText}`);
                }
            } else {
                setError('Failed to fetch users. Network error.');
            }
        }
    };
    useEffect(() => { fetchUsers(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await registerUser(form.username, form.email, form.password);
            setIsOpen(false);
            setForm({ username: '', email: '', password: '' });
            fetchUsers();
        } catch { alert("Failed to create user. Username might be taken."); }
    };

    return (
        <>
            <div className="flex justify-end mb-4">
                <button onClick={() => setIsOpen(true)} className="btn bg-nov-accent hover:bg-nov-accent/80 text-white flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors">
                    <Plus size={16} /> Add User
                </button>
            </div>
            {error && <div className="bg-red-500/20 text-red-500 p-3 rounded mb-4">{error}</div>}
            <div className="card overflow-hidden bg-gray-800/40 border border-white/5 rounded-xl">
                <table className="w-full text-left border-collapse">
                    <thead><tr className="text-gray-500 text-sm border-b border-white/10"><th className="p-4">User</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Status</th></tr></thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.username} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-4 flex items-center gap-3"><div className="p-2 bg-gray-700 rounded-full"><User size={16} /></div><span className="font-bold">{user.username}</span></td>
                                <td className="p-4 text-gray-400">{user.email}</td>
                                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1 ${user.role === 'admin' ? 'bg-nov-accent/20 text-nov-accent' : 'bg-gray-700 text-gray-300'}`}>{user.role === 'admin' ? <ShieldAlert size={12} /> : <Shield size={12} />}{user.role.toUpperCase()}</span></td>
                                <td className="p-4"><span className="text-green-500 text-sm">Active</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-96 border border-gray-700 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Add New User</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input placeholder="Username" required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:border-nov-accent focus:outline-none" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                            <input placeholder="Email" type="email" required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:border-nov-accent focus:outline-none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            <input placeholder="Password" type="password" required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:border-nov-accent focus:outline-none" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-nov-accent rounded-lg text-white font-bold">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Reusable Components ────────────────────────────────────
const inputClass = "w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:border-nov-accent focus:outline-none transition-colors text-sm";
const inputMonoClass = inputClass + " font-mono";

function FormField({ label, children }) {
    return <div><label className="text-xs text-gray-400 mb-1 block">{label}</label>{children}</div>;
}

function FormSection({ title, expanded, onToggle, children }) {
    return (
        <div className="border border-white/5 rounded-lg overflow-hidden">
            <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-3 bg-gray-900/50 text-sm font-semibold text-gray-300 hover:bg-gray-900/80 transition-colors">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {title}
            </button>
            {expanded && <div className="p-4 space-y-3">{children}</div>}
        </div>
    );
}

// ─── WITSML Configuration Tab ───────────────────────────────
function WitsmlTab() {
    const [configs, setConfigs] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);
    const [expandedConfigId, setExpandedConfigId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [testStatus, setTestStatus] = useState(null);
    const [rigData, setRigData] = useState(null);
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [witsmlConnected, setWitsmlConnected] = useState(false);

    // Browse state
    const [browseWells, setBrowseWells] = useState([]);
    const [browseWellbores, setBrowseWellbores] = useState([]);
    const [browseLogs, setBrowseLogs] = useState([]);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [browseError, setBrowseError] = useState('');

    const [openSections, setOpenSections] = useState({
        server: true, well: true,
    });
    const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

    const emptyForm = {
        name: '',
        server_url: '', username: '', password: '', witsml_version: '1.4.1.1',
        well_uid: '', wellbore_uid: '', log_uid: '', well_name: '', well_number: '',
        api_number: '', operator_name: '', field_name: '', county: '', state: '', country: '',
        surface_latitude: '', surface_longitude: '',
        rig_name: '', rig_type: '', contractor: '',
        kb_elevation: '', ground_elevation: '', water_depth: '', planned_total_depth: '',
        current_depth: '', bit_size: '', casing_od: '', casing_depth: '',
        max_rop: '', max_wob: '', max_rpm: '', max_torque: '', max_spp: '', max_flow_rate: '', max_hook_load: '',
        mud_type: '', mud_weight: '', mud_viscosity: '', flow_rate_in: '',
        service_company: '', engineer_name: '', data_interval_time: '', data_interval_depth: '',
    };
    const [form, setForm] = useState(emptyForm);

    const fetchConfigs = async () => {
        try { setLoading(true); setConfigs(await getWitsmlConfigs()); setError(''); }
        catch { setError('Failed to fetch WITSML configurations.'); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchConfigs(); }, []);

    // Status Polling
    useEffect(() => {
        const fetchStatus = async () => {
            const rData = await getRigData();
            setRigData(rData);
            const health = await getHealth();
            setIsLiveMode(health.live_mode);
            setWitsmlConnected(health.witsml_connected || false);
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const resetBrowse = () => { setBrowseWells([]); setBrowseWellbores([]); setBrowseLogs([]); setBrowseError(''); };
    const openCreate = () => { setEditingConfig(null); setForm(emptyForm); setTestStatus(null); resetBrowse(); setOpenSections({ server: true, well: true }); setIsOpen(true); };

    const openEdit = (cfg) => {
        setTestStatus(null);
        resetBrowse();
        setEditingConfig(cfg);
        const f = {};
        for (const key of Object.keys(emptyForm)) { f[key] = cfg[key] != null ? String(cfg[key]) : ''; }
        f.password = '';
        setForm(f);
        setOpenSections({ server: true, well: true });
        setIsOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const numberFields = [
                'surface_latitude', 'surface_longitude', 'kb_elevation', 'ground_elevation',
                'water_depth', 'planned_total_depth', 'current_depth', 'bit_size', 'casing_depth',
                'max_rop', 'max_wob', 'max_rpm', 'max_torque', 'max_spp', 'max_flow_rate', 'max_hook_load',
                'mud_weight', 'mud_viscosity', 'flow_rate_in', 'data_interval_time', 'data_interval_depth',
            ];
            const payload = {};
            for (const [key, value] of Object.entries(form)) {
                if (editingConfig && key === 'password' && !value) continue;
                if (value === '' || value === null || value === undefined) { payload[key] = null; }
                else if (numberFields.includes(key)) { payload[key] = parseFloat(value); }
                else { payload[key] = value; }
            }
            if (editingConfig) { await updateWitsmlConfig(editingConfig.id, payload); }
            else { await createWitsmlConfig(payload); }
            setIsOpen(false); setForm(emptyForm); setEditingConfig(null); setTestStatus(null); fetchConfigs();
        } catch { alert('Failed to save WITSML configuration.'); }
    };

    const handleTestConnection = async () => {
        setTestStatus({ loading: true, error: null, success: null, details: null });
        try {
            const req = {
                server_url: form.server_url,
                username: form.username,
                password: form.password,
                witsml_version: form.witsml_version
            };
            const result = await testWitsmlConnection(req);
            if (result.status === 'success') {
                setTestStatus({ loading: false, error: null, success: result.message, details: result.details });
            } else {
                setTestStatus({ loading: false, error: result.message, success: null, details: result.details });
            }
        } catch (e) {
            setTestStatus({ loading: false, error: 'Network Error', success: null, details: 'Could not reach the backend API to perform the test.' });
        }
    };

    const handleActivate = async (id) => { try { await activateWitsmlConfig(id); fetchConfigs(); } catch { alert('Failed to activate.'); } };
    const handleDelete = async (id) => { if (!confirm('Delete this WITSML configuration?')) return; try { await deleteWitsmlConfig(id); fetchConfigs(); } catch { alert('Failed to delete.'); } };
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

    // ── Browse Handlers ──
    const getServerCredentials = () => ({
        server_url: form.server_url,
        username: form.username,
        password: form.password || (editingConfig ? editingConfig.password : ''),
    });

    const handleBrowseWells = async () => {
        if (!form.server_url) { setBrowseError('Enter a Server URL first.'); return; }
        setBrowseLoading(true); setBrowseError('');
        try {
            const res = await browseWitsmlWells(getServerCredentials());
            if (res.status === 'success' && res.wells.length > 0) {
                setBrowseWells(res.wells);
                setBrowseWellbores([]); setBrowseLogs([]);
            } else {
                setBrowseError(res.message || 'No wells found on server.');
            }
        } catch (e) { setBrowseError('Failed to browse server.'); }
        finally { setBrowseLoading(false); }
    };

    const handleSelectWell = async (uid) => {
        const well = browseWells.find(w => w.uid === uid);
        setForm(f => ({ ...f, well_uid: uid, well_name: well?.name || '', wellbore_uid: '', log_uid: '' }));
        setBrowseWellbores([]); setBrowseLogs([]);
        if (!uid) return;
        setBrowseLoading(true);
        try {
            const res = await browseWitsmlWellbores({ ...getServerCredentials(), well_uid: uid });
            if (res.status === 'success') setBrowseWellbores(res.wellbores);
        } catch { }
        finally { setBrowseLoading(false); }
    };

    const handleSelectWellbore = async (uid) => {
        setForm(f => ({ ...f, wellbore_uid: uid, log_uid: '' }));
        setBrowseLogs([]);
        if (!uid || !form.well_uid) return;
        setBrowseLoading(true);
        try {
            const res = await browseWitsmlLogs({ ...getServerCredentials(), well_uid: form.well_uid, wellbore_uid: uid });
            if (res.status === 'success') setBrowseLogs(res.logs);
        } catch { }
        finally { setBrowseLoading(false); }
    };

    const handleSelectLog = (uid) => {
        setForm(f => ({ ...f, log_uid: uid }));
    };

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <div className={`bg-gray-800/60 border ${witsmlConnected ? 'border-green-500/30' : (isLiveMode ? 'border-red-500/30' : 'border-nov-accent/30')} px-4 py-1.5 rounded-full flex items-center gap-2`}>
                    <div className={`w-2 h-2 rounded-full ${witsmlConnected ? 'bg-green-500' : (isLiveMode ? 'bg-red-500' : 'bg-nov-accent')} animate-pulse`} />
                    <span className={`font-mono text-[10px] font-bold tracking-wider ${witsmlConnected ? 'text-green-400' : (isLiveMode ? 'text-red-400' : 'text-nov-accent')}`}>
                        {witsmlConnected
                            ? (rigData ? 'LIVE MODE (WITSML)' : 'CONNECTED (WITSML) - No Data')
                            : (isLiveMode ? 'DISCONNECTED (WITSML)' : 'DEMO MODE (SIMULATOR)')}
                    </span>
                </div>
                <button onClick={openCreate} className="btn bg-nov-accent hover:bg-nov-accent/80 text-white flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors">
                    <Plus size={16} /> Add Configuration
                </button>
            </div>
            {error && <div className="bg-red-500/20 text-red-500 p-3 rounded-lg mb-4">{error}</div>}
            {loading ? (
                <div className="text-center text-gray-500 py-12">Loading...</div>
            ) : configs.length === 0 ? (
                <div className="bg-gray-800/40 border border-white/5 rounded-xl p-12 text-center">
                    <Server size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">No WITSML Configurations</h3>
                    <p className="text-gray-500 text-sm">Add a WITSML server configuration to get started.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {configs.map(cfg => (
                        <div key={cfg.id} className={`bg-gray-800/40 border rounded-xl transition-all duration-200 ${cfg.is_active ? 'border-green-500/40 shadow-lg shadow-green-500/5' : 'border-white/5'}`}>
                            <div className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-lg font-bold truncate">{cfg.name}</h3>
                                            {cfg.is_active ? (
                                                <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full"><CheckCircle size={12} /> ACTIVE</span>
                                            ) : (
                                                <span className="flex items-center gap-1 bg-gray-700/50 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full"><XCircle size={12} /> INACTIVE</span>
                                            )}
                                            <span className="bg-blue-500/15 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">v{cfg.witsml_version}</span>
                                            <span className="bg-purple-500/15 text-purple-400 text-xs px-2 py-0.5 rounded">
                                                {cfg.channel_mappings?.length || 0} channels
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-2 text-sm">
                                            <InfoCell label="Server URL" value={cfg.server_url} mono />
                                            <InfoCell label="Operator" value={cfg.operator_name} />
                                            <InfoCell label="Well Name" value={cfg.well_name} />
                                            <InfoCell label="Rig Name" value={cfg.rig_name} />
                                            <InfoCell label="Field" value={cfg.field_name} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-4 shrink-0">
                                        <button onClick={() => setExpandedConfigId(expandedConfigId === cfg.id ? null : cfg.id)} title="Data Channels"
                                            className={`p-2 rounded-lg transition-colors ${expandedConfigId === cfg.id ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 hover:bg-white/5'}`}>
                                            <ArrowRightLeft size={18} />
                                        </button>
                                        {!cfg.is_active && (
                                            <button onClick={() => handleActivate(cfg.id)} title="Activate" className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"><Power size={18} /></button>
                                        )}
                                        <button onClick={() => openEdit(cfg)} title="Edit" className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"><Edit3 size={18} /></button>
                                        <button onClick={() => handleDelete(cfg.id)} title="Delete" className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Channel Mappings Panel ── */}
                            {expandedConfigId === cfg.id && (
                                <ChannelMappingsPanel configId={cfg.id} mappings={cfg.channel_mappings || []} onSaved={fetchConfigs} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Add / Edit Modal ── */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-[680px] max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
                        <h2 className="text-xl font-bold mb-5">{editingConfig ? 'Edit WITSML Configuration' : 'Add WITSML Configuration'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <FormField label="Configuration Name *"><input required placeholder="e.g. Production Server" className={inputClass} value={form.name} onChange={set('name')} /></FormField>

                            <FormSection title="Server Connection" expanded={openSections.server} onToggle={() => toggleSection('server')}>
                                <FormField label="Server URL"><input placeholder="http://witsml-server:8080/witsml/store" className={inputMonoClass} value={form.server_url} onChange={set('server_url')} /></FormField>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Username"><input placeholder="Username" className={inputClass} value={form.username} onChange={set('username')} /></FormField>
                                    <FormField label={<>Password {editingConfig && <span className="text-gray-600">(leave blank to keep)</span>}</>}><input placeholder="Enter password" type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={set('password')} /></FormField>
                                </div>
                                <FormField label="WITSML Version"><select className={inputClass} value={form.witsml_version} onChange={set('witsml_version')}><option value="1.3.1.1">1.3.1.1</option><option value="1.4.1.1">1.4.1.1</option><option value="2.0">2.0 (ETP)</option></select></FormField>
                            </FormSection>

                            <FormSection title="Well Information" expanded={openSections.well} onToggle={() => toggleSection('well')}>
                                {/* Browse Server Button */}
                                <div className="flex items-center gap-3 mb-1">
                                    <button type="button" onClick={handleBrowseWells} disabled={browseLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/30 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                                        {browseLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                        {browseLoading ? 'Browsing...' : 'Browse Server'}
                                    </button>
                                    {browseWells.length > 0 && <span className="text-xs text-green-400">✓ Found {browseWells.length} well(s)</span>}
                                    {browseError && <span className="text-xs text-red-400">{browseError}</span>}
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <FormField label="Well UID">
                                        {browseWells.length > 0 ? (
                                            <select className={inputMonoClass} value={form.well_uid} onChange={e => handleSelectWell(e.target.value)}>
                                                <option value="">— Select Well —</option>
                                                {browseWells.map(w => <option key={w.uid} value={w.uid}>{w.name} ({w.uid.substring(0, 8)}…)</option>)}
                                            </select>
                                        ) : (
                                            <input placeholder="Well UID" className={inputMonoClass} value={form.well_uid} onChange={set('well_uid')} />
                                        )}
                                    </FormField>
                                    <FormField label="Wellbore UID">
                                        {browseWellbores.length > 0 ? (
                                            <select className={inputMonoClass} value={form.wellbore_uid} onChange={e => handleSelectWellbore(e.target.value)}>
                                                <option value="">— Select Wellbore —</option>
                                                {browseWellbores.map(w => <option key={w.uid} value={w.uid}>{w.name} ({w.uid.substring(0, 8)}…)</option>)}
                                            </select>
                                        ) : (
                                            <input placeholder="Wellbore UID" className={inputMonoClass} value={form.wellbore_uid} onChange={set('wellbore_uid')} />
                                        )}
                                    </FormField>
                                    <FormField label="Log UID">
                                        {browseLogs.length > 0 ? (
                                            <select className={inputMonoClass} value={form.log_uid} onChange={e => handleSelectLog(e.target.value)}>
                                                <option value="">— Select Log —</option>
                                                {browseLogs.map(l => <option key={l.uid} value={l.uid}>{l.name}</option>)}
                                            </select>
                                        ) : (
                                            <input placeholder="Log UID" className={inputMonoClass} value={form.log_uid} onChange={set('log_uid')} />
                                        )}
                                    </FormField>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Well Name"><input placeholder="Well Name" className={inputClass} value={form.well_name} onChange={set('well_name')} /></FormField>
                                    <FormField label="Well Number"><input placeholder="Well #" className={inputClass} value={form.well_number} onChange={set('well_number')} /></FormField>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="API Number"><input placeholder="API Number" className={inputMonoClass} value={form.api_number} onChange={set('api_number')} /></FormField>
                                    <FormField label="Operator"><input placeholder="Operator Name" className={inputClass} value={form.operator_name} onChange={set('operator_name')} /></FormField>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Field Name"><input placeholder="Field Name" className={inputClass} value={form.field_name} onChange={set('field_name')} /></FormField>
                                    <FormField label="County"><input placeholder="County" className={inputClass} value={form.county} onChange={set('county')} /></FormField>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="State / Province"><input placeholder="State" className={inputClass} value={form.state} onChange={set('state')} /></FormField>
                                    <FormField label="Country"><input placeholder="Country" className={inputClass} value={form.country} onChange={set('country')} /></FormField>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Surface Latitude"><input placeholder="e.g. 29.7604" type="number" step="any" className={inputMonoClass} value={form.surface_latitude} onChange={set('surface_latitude')} /></FormField>
                                    <FormField label="Surface Longitude"><input placeholder="e.g. -95.3698" type="number" step="any" className={inputMonoClass} value={form.surface_longitude} onChange={set('surface_longitude')} /></FormField>
                                </div>
                            </FormSection>

                            {/* Removed Rig, Drilling, Mud, and Service panels to save space and keep Test Connection buttons visible at the bottom of the modal */}

                            {/* Test Connection Results */}
                            {testStatus && testStatus.loading && (
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-sm text-center">
                                    Testing connection to server...
                                </div>
                            )}
                            {testStatus && testStatus.error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <h4 className="text-red-400 font-bold mb-1 flex items-center gap-1"><XCircle size={16} /> {testStatus.error}</h4>
                                    <p className="text-gray-400 text-xs">{testStatus.details}</p>
                                </div>
                            )}
                            {testStatus && testStatus.success && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <h4 className="text-green-400 font-bold mb-1 flex items-center gap-1"><CheckCircle size={16} /> {testStatus.success}</h4>
                                    <p className="text-gray-400 text-xs">{testStatus.details}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                <button type="button" onClick={handleTestConnection} disabled={testStatus && testStatus.loading} className="px-4 py-2 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                                    <Wifi size={14} /> Browse / Test Server
                                </button>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setIsOpen(false); setEditingConfig(null); setTestStatus(null); }} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                    <button type="submit" className="px-5 py-2 bg-nov-accent rounded-lg text-white font-bold hover:bg-nov-accent/80 transition-colors">{editingConfig ? 'Save Changes' : 'Create'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Channel Mappings Panel ─────────────────────────────────
function ChannelMappingsPanel({ configId, mappings, onSaved }) {
    const [rows, setRows] = useState(mappings.map(m => ({ ...m })));
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const updateRow = (idx, field, value) => {
        setRows(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
        setDirty(true);
    };

    const addRow = () => {
        setRows(prev => [...prev, { app_parameter: '', witsml_mnemonic: '', unit: '', scale_factor: 1.0, offset: 0.0, description: '' }]);
        setDirty(true);
    };

    const removeRow = (idx) => {
        setRows(prev => prev.filter((_, i) => i !== idx));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = rows
                .filter(r => r.app_parameter && r.witsml_mnemonic)
                .map(r => ({
                    app_parameter: r.app_parameter,
                    witsml_mnemonic: r.witsml_mnemonic,
                    unit: r.unit || null,
                    scale_factor: parseFloat(r.scale_factor) || 1.0,
                    offset: parseFloat(r.offset) || 0.0,
                    description: r.description || null,
                }));
            await bulkUpdateMappings(configId, payload);
            setDirty(false);
            onSaved();
        } catch {
            alert('Failed to save channel mappings.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setRows(mappings.map(m => ({ ...m })));
        setDirty(false);
    };

    return (
        <div className="border-t border-white/5 bg-gray-900/30 px-5 pb-5">
            <div className="flex items-center justify-between py-3">
                <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <ArrowRightLeft size={14} /> Data Channel Mappings
                    <span className="text-xs text-gray-500 font-normal ml-2">Map your WITSML source mnemonics → Application parameters</span>
                </h4>
                <div className="flex gap-2">
                    <button onClick={addRow} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <Plus size={12} /> Add Channel
                    </button>
                    {dirty && (
                        <>
                            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 transition-colors flex items-center gap-1">
                                <RotateCcw size={12} /> Reset
                            </button>
                            <button onClick={handleSave} disabled={saving} className="text-xs bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-semibold">
                                <Save size={12} /> {saving ? 'Saving...' : 'Save Mappings'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="rounded-lg border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-gray-800/60 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="px-3 py-2.5 w-48">App Parameter</th>
                            <th className="px-3 py-2.5 w-12 text-center">→</th>
                            <th className="px-3 py-2.5 w-40">WITSML Mnemonic</th>
                            <th className="px-3 py-2.5 w-24">Unit</th>
                            <th className="px-3 py-2.5 w-20">Scale</th>
                            <th className="px-3 py-2.5 w-20">Offset</th>
                            <th className="px-3 py-2.5">Description</th>
                            <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="px-2 py-1.5">
                                    <input className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1.5 text-sm font-mono focus:border-purple-500 focus:outline-none"
                                        value={row.app_parameter} onChange={e => updateRow(idx, 'app_parameter', e.target.value)} placeholder="e.g. HookLoad" />
                                </td>
                                <td className="text-center text-gray-600">→</td>
                                <td className="px-2 py-1.5">
                                    <input className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1.5 text-sm font-mono text-nov-accent focus:border-nov-accent focus:outline-none"
                                        value={row.witsml_mnemonic} onChange={e => updateRow(idx, 'witsml_mnemonic', e.target.value)} placeholder="e.g. HKLD" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                                        value={row.unit || ''} onChange={e => updateRow(idx, 'unit', e.target.value)} placeholder="klb" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1.5 text-sm font-mono text-center focus:border-gray-500 focus:outline-none"
                                        type="number" step="any" value={row.scale_factor} onChange={e => updateRow(idx, 'scale_factor', e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1.5 text-sm font-mono text-center focus:border-gray-500 focus:outline-none"
                                        type="number" step="any" value={row.offset} onChange={e => updateRow(idx, 'offset', e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1.5 text-sm text-gray-400 focus:border-gray-500 focus:outline-none"
                                        value={row.description || ''} onChange={e => updateRow(idx, 'description', e.target.value)} placeholder="Description" />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <button onClick={() => removeRow(idx)} className="text-red-500/50 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-6 text-gray-600 text-sm">No channel mappings. Click "Add Channel" to create one.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function InfoCell({ label, value, mono }) {
    return (
        <div>
            <span className="text-xs text-gray-500 block">{label}</span>
            <span className={`text-sm text-gray-300 truncate block ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
        </div>
    );
}

// ─── Modbus Configuration Tab ────────────────────────────────
function ModbusTab() {
    const [devices, setDevices] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [expandedReg, setExpandedReg] = useState(null);
    const [editingDevice, setEditingDevice] = useState(null);
    const [editDeviceForm, setEditDeviceForm] = useState({});
    const [editRegs, setEditRegs] = useState({});
    const [addForm, setAddForm] = useState({
        name: '', device_type: 'engine', ip_address: '', port: 502,
        slave_id: 1, protocol: 'tcp', baud_rate: 9600, timeout: '1s',
        measurement_name: 'rig_sensors'
    });

    const fetchDevices = async () => {
        try {
            const data = await getModbusDevices();
            setDevices(data);
        } catch { }
    };
    useEffect(() => { fetchDevices(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await createModbusDevice(addForm);
            setShowAdd(false);
            setAddForm({ name: '', device_type: 'engine', ip_address: '', port: 502, slave_id: 1, protocol: 'tcp', baud_rate: 9600, timeout: '1s', measurement_name: 'rig_sensors' });
            fetchDevices();
        } catch { }
    };

    const handleToggle = async (id) => { await toggleModbusDevice(id); fetchDevices(); };
    const handleDelete = async (id) => { if (confirm('Delete this device?')) { await deleteModbusDevice(id); fetchDevices(); } };

    const handleUpdate = async (id, data) => {
        try {
            await updateModbusDevice(id, data);
            setEditingDevice(null);
            fetchDevices();
        } catch { }
    };

    const openEdit = (dev) => {
        setEditingDevice(dev.id);
        setEditDeviceForm({
            name: dev.name, device_type: dev.device_type,
            ip_address: dev.ip_address || '', port: dev.port,
            slave_id: dev.slave_id, protocol: dev.protocol,
            baud_rate: dev.baud_rate, timeout: dev.timeout,
            measurement_name: dev.measurement_name,
        });
    };

    const toggleRegs = (id) => {
        if (expandedReg === id) { setExpandedReg(null); return; }
        setExpandedReg(id);
        const dev = devices.find(d => d.id === id);
        if (dev) setEditRegs({ ...editRegs, [id]: JSON.parse(JSON.stringify(dev.registers)) });
    };

    const updateReg = (devId, idx, field, value) => {
        const regs = [...(editRegs[devId] || [])];
        regs[idx] = { ...regs[idx], [field]: value };
        setEditRegs({ ...editRegs, [devId]: regs });
    };

    const addReg = (devId) => {
        const regs = [...(editRegs[devId] || [])];
        regs.push({ field_name: '', register_type: 'holding', address: 0, data_type: 'FLOAT32', byte_order: 'ABCD', scale: 1.0, unit: '' });
        setEditRegs({ ...editRegs, [devId]: regs });
    };

    const delReg = (devId, idx) => {
        const regs = [...(editRegs[devId] || [])];
        regs.splice(idx, 1);
        setEditRegs({ ...editRegs, [devId]: regs });
    };

    const saveRegs = async (devId) => {
        try {
            await bulkUpdateRegisters(devId, editRegs[devId]);
            fetchDevices();
        } catch { }
    };

    const inputClass = 'bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none w-full';
    const typeLabels = { engine: 'Engine', mudpump: 'Mud Pump', bop: 'BOP' };
    const typeColors = { engine: 'text-orange-400 bg-orange-400/15', mudpump: 'text-blue-400 bg-blue-400/15', bop: 'text-red-400 bg-red-400/15' };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-gray-400">{devices.length} device(s) configured</div>
                <button onClick={() => setShowAdd(true)} className="btn btn-primary flex items-center gap-2">
                    <Plus size={16} /> Add Modbus Device
                </button>
            </div>

            {/* Add Device Modal */}
            {showAdd && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-[520px] border border-gray-700 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Add Modbus Device</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Device Name *</label>
                                    <input required className={inputClass} placeholder="e.g. Engine 1"
                                        value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Device Type *</label>
                                    <select className={inputClass}
                                        value={addForm.device_type} onChange={e => setAddForm({ ...addForm, device_type: e.target.value })}>
                                        <option value="engine">Engine</option>
                                        <option value="mudpump">Mud Pump</option>
                                        <option value="bop">BOP</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Protocol</label>
                                    <select className={inputClass}
                                        value={addForm.protocol} onChange={e => setAddForm({ ...addForm, protocol: e.target.value })}>
                                        <option value="tcp">Modbus TCP</option>
                                        <option value="rtu">Modbus RTU</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">IP Address</label>
                                    <input className={inputClass} placeholder="192.168.1.10"
                                        value={addForm.ip_address} onChange={e => setAddForm({ ...addForm, ip_address: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Port</label>
                                    <input type="number" className={inputClass}
                                        value={addForm.port} onChange={e => setAddForm({ ...addForm, port: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Slave ID</label>
                                    <input type="number" className={inputClass}
                                        value={addForm.slave_id} onChange={e => setAddForm({ ...addForm, slave_id: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Timeout</label>
                                    <input className={inputClass}
                                        value={addForm.timeout} onChange={e => setAddForm({ ...addForm, timeout: e.target.value })} />
                                </div>
                            </div>
                            {addForm.protocol === 'rtu' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">Baud Rate</label>
                                    <select className={inputClass}
                                        value={addForm.baud_rate} onChange={e => setAddForm({ ...addForm, baud_rate: Number(e.target.value) })}>
                                        <option value={9600}>9600</option>
                                        <option value={19200}>19200</option>
                                        <option value={38400}>38400</option>
                                        <option value={115200}>115200</option>
                                    </select>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowAdd(false)} className="btn bg-gray-700 hover:bg-gray-600 text-gray-200">Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Device</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Device Cards */}
            <div className="space-y-4">
                {devices.map(dev => (
                    <div key={dev.id} className={`card border ${dev.is_enabled ? 'border-green-500/30' : 'border-gray-700'
                        } transition-all`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${typeColors[dev.device_type] || 'text-gray-400 bg-gray-400/15'}`}>
                                    <Cpu size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{dev.name}</h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-400">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeColors[dev.device_type] || ''}`}>
                                            {typeLabels[dev.device_type] || dev.device_type}
                                        </span>
                                        <span className={`font-mono ${dev.ip_address ? 'text-cyan-400' : 'text-red-400'}`}>{dev.ip_address || 'No IP'}:{dev.port}</span>
                                        <span>Slave {dev.slave_id}</span>
                                        <span className="uppercase text-xs">{dev.protocol}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1 text-xs font-bold ${dev.is_enabled ? 'text-green-400' : 'text-gray-500'
                                    }`}>
                                    {dev.is_enabled ? <Wifi size={14} /> : <WifiOff size={14} />}
                                    {dev.is_enabled ? 'ENABLED' : 'DISABLED'}
                                </span>
                                <button onClick={() => handleToggle(dev.id)}
                                    className={`p-2 rounded-lg transition-colors ${dev.is_enabled ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}>
                                    <Power size={16} />
                                </button>
                                <button onClick={() => openEdit(dev)} title="Edit Device"
                                    className="p-2 rounded-lg bg-gray-700 text-blue-400 hover:bg-blue-500/20 transition-colors">
                                    <Edit3 size={16} />
                                </button>
                                <button onClick={() => toggleRegs(dev.id)}
                                    className="p-2 rounded-lg bg-gray-700 text-cyan-400 hover:bg-gray-600 transition-colors">
                                    {expandedReg === dev.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                <button onClick={() => handleDelete(dev.id)}
                                    className="p-2 rounded-lg bg-gray-700 text-red-400 hover:bg-red-500/20 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* ── Inline Edit Form ── */}
                        {editingDevice === dev.id && (
                            <div className="mt-4 pt-4 border-t border-white/10 bg-gray-900/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                                <h4 className="font-bold text-sm text-blue-400 mb-3 flex items-center gap-2"><Edit3 size={14} /> Edit Device Connection</h4>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1 block">Device Name</label>
                                        <input className={inputClass} value={editDeviceForm.name}
                                            onChange={e => setEditDeviceForm({ ...editDeviceForm, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1 block">IP Address</label>
                                        <input className={inputClass} placeholder="e.g. 10.10.10.50" value={editDeviceForm.ip_address}
                                            onChange={e => setEditDeviceForm({ ...editDeviceForm, ip_address: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1 block">Port</label>
                                        <input type="number" className={inputClass} value={editDeviceForm.port}
                                            onChange={e => setEditDeviceForm({ ...editDeviceForm, port: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1 block">Slave ID</label>
                                        <input type="number" className={inputClass} value={editDeviceForm.slave_id}
                                            onChange={e => setEditDeviceForm({ ...editDeviceForm, slave_id: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1 block">Protocol</label>
                                        <select className={inputClass} value={editDeviceForm.protocol}
                                            onChange={e => setEditDeviceForm({ ...editDeviceForm, protocol: e.target.value })}>
                                            <option value="tcp">Modbus TCP</option>
                                            <option value="rtu">Modbus RTU</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 mb-1 block">Timeout</label>
                                        <input className={inputClass} value={editDeviceForm.timeout}
                                            onChange={e => setEditDeviceForm({ ...editDeviceForm, timeout: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingDevice(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                                    <button onClick={() => handleUpdate(dev.id, editDeviceForm)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                                        <Save size={14} /> Save Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Registers Table (expanded) */}
                        {expandedReg === dev.id && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-sm text-gray-300">Modbus Register Map — {dev.registers?.length || 0} registers</h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => addReg(dev.id)}
                                            className="text-xs bg-cyan-600/20 text-cyan-400 px-3 py-1 rounded hover:bg-cyan-600/30 flex items-center gap-1">
                                            <Plus size={12} /> Add Register
                                        </button>
                                        <button onClick={() => saveRegs(dev.id)}
                                            className="text-xs bg-green-600/20 text-green-400 px-3 py-1 rounded hover:bg-green-600/30 flex items-center gap-1">
                                            <Save size={12} /> Save
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-500 text-xs border-b border-white/10">
                                                <th className="text-left p-2">Field Name</th>
                                                <th className="text-left p-2">Type</th>
                                                <th className="text-left p-2">Address</th>
                                                <th className="text-left p-2">Data Type</th>
                                                <th className="text-left p-2">Byte Order</th>
                                                <th className="text-left p-2">Scale</th>
                                                <th className="text-left p-2">Unit</th>
                                                <th className="text-right p-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(editRegs[dev.id] || dev.registers || []).map((reg, idx) => (
                                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="p-2">
                                                        <input className="bg-transparent border border-gray-700 rounded px-2 py-1 text-white text-xs w-28"
                                                            value={reg.field_name} onChange={e => updateReg(dev.id, idx, 'field_name', e.target.value)} />
                                                    </td>
                                                    <td className="p-2">
                                                        <select className="bg-gray-900 border border-gray-700 rounded px-1 py-1 text-xs text-white"
                                                            value={reg.register_type} onChange={e => updateReg(dev.id, idx, 'register_type', e.target.value)}>
                                                            <option value="holding">Holding</option>
                                                            <option value="input">Input</option>
                                                            <option value="coil">Coil</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <input type="number" className="bg-transparent border border-gray-700 rounded px-2 py-1 text-cyan-400 font-mono text-xs w-16"
                                                            value={reg.address} onChange={e => updateReg(dev.id, idx, 'address', Number(e.target.value))} />
                                                    </td>
                                                    <td className="p-2">
                                                        <select className="bg-gray-900 border border-gray-700 rounded px-1 py-1 text-xs text-white"
                                                            value={reg.data_type} onChange={e => updateReg(dev.id, idx, 'data_type', e.target.value)}>
                                                            <option value="UINT16">UINT16</option>
                                                            <option value="INT16">INT16</option>
                                                            <option value="UINT32">UINT32</option>
                                                            <option value="INT32">INT32</option>
                                                            <option value="FLOAT32">FLOAT32</option>
                                                            <option value="FLOAT64">FLOAT64</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <select className="bg-gray-900 border border-gray-700 rounded px-1 py-1 text-xs text-white"
                                                            value={reg.byte_order} onChange={e => updateReg(dev.id, idx, 'byte_order', e.target.value)}>
                                                            <option value="ABCD">ABCD</option>
                                                            <option value="DCBA">DCBA</option>
                                                            <option value="BADC">BADC</option>
                                                            <option value="CDAB">CDAB</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <input type="number" step="0.01" className="bg-transparent border border-gray-700 rounded px-2 py-1 text-white text-xs w-14"
                                                            value={reg.scale} onChange={e => updateReg(dev.id, idx, 'scale', Number(e.target.value))} />
                                                    </td>
                                                    <td className="p-2">
                                                        <input className="bg-transparent border border-gray-700 rounded px-2 py-1 text-white text-xs w-14"
                                                            value={reg.unit || ''} onChange={e => updateReg(dev.id, idx, 'unit', e.target.value)} />
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        <button onClick={() => delReg(dev.id, idx)} className="text-red-400 hover:text-red-300">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {devices.length === 0 && (
                    <div className="text-center py-16 text-gray-500">
                        <Cpu size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg">No Modbus devices configured</p>
                        <p className="text-sm">Add your first engine, mud pump, or BOP device</p>
                    </div>
                )}
            </div>
        </>
    );
}
