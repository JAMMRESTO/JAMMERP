import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronDown, Check, Plus, LogOut, MapPin, X, Loader2 } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import type { Site } from '../../types/database';

function CreateSiteInline({ onClose, onCreated }: { onClose: () => void; onCreated: (site: Site) => void }) {
  const { createSite } = useTenant();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) { setError('Nom et identifiant requis'); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setError('Identifiant : lettres minuscules, chiffres et tirets'); return; }
    setLoading(true);
    const { site, error: err } = await createSite(name.trim(), slug.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    if (site) onCreated(site);
  }

  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Nouveau site</p>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
          <X size={12} />
        </button>
      </div>
      <input
        type="text"
        value={name}
        onChange={e => handleName(e.target.value)}
        placeholder="Nom du site"
        autoFocus
        className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition-all"
      />
      <input
        type="text"
        value={slug}
        onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
        placeholder="identifiant-unique"
        className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition-all"
      />
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={loading || !name.trim()}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-all"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Créer le site
      </button>
    </div>
  );
}

export function SiteSwitcher() {
  const { sites, currentSite, selectSite, signOut, clearSite, tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canCreateSite = tenant?.plan === 'enterprise';

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!currentSite) return null;

  function handleSiteCreated(site: Site) {
    selectSite(site);
    setOpen(false);
    setShowCreate(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(v => !v); setShowCreate(false); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 transition-all max-w-[200px] group"
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)' }}
        >
          <Building2 size={11} style={{ color: 'var(--color-primary)' }} />
        </div>
        <span className="text-white text-xs font-semibold truncate flex-1 text-left">{currentSite.name}</span>
        <ChevronDown
          size={12}
          className={`text-white/40 flex-shrink-0 transition-all ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-72 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-3 pt-3 pb-2 border-b border-white/8">
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Sites</p>
              <p className="text-white/20 text-[10px] mt-0.5">{sites.length} site{sites.length > 1 ? 's' : ''} disponible{sites.length > 1 ? 's' : ''}</p>
            </div>

            {/* Site list */}
            <div className="p-1.5 max-h-56 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {sites.map(site => {
                const active = currentSite.id === site.id;
                return (
                  <button
                    key={site.id}
                    onClick={() => { selectSite(site); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left group ${active ? 'bg-white/6' : 'hover:bg-white/4'}`}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        backgroundColor: active
                          ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)'
                          : 'rgba(255,255,255,0.06)',
                        border: active
                          ? '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)'
                          : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Building2 size={14} style={{ color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.35)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                        {site.name}
                      </p>
                      {site.address && (
                        <p className="text-white/25 text-[10px] truncate flex items-center gap-1 mt-0.5">
                          <MapPin size={8} /> {site.address}
                        </p>
                      )}
                    </div>
                    {active && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)' }}
                      >
                        <Check size={11} style={{ color: 'var(--color-primary)' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create site inline form */}
            <AnimatePresence>
              {showCreate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-white/8 overflow-hidden"
                >
                  <CreateSiteInline
                    onClose={() => setShowCreate(false)}
                    onCreated={handleSiteCreated}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="border-t border-white/8 p-1.5 space-y-0.5">
              {!showCreate && canCreateSite && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white/70 text-xs font-medium transition-all"
                >
                  <Plus size={13} />
                  Ajouter un site
                </button>
              )}
              <button
                onClick={() => { setOpen(false); clearSite(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white/60 text-xs font-medium transition-all"
              >
                <Building2 size={13} />
                Changer d'espace de travail
              </button>
              <button
                onClick={() => { setOpen(false); signOut(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-500/8 text-white/30 hover:text-red-400 text-xs font-medium transition-all"
              >
                <LogOut size={13} />
                Déconnexion
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
