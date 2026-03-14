import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff, Calculator, Lock, User, PlayCircle } from 'lucide-react';

export function Login({ onLogin, onStartTour }: { onLogin: () => void, onStartTour?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const email = username.includes('@')
      ? username.toLowerCase().trim()
      : `${username.toLowerCase().trim()}@nutricalc.local`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err: any) {
      console.error('Error de login:', err.code, err.message);
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-stone-50">
      {/* Subtle animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-100 rounded-full blur-3xl animate-pulse opacity-70" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-50 rounded-full blur-3xl animate-pulse opacity-70" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-stone-100 rounded-full blur-2xl animate-pulse opacity-50" style={{ animationDelay: '3s' }} />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-stone-200 w-full">

          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-md shadow-emerald-200 mb-4">
              <Calculator size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Calculadora Nutricional</h1>
            <p className="text-sm text-emerald-600 mt-1 font-medium">Iniciar Sesión</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm mb-5 text-center animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Usuario */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400 group-focus-within:text-emerald-600 transition-colors duration-200">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                placeholder="Usuario"
                required
              />
            </div>

            {/* Contraseña */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400 group-focus-within:text-emerald-600 transition-colors duration-200">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                placeholder="Contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden bg-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all duration-200 group shadow-sm"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Iniciando...
                    </>
                  ) : 'Iniciar Sesión'}
                </span>
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
              </button>

              {onStartTour && (
                <button
                  type="button"
                  onClick={onStartTour}
                  className="w-full flex items-center justify-center gap-2 py-2 text-stone-500 hover:text-emerald-600 text-sm font-medium transition-colors border border-dashed border-stone-300 rounded-xl hover:border-emerald-200 hover:bg-emerald-50/50"
                >
                  <PlayCircle size={16} />
                  ¿Eres nuevo? Ver Tutorial
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
