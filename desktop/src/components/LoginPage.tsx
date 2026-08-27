import { useState, useRef, useEffect } from 'react';
import { Delete, Lock } from 'lucide-react';

interface Props {
  onLogin: (pin: string) => Promise<{ error: string | null }>;
}

const PIN_LENGTH = 4;

export default function LoginPage({ onLogin }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { containerRef.current?.focus(); }, []);

  const addDigit = (d: string) => {
    if (digits.length >= PIN_LENGTH || loading) return;
    const next = [...digits, d];
    setDigits(next);
    setError('');
    if (next.length === PIN_LENGTH) submitPin(next.join(''));
  };

  const removeDigit = () => { if (!loading) setDigits(prev => prev.slice(0, -1)); setError(''); };
  const clearAll = () => { if (!loading) { setDigits([]); setError(''); } };

  const submitPin = async (pin: string) => {
    setLoading(true);
    const result = await onLogin(pin);
    if (result.error) {
      setError(result.error);
      setShake(true);
      setTimeout(() => { setShake(false); setDigits([]); }, 500);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') addDigit(e.key);
    else if (e.key === 'Backspace') removeDigit();
    else if (e.key === 'Escape') clearAll();
  };

  const numpad = [['1','2','3'],['4','5','6'],['7','8','9'],['C','0','DEL']];

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="min-h-screen bg-gray-50 flex items-center justify-center p-4 outline-none">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500 shadow-lg mb-5">
            <span className="text-white font-black text-3xl">MC</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">MA CAISSE</h1>
          <p className="text-gray-500 mt-1 text-sm">Version Desktop</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={18} className="text-gray-400" />
            <h2 className="text-lg font-bold text-gray-800">Entrez votre code PIN</h2>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 text-center">{error}</div>
          )}

          <div className={`flex items-center justify-center gap-4 mb-8 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div key={i} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-200 ${
                i < digits.length ? 'bg-emerald-500 border-emerald-500 scale-105 shadow-md shadow-emerald-200' :
                i === digits.length ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
              }`}>
                {i < digits.length && <div className="w-3 h-3 rounded-full bg-white" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {numpad.flat().map(key => {
              if (key === 'DEL') return (
                <button key={key} onClick={removeDigit} disabled={loading}
                  className="h-16 rounded-2xl flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 transition-all duration-150 active:scale-95 disabled:opacity-40">
                  <Delete size={22} />
                </button>
              );
              if (key === 'C') return (
                <button key={key} onClick={clearAll} disabled={loading}
                  className="h-16 rounded-2xl flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-500 font-bold text-sm transition-all duration-150 active:scale-95 disabled:opacity-40">
                  Effacer
                </button>
              );
              return (
                <button key={key} onClick={() => addDigit(key)} disabled={loading}
                  className="h-16 rounded-2xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:bg-emerald-50 text-gray-800 font-bold text-2xl transition-all duration-150 active:scale-95 border border-gray-100 hover:border-gray-200 disabled:opacity-40">
                  {key}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                Verification...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
