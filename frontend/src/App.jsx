import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Activity, Settings, Database, Gauge, FileText, LogOut, Menu, ChevronLeft, Eye, Zap, TrendingUp } from 'lucide-react'

import Assets from './pages/Assets'
import ConditionMonitoring from './pages/ConditionMonitoring'
import Reports from './pages/Reports'
import Login from './pages/Login'
import WellManager from './components/WellManager'
import Users from './pages/Users'
import DrillingOverview from './pages/DrillingOverview'
import PowerGeneration from './pages/PowerGeneration'
import BOP from './pages/BOP'
import LiveTrend from './pages/LiveTrend'

function ProtectedRoute({ children, isAuthenticated }) {
    if (!isAuthenticated) return <Navigate to="/login" />;
    return children;
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
    const [isAdmin, setIsAdmin] = useState(false); // Check token role in real app
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
    };

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />

                <Route path="/*" element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                        <div className="flex h-screen w-full bg-nov-dark text-white overflow-hidden">
                            {/* Sidebar */}
                            <aside className={`bg-slate-900 border-r border-white/10 flex flex-col transition-all duration-300 z-50 ${isSidebarOpen ? 'w-64 absolute h-full shadow-2xl md:relative' : 'w-20 relative'}`}>
                                <div className={`p-4 border-b border-white/10 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} h-[85px]`}>
                                    {isSidebarOpen ? (
                                        <div className="overflow-hidden">
                                        </div>
                                    ) : null}
                                    <button
                                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                                        title={isSidebarOpen ? "Collapse Menu" : "Expand Menu"}
                                    >
                                        {isSidebarOpen ? <ChevronLeft size={24} /> : <Menu size={24} />}
                                    </button>
                                </div>

                                <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-2 py-4 ${isSidebarOpen ? 'px-4' : 'px-2'}`}>
                                    <NavLink to="/overview" icon={<Eye size={20} />} label="Drilling Overview" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/power" icon={<Zap size={20} />} label="Power Generation" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/bop" icon={<Database size={20} />} label="BOP Dashboard" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/assets" icon={<Gauge size={20} />} label="Equipment Assets" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/trends" icon={<TrendingUp size={20} />} label="Live Trends" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/condition" icon={<Activity size={20} />} label="Condition Monitoring" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/reports" icon={<FileText size={20} />} label="Reports & Logs" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                    <NavLink to="/users" icon={<Settings size={20} />} label="User Management" isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />
                                </nav>

                                <div className={`p-4 border-t border-white/10 ${isSidebarOpen ? '' : 'flex justify-center flex-col items-center'}`}>
                                    <button
                                        onClick={handleLogout}
                                        className={`flex items-center text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg py-3 ${isSidebarOpen ? 'w-full gap-3 px-4' : 'justify-center p-3'}`}
                                        title="Logout"
                                    >
                                        <LogOut size={20} className="flex-shrink-0" />
                                        {isSidebarOpen && <span className="font-medium whitespace-nowrap">Logout</span>}
                                    </button>
                                </div>
                            </aside>

                            {/* Main Content */}
                            <main className="flex-1 overflow-auto bg-slate-900/50 relative w-full">
                                <WellManager />
                                <div className="p-6">
                                    <Routes>
                                        <Route path="/" element={<Navigate to="/overview" replace />} />
                                        <Route path="/overview" element={<DrillingOverview />} />
                                        <Route path="/power" element={<PowerGeneration />} />
                                        <Route path="/bop" element={<BOP />} />
                                        <Route path="/trends" element={<LiveTrend />} />
                                        <Route path="/assets" element={<Assets />} />
                                        <Route path="/condition" element={<ConditionMonitoring />} />
                                        <Route path="/reports" element={<Reports />} />
                                        <Route path="/users" element={<Users />} />
                                        <Route path="*" element={<div className="p-12 text-center text-gray-500">Page Not Found</div>} />
                                    </Routes>
                                </div>
                            </main>

                            {/* Overlay for mobile when sidebar is open */}
                            {isSidebarOpen && (
                                <div
                                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                                    onClick={() => setIsSidebarOpen(false)}
                                />
                            )}
                        </div>
                    </ProtectedRoute>
                } />
            </Routes>
        </BrowserRouter>
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
