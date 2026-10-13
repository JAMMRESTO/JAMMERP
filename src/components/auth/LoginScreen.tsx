import { useState } from 'react';
import { UtensilsCrossed, Delete, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../lib/types';

export default function LoginScreen({ blocked }: { blocked?: boolean }) {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length < 4) {
      const newPin = pin + d;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => handleLoginWithPin(newPin), 100);
      }
    }
  };

  const handleDelete = () => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleLoginWithPin = async (pinValue: string) => {
    if (!pinValue) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('users')
      .select('*')
      .eq('pin', pinValue)
      .eq('actif', true)
      .maybeSingle();

    if (err || !data) {
      setError('PIN incorrect ou compte inactif');
      setPin('');
    } else {
      login(data as User);
    }
    setLoading(false);
  };

  const handleLogin = () => handleLoginWithPin(pin);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-4">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-amber-500/30">
            <UtensilsCrossed size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">THE WEST AFRICAN</h1>
          <p className="text-gray-400 mt-1 text-sm">Entrez votre PIN pour vous connecter</p>
        </div>

        <div className="flex justify-center gap-3 mb-5">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? 'bg-amber-500 border-amber-500 scale-110'
                  : 'bg-transparent border-gray-600'
              }`}
            />
          ))}
        </div>

        {blocked && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 text-sm text-center py-3 px-4 rounded-xl mb-4 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>Abonnement expire. L'application est bloquee. Seul le superadmin peut renouveler l'abonnement.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm text-center py-2 px-4 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-2">
          {digits.map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="bg-gray-700 hover:bg-gray-600 active:bg-amber-500 active:scale-95 text-white text-2xl font-semibold h-14 rounded-2xl transition-all duration-150 shadow-md"
            >
              {d}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleDelete}
            className="bg-gray-700 hover:bg-gray-600 active:scale-95 text-white h-14 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-md"
          >
            <Delete size={22} />
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="bg-gray-700 hover:bg-gray-600 active:bg-amber-500 active:scale-95 text-white text-2xl font-semibold h-14 rounded-2xl transition-all duration-150 shadow-md"
          >
            0
          </button>
          <button
            onClick={handleLogin}
            disabled={loading || !pin}
            className="bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 text-white text-base font-bold h-14 rounded-2xl transition-all duration-150 shadow-md shadow-amber-500/30"
          >
            {loading ? '...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
