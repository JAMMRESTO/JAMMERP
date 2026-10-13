import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Zap, Volume2, Vibrate, RefreshCw, Gauge, Loader, CheckCircle, Clock, Store, Save, Printer, Send, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../lib/supabase';
import { loadBusinessHours, getCachedBusinessHours } from '../../lib/businessDay';
import { invalidateRestaurantInfoCache } from '../../lib/printService';

interface ToggleRowProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, icon, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ml-4 ${value ? 'bg-amber-500' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  );
}


const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}h00`;
}

export default function SettingsManager() {
  const { settings, updateSetting, loading } = useSettings();

  const cached = getCachedBusinessHours();
  const [openHour, setOpenHour] = useState(cached.openHour);
  const [closeHour, setCloseHour] = useState(cached.closeHour);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [restoName, setRestoName] = useState('');
  const [restoAddress, setRestoAddress] = useState('');
  const [restoPhone, setRestoPhone] = useState('');
  const [restoEmail, setRestoEmail] = useState('');
  const [restoLogoUrl, setRestoLogoUrl] = useState<string | null>(null);
  const [savingResto, setSavingResto] = useState(false);
  const [restoSaved, setRestoSaved] = useState(false);
  const [loadingResto, setLoadingResto] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRestaurantInfo = useCallback(async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('name, address, phone, email, logo_url')
      .maybeSingle();
    if (data) {
      setRestoName(data.name || '');
      setRestoAddress(data.address || '');
      setRestoPhone(data.phone || '');
      setRestoEmail(data.email || '');
      setRestoLogoUrl(data.logo_url || null);
    }
    setLoadingResto(false);
  }, []);

  const saveRestaurantInfo = async () => {
    setSavingResto(true);
    await supabase
      .from('restaurants')
      .update({
        name: restoName.trim(),
        address: restoAddress.trim() || null,
        phone: restoPhone.trim() || null,
        email: restoEmail.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');
    invalidateRestaurantInfoCache();
    setSavingResto(false);
    setRestoSaved(true);
    setTimeout(() => setRestoSaved(false), 2500);
  };

  const uploadLogo = async (file: File) => {
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('Le fichier doit être une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('L\'image ne doit pas dépasser 5 Mo.');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('restaurant-logos')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage
        .from('restaurant-logos')
        .getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from('restaurants')
        .update({ logo_url: url, updated_at: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      if (dbErr) throw dbErr;
      setRestoLogoUrl(url);
      invalidateRestaurantInfoCache();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Erreur lors du téléversement.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    setUploadingLogo(true);
    setLogoError(null);
    try {
      if (restoLogoUrl) {
        const path = restoLogoUrl.split('/restaurant-logos/')[1]?.split('?')[0];
        if (path) {
          await supabase.storage.from('restaurant-logos').remove([path]);
        }
      }
      await supabase
        .from('restaurants')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      setRestoLogoUrl(null);
      invalidateRestaurantInfoCache();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    fetchRestaurantInfo();
    loadBusinessHours().then(({ openHour: o, closeHour: c }) => {
      setOpenHour(o);
      setCloseHour(c);
    });
  }, [fetchRestaurantInfo]);

  const saveBusinessHours = async () => {
    setSavingHours(true);
    await supabase.from('app_settings').upsert([
      { key: 'business_open_hour', value: String(openHour), updated_at: new Date().toISOString() },
      { key: 'business_close_hour', value: String(closeHour), updated_at: new Date().toISOString() },
    ], { onConflict: 'key' });
    await loadBusinessHours();
    setSavingHours(false);
    setHoursSaved(true);
    setTimeout(() => setHoursSaved(false), 2500);
  };

  if (loading || loadingResto) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const boolSections = [
    {
      title: 'Performance',
      items: [
        {
          key: 'highPerformanceMode' as const,
          label: 'Mode haute performance',
          description: 'Réduit les animations à 150ms. Idéal pour service intensif.',
          icon: <Gauge size={16} className="text-gray-600" />,
        },
        {
          key: 'expressMode' as const,
          label: 'Mode Service Express',
          description: 'Ajout direct des produits sans popup (sauf options requises).',
          icon: <Zap size={16} className="text-amber-500" />,
        },
      ],
    },
    {
      title: 'Feedback',
      items: [
        {
          key: 'soundEnabled' as const,
          label: 'Sons activés',
          description: 'Bip court à chaque ajout, son double à l\'impression, son de confirmation au paiement.',
          icon: <Volume2 size={16} className="text-blue-500" />,
        },
        {
          key: 'vibrationEnabled' as const,
          label: 'Vibrations activées',
          description: 'Vibration légère 50ms sur mobile à la validation d\'actions.',
          icon: <Vibrate size={16} className="text-green-500" />,
        },
      ],
    },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Paramètres système</h2>
          <p className="text-xs text-gray-500">Configuration du comportement du POS</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Store size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Informations du restaurant</p>
            <p className="text-xs text-gray-500 mt-0.5">Ces informations apparaissent sur les tickets de caisse.</p>
          </div>
        </div>

        <div className="space-y-3 ml-12">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nom du restaurant *</label>
            <input
              value={restoName}
              onChange={e => setRestoName(e.target.value)}
              placeholder="Ex: Mon Restaurant"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Adresse</label>
            <input
              value={restoAddress}
              onChange={e => setRestoAddress(e.target.value)}
              placeholder="Ex: Rue 10, Dakar Plateau"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telephone</label>
              <input
                value={restoPhone}
                onChange={e => setRestoPhone(e.target.value)}
                placeholder="Ex: 77 123 45 67"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input
                value={restoEmail}
                onChange={e => setRestoEmail(e.target.value)}
                placeholder="Ex: contact@monresto.sn"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Logo (ticket de caisse)</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {restoLogoUrl ? (
                  <img src={restoLogoUrl} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={20} className="text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                  >
                    {uploadingLogo ? <Loader size={13} className="animate-spin" /> : <Upload size={13} />}
                    {restoLogoUrl ? 'Changer' : 'Téléverser'}
                  </button>
                  {restoLogoUrl && (
                    <button
                      onClick={removeLogo}
                      disabled={uploadingLogo}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      Retirer
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Affiché en haut de l'addition et du reçu. PNG/JPG/WebP, 5 Mo max.
                </p>
                {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">Le nom, l'adresse et le telephone s'affichent sur les tickets imprimes.</p>
            <button
              onClick={saveRestaurantInfo}
              disabled={savingResto || !restoName.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50 flex-shrink-0"
            >
              {savingResto
                ? <Loader size={14} className="animate-spin" />
                : restoSaved
                ? <CheckCircle size={14} />
                : <Save size={14} />}
              {restoSaved ? 'Enregistre' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>

      {boolSections.map(section => (
        <div key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">{section.title}</p>
          {section.items.map(item => (
            <ToggleRow
              key={item.key}
              label={item.label}
              description={item.description}
              icon={item.icon}
              value={settings[item.key]}
              onChange={(v) => updateSetting(item.key, v)}
            />
          ))}
        </div>
      ))}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">Impression</p>

        <div className="flex items-start gap-3 py-4 border-b border-gray-100">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Printer size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Impression directe navigateur</p>
            <p className="text-xs text-gray-500 mt-0.5">Les tickets sont imprimés directement via le navigateur. Aucune application externe requise. Configurez l'imprimante dans les paramètres du système d'exploitation.</p>
          </div>
        </div>

        <ToggleRow
          label="Réessai automatique d'impression"
          description="Relance automatiquement les impressions échouées toutes les 2 secondes."
          icon={<RefreshCw size={16} className="text-orange-500" />}
          value={settings.autoRetryPrinting}
          onChange={(v) => updateSetting('autoRetryPrinting', v)}
        />

        <ToggleRow
          label="Envoi automatique aux imprimantes"
          description="Envoie automatiquement les commandes des serveurs vers toutes les imprimantes (cuisine, bar, etc.) sans intervention du caissier."
          icon={<Send size={16} className="text-green-500" />}
          value={settings.autoDispatchCashier}
          onChange={(v) => updateSetting('autoDispatchCashier', v)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Horaires d'exploitation</p>
            <p className="text-xs text-gray-500 mt-0.5">Définit la journée métier pour les clôtures et statistiques.</p>
          </div>
        </div>

        <div className="flex items-end gap-4 ml-12">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Ouverture</label>
            <select
              value={openHour}
              onChange={e => setOpenHour(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {HOURS.map(h => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>

          <div className="pb-2.5 text-gray-400 font-bold text-sm">→</div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fermeture (lendemain)</label>
            <select
              value={closeHour}
              onChange={e => setCloseHour(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {HOURS.map(h => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>

          <button
            onClick={saveBusinessHours}
            disabled={savingHours}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50 flex-shrink-0"
          >
            {savingHours
              ? <Loader size={14} className="animate-spin" />
              : hoursSaved
              ? <CheckCircle size={14} />
              : null}
            {hoursSaved ? 'Sauvegardé' : 'Enregistrer'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3 ml-12">
          Journée en cours : <strong>{hourLabel(openHour)}</strong> jusqu'au lendemain <strong>{hourLabel(closeHour)}</strong>.
          Les ventes après minuit jusqu'à <strong>{hourLabel(closeHour)}</strong> sont rattachées à la journée précédente.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold text-blue-700 mb-1">Actif maintenant</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {settings.highPerformanceMode && (
            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"><Gauge size={11} /> Haute perfo</span>
          )}
          {settings.expressMode && (
            <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"><Zap size={11} /> Express</span>
          )}
          {settings.soundEnabled && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"><Volume2 size={11} /> Sons</span>
          )}
          {settings.vibrationEnabled && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"><Vibrate size={11} /> Vibrations</span>
          )}
          {settings.autoRetryPrinting && (
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"><RefreshCw size={11} /> Réessai auto</span>
          )}
          {settings.autoDispatchCashier && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1"><Send size={11} /> Envoi auto</span>
          )}
        </div>
      </div>
    </div>
  );
}
