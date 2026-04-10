import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Activity, Settings, Database, Gauge, FileText, LogOut, Menu, ChevronLeft, Eye, Zap, TrendingUp } from 'lucide-react'

import Assets from './pages/Assets'
import ConditionMonitoring from './pages/ConditionMonitoring'
import Reports from './pages/Reports'
import Login from './pages/Login'
import WellManager from './components/WellManager'
import Users from './pages/Users'

import PowerGeneration from './pages/PowerGeneration'
import BOP from './pages/BOP'
import LiveTrend from './pages/LiveTrend'
import DrillingTwin from './pages/DrillingTwin'
import EngineDetails from './pages/EngineDetails'
import { clearAuthSession, getStoredRole, hasStoredToken, isAdmin } from './auth';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, message: '' }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, message: error?.message || 'Unexpected application error' }
    }

    componentDidCatch(error) {
        console.error('App render error:', error)
    }

    handleReset = () => {
        clearAuthSession()
        window.location.href = '/login'
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-6">
                    <div className="max-w-lg w-full bg-slate-900 border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
                        <h1 className="text-2xl font-black mb-3">Application Recovery</h1>
                        <p className="text-red-300 mb-2">The page hit a client-side error while loading.</p>
                        <p className="text-sm text-slate-400 mb-6">{this.state.message}</p>
                        <button
                            onClick={this.handleReset}
                            className="px-5 py-3 rounded-lg bg-nov-accent text-white font-bold hover:bg-nov-accent/80 transition-colors"
                        >
                            Reset Session And Open Login
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

function ProtectedRoute({ children, isAuthenticated }) {
    if (!isAuthenticated) return <Navigate to="/login" />;
    return children;
}

function AppShell({ role, isSidebarOpen, setIsSidebarOpen, handleLogout }) {
    const location = useLocation();
    const isTwinPage = location.pathname === '/twin' || location.pathname === '/';
    const contentPaddingClass = isTwinPage ? 'px-1 pt-1 pb-4' : 'p-6';

    return (
        <div className="flex h-screen w-full bg-nov-dark text-white overflow-hidden relative">
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed top-4 left-4 z-50 p-2 bg-slate-800 border border-white/10 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors shadow-lg"
                    title="Open Menu"
                >
                    <Menu size={20} />
                </button>
            )}

            {isSidebarOpen && (
                <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-white/10 flex flex-col z-50 shadow-2xl animate-slideIn"
                    style={{ animation: 'slideIn 0.3s ease-out' }}
                >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between h-[85px]">
                        <span className="text-lg font-bold text-white">Menu</span>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                            title="Close Menu"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 py-4 px-4">
                        <NavLink to="/twin" icon={<LayoutDashboard size={20} />} label="Drilling Twin" isOpen={true} setOpen={setIsSidebarOpen} />
                        <NavLink to="/power" icon={<Zap size={20} />} label="Power Generation" isOpen={true} setOpen={setIsSidebarOpen} />
                        <NavLink to="/bop" icon={<Database size={20} />} label="BOP Dashboard" isOpen={true} setOpen={setIsSidebarOpen} />
                        <NavLink to="/assets" icon={<Gauge size={20} />} label="Equipment Assets" isOpen={true} setOpen={setIsSidebarOpen} />
                        <NavLink to="/trends" icon={<TrendingUp size={20} />} label="Live Trends" isOpen={true} setOpen={setIsSidebarOpen} />
                        <NavLink to="/condition" icon={<Activity size={20} />} label="Condition Monitoring" isOpen={true} setOpen={setIsSidebarOpen} />
                        <NavLink to="/reports" icon={<FileText size={20} />} label="Reports & Logs" isOpen={true} setOpen={setIsSidebarOpen} />
                        {isAdmin(role) && (
                            <NavLink to="/users" icon={<Settings size={20} />} label="User Management" isOpen={true} setOpen={setIsSidebarOpen} />
                        )}
                    </nav>

                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={handleLogout}
                            className="flex items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg py-3 w-full gap-3 px-4"
                            title="Logout"
                        >
                            <LogOut size={20} className="flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Logout</span>
                        </button>
                    </div>
                </aside>
            )}

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <main className="flex-1 overflow-auto bg-slate-900/50 relative w-full">
                <WellManager />
                <div className={contentPaddingClass}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/twin" replace />} />
                        <Route path="/twin" element={<DrillingTwin />} />
                        <Route path="/power" element={<PowerGeneration />} />
                        <Route path="/bop" element={<BOP />} />
                        <Route path="/trends" element={<LiveTrend />} />
                        <Route path="/assets" element={<Assets />} />
                        <Route path="/condition" element={<ConditionMonitoring />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/users" element={isAdmin(role) ? <Users /> : <Navigate to="/twin" replace />} />
                        <Route path="/engine/:id" element={<EngineDetails />} />
                        <Route path="*" element={<div className="p-12 text-center text-gray-500">Page Not Found</div>} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(hasStoredToken());
    const [role, setRole] = useState(getStoredRole());
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = () => {
        clearAuthSession();
        setIsAuthenticated(false);
        setRole('viewer');
    };

    return (
        <AppErrorBoundary>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login setAuth={setIsAuthenticated} setRole={setRole} />} />

                    <Route path="/*" element={
                        <ProtectedRoute isAuthenticated={isAuthenticated}>
                            <AppShell
                                role={role}
                                isSidebarOpen={isSidebarOpen}
                                setIsSidebarOpen={setIsSidebarOpen}
                                handleLogout={handleLogout}
                            />
                        </ProtectedRoute>
                    } />
                </Routes>
            </BrowserRouter>
        </AppErrorBoundary>
    )
}

function NavLink({ to, icon, label, isOpen, setOpen }) {
    return (
        <Link
            to={to}
            onClick={() => setOpen(false)}
            className={`flex items-center text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors group ${isOpen ? 'gap-3 px-4 py-3' : 'justify-center py-3'}`}
            title={!isOpen ? label : undefined}
        >
            <span className="text-gray-400 group-hover:text-nov-accent transition-colors flex-shrink-0">{icon}</span>
            {isOpen && <span className="font-medium whitespace-nowrap truncate">{label}</span>}
        </Link>
    )
}

export default App
