import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Delete, Loader2, Check } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';

interface SetPinModalProps {
  onDone: () => void;
}

export function SetPinModal({ onDone }: SetPinModalProps) {
  const { setOwnerPin, siteManager, authUser } = useTenant();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentPin = step === 'enter' ? pin : confirmPin;
  const setCurrentPin = step === 'enter' ? setPin : setConfirmPin;

  function handleDigit(d: string) {
    if (currentPin.length >= 4) return;
    setCurrentPin(p => p + d);
    setError('');
  }

  function handleDelete() {
    setCurrentPin(p => p.slice(0, -1));
    setError('');
  }

  function handleNext() {
    if (step === 'enter') {
      if (pin.length < 4) {
        setError('Le code PIN doit contenir 4 chiffres');
        return;
      }
      setStep('confirm');
      return;
    }

    if (confirmPin !== pin) {
      setError('Les codes PIN ne correspondent pas');
      setConfirmPin('');
      return;
    }

    savePin();
  }

  async function savePin() {
    setLoading(true);
    const result = await setOwnerPin(pin);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-3"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-5 border-b border-white/8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mx-auto mb-3">
            <Shield size={22} className="text-blue-400" />
          </div>
          <h2 className="text-white font-bold text-base">Configurer votre code PIN</h2>
          <p className="text-white/40 text-xs mt-1.5 max-w-[280px] mx-auto">
            Ce PIN vous permettra de valider rapidement les annulations de tickets sans ressaisir votre mot de passe
          </p>
          <p className="text-white/25 text-[10px] mt-2">
            {siteManager?.email ?? authUser?.email}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 text-xs">
            <div className={`flex items-center gap-1.5 ${step === 'enter' ? 'text-blue-400' : 'text-white/30'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === 'enter' ? 'border-blue-500/40 bg-blue-500/15' : 'border-white/10 bg-white/5'}`}>1</div>
              <span className="font-medium">Saisir</span>
            </div>
            <div className="w-6 h-px bg-white/10" />
            <div className={`flex items-center gap-1.5 ${step === 'confirm' ? 'text-blue-400' : 'text-white/30'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === 'confirm' ? 'border-blue-500/40 bg-blue-500/15' : 'border-white/10 bg-white/5'}`}>2</div>
              <span className="font-medium">Confirmer</span>
            </div>
          </div>

          {/* PIN display */}
          <div className="text-center">
            <p className="text-white/50 text-xs mb-2">
              {step === 'enter' ? 'Choisissez un code PIN a 4 chiffres' : 'Confirmez votre code PIN'}
            </p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg font-bold transition-all
                    ${i < currentPin.length
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                      : 'bg-white/5 border-white/10 text-white/20'}`}
                >
                  {i < currentPin.length ? '\u2022' : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-xs text-center"
            >
              {error}
            </motion.p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="h-12 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 active:bg-white/15 transition-all"
              >
                {d}
              </button>
            ))}
            <button
              onClick={handleDelete}
              className="h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 flex items-center justify-center transition-all"
            >
              <Delete size={18} />
            </button>
            <button
              onClick={() => handleDigit('0')}
              className="h-12 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 active:bg-white/15 transition-all"
            >
              0
            </button>
            <button
              onClick={handleNext}
              disabled={currentPin.length < 4 || loading}
              className="h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center gap-1"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : (
                step === 'enter' ? <><Check size={14} /> Suite</> : <><Check size={14} /> OK</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
