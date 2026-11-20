import React, { useState } from 'react';
import { disasterApi } from '../../api/client';
import { ShieldCheck, User, Lock, Mail, Phone, LogIn, UserPlus, X, AlertTriangle } from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const [tab, setTab] = useState('citizen_login'); // 'citizen_login', 'admin_login', 'register'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  if (!isOpen) return null;

  const handleFillDemoAdmin = () => {
    setUsername('admin');
    setPassword('Admin@123');
    setErrorMessage(null);
  };

  const handleFillDemoCitizen = () => {
    setUsername('citizen');
    setPassword('Citizen@123');
    setErrorMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (tab === 'register') {
        const res = await disasterApi.register({
          username: username.trim(),
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        });
        localStorage.setItem('rescuenet_token', res.data.token);
        localStorage.setItem('rescuenet_user', JSON.stringify(res.data.user));
        if (onAuthSuccess) onAuthSuccess(res.data.user);
        onClose();
      } else {
        const res = await disasterApi.login(username.trim(), password);
        localStorage.setItem('rescuenet_token', res.data.token);
        localStorage.setItem('rescuenet_user', JSON.stringify(res.data.user));
        if (onAuthSuccess) onAuthSuccess(res.data.user);
        onClose();
      }
    } catch (err) {
      console.error('Authentication error', err);
      const msg = err.response?.data?.detail || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Modal Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-slate-100 text-sm">RESCUENET AI ACCESS</h3>
              <p className="text-[10px] text-slate-400">Role-Based Emergency Authentication Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-slate-950/60 p-1 border-b border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => { setTab('citizen_login'); setErrorMessage(null); }}
            className={`py-2 rounded font-bold transition ${
              tab === 'citizen_login'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Citizen Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('admin_login'); setErrorMessage(null); }}
            className={`py-2 rounded font-bold transition ${
              tab === 'admin_login'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Commander Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMessage(null); }}
            className={`py-2 rounded font-bold transition ${
              tab === 'register'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Citizen
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-950/80 border border-red-500 rounded-lg text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-slate-400 mb-1">FULL NAME:</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kavitha Ramanathan"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">EMAIL ADDRESS:</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. kavitha@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">PHONE NUMBER (FOR SOS RESCUE):</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="tel"
                      placeholder="e.g. +91 98401 23456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-slate-400 mb-1">USERNAME:</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder={tab === 'admin_login' ? 'admin' : 'citizen'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">PASSWORD:</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick Demo Fill Buttons */}
            {tab === 'admin_login' && (
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Demo Commander: admin / Admin@123</span>
                <button
                  type="button"
                  onClick={handleFillDemoAdmin}
                  className="text-[10px] text-purple-400 hover:text-purple-300 underline"
                >
                  Auto-Fill Admin
                </button>
              </div>
            )}

            {tab === 'citizen_login' && (
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Demo Citizen: citizen / Citizen@123</span>
                <button
                  type="button"
                  onClick={handleFillDemoCitizen}
                  className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                >
                  Auto-Fill Citizen
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-4 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-white shadow-lg transition active:scale-[0.99] disabled:opacity-50 ${
                tab === 'admin_login'
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-950/60'
                  : tab === 'register'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/60'
              }`}
            >
              {tab === 'register' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              <span>
                {loading
                  ? 'VERIFYING CREDENTIALS...'
                  : tab === 'register'
                  ? 'COMPLETE CITIZEN REGISTRATION'
                  : tab === 'admin_login'
                  ? 'SIGN IN TO COMMAND CENTER'
                  : 'SIGN IN AS CITIZEN'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default AuthModal;
