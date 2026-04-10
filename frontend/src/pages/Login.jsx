import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api';
import { Lock, User } from 'lucide-react';
import { storeAuthSession } from '../auth';

export default function Login({ setAuth, setRole }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const data = await loginUser(username, password);
            storeAuthSession(data);
            setAuth(true);
            setRole(data.role);
            navigate('/');
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
            <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black tracking-tighter text-nov-accent">DRILLBIT<span className="text-white">TWIN</span></h1>
                    <p className="text-gray-400 mt-2">Sign in to your account</p>
                </div>

                {error && <div className="bg-red-500/20 text-red-500 p-3 rounded mb-4 text-sm text-center">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-gray-900 border border-gray-700 rounded py-2.5 pl-10 pr-4 text-white focus:border-nov-accent focus:ring-1 focus:ring-nov-accent outline-none transition-colors"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full bg-gray-900 border border-gray-700 rounded py-2.5 pl-10 pr-4 text-white focus:border-nov-accent focus:ring-1 focus:ring-nov-accent outline-none transition-colors"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-nov-accent hover:bg-nov-accent/90 text-white font-bold py-2.5 rounded transition-transform active:scale-95"
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}
