import { useState } from 'react';
import { Shield, Key, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import type { LicenseStatus } from '../hooks/useLicense';

interface Props {
  machineId: string;
  onActivate: (key: string) => Promise<LicenseStatus>;
}

export default function LicenseActivationPage({ machineId, onActivate }: Props) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Veuillez entrer une cle de licence.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await onActivate(licenseKey.trim());
    if (!result.valid) {
      setError(result.error || 'Licence invalide');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 shadow-lg mb-4">
            <span className="text-white font-black text-2xl">MC</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">Ma Caisse</h1>
          <p className="text-gray-500 mt-1 text-sm">Version Desktop - Activation requise</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-emerald-500" />
            <h2 className="text-lg font-bold text-gray-800">Activation de la licence</h2>
          </div>

          {/* Machine ID */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Identifiant de ce poste (a communiquer au fournisseur)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 select-all">
                {machineId}
              </code>
              <button
                onClick={handleCopyMachineId}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition"
                title="Copier"
              >
                {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} className="text-gray-400" />}
              </button>
            </div>
          </div>

          {/* License Key Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              <Key size={12} className="inline mr-1" />
              Cle de licence
            </label>
            <textarea
              value={licenseKey}
              onChange={e => { setLicenseKey(e.target.value); setError(''); }}
              placeholder="Collez votre cle de licence ici..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !licenseKey.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
          >
            {loading ? 'Verification...' : 'Activer la licence'}
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">
            Contactez votre fournisseur avec l'identifiant du poste pour obtenir une cle de licence.
          </p>
        </div>
      </div>
    </div>
  );
}
