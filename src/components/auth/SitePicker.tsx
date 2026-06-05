import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Plus, MapPin, ChefHat, LogOut, Loader2, X, Check } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import type { Site } from '../../types/database';

function SiteCard({ site, onSelect }: { site: Site; onSelect: () => void }) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left p-5 rounded-2xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all group relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary, #3B82F6) 8%, transparent), transparent)' }}
      />
      <div className="relative z-10 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #3B82F6) 15%, transparent)', border: '1.5px solid color-mix(in srgb, var(--color-primary, #3B82F6) 25%, transparent)' }}
        >
          <Building2 size={20} style={{ color: 'var(--color-primary, #3B82F6)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">{site.name}</p>
          {site.address && (
            <p className="text-white/35 text-xs mt-0.5 flex items-center gap-1 truncate">
              <MapPin size={10} className="flex-shrink-0" />
              {site.address}
            </p>
          )}
          <p className="text-white/20 text-[10px] mt-1 font-mono">{site.slug}</p>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center group-hover:border-white/25 transition-all">
          <ChefHat size={14} className="text-white/30 group-hover:text-white/60 transition-colors" />
        </div>
      </div>
    </motion.button>
  );
}

function CreateSiteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (site: Site) => void }) {
  const { createSite } = useTenant();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited) {
      setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  }

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) { setError('Nom et identifiant requis'); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setError('L\'identifiant ne doit contenir que des lettres minuscules, chiffres et tirets'); return; }
    setIsLoading(true);
    const { site, error: err } = await createSite(name.trim(), slug.trim());
    setIsLoading(false);
    if (err) { setError(err); return; }
    if (site) onCreated(site);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">Nouveau site</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white/50 text-xs font-medium mb-1.5">Nom du site</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Ex: Dakar Centre"
              className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25 transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs font-medium mb-1.5">Identifiant unique</label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
              placeholder="dakar-centre"
              className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25 transition-all font-mono"
            />
            <p className="text-white/25 text-[10px] mt-1">Lettres minuscules, chiffres et tirets uniquement</p>
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-sm font-medium transition-all">
            Annuler
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCreate}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-primary, #3B82F6)' }}
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <><Check size={15} /> Créer</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SitePicker() {
  const { tenant, sites, selectSite, signOut, isLoadingTenant } = useTenant();
  const [showCreate, setShowCreate] = useState(false);
  const canCreateSite = tenant?.plan === 'enterprise' || tenant?.plan === 'pro' || sites.length === 0;

  function handleSiteCreated(site: Site) {
    setShowCreate(false);
    selectSite(site);
  }

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #050810 0%, #0a0f1e 50%, #060b14 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-5 translate-x-1/3 -translate-y-1/3" style={{ backgroundColor: 'var(--color-primary, #3B82F6)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-4 -translate-x-1/3 translate-y-1/3" style={{ backgroundColor: 'var(--color-accent, #F59E0B)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary, #3B82F6)' }}>
              <ChefHat size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">{tenant?.name}</p>
              <p className="text-white/60 text-xs">Sélection du site</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/35 hover:text-red-400 hover:bg-red-500/8 text-xs font-medium transition-all"
          >
            <LogOut size={13} />
            Déconnexion
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-white text-2xl font-black mb-1">Quel site ?</h1>
          <p className="text-white/35 text-sm">Choisissez le point de vente sur lequel travailler</p>
        </div>

        {/* Sites list */}
        <div className="space-y-3 mb-6">
          {sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-white/8 bg-white/3 text-center">
              <Building2 size={32} className="text-white/15 mb-3" />
              <p className="text-white/40 font-medium text-sm">Aucun site configuré</p>
              <p className="text-white/20 text-xs mt-1">Créez votre premier point de vente</p>
            </div>
          ) : (
            sites.map(site => (
              <SiteCard key={site.id} site={site} onSelect={() => selectSite(site)} />
            ))
          )}
        </div>

        {/* Add site button */}
        {canCreateSite && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/4 transition-all text-sm font-medium"
          >
            <Plus size={16} />
            Ajouter un site
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {showCreate && (
          <CreateSiteModal onClose={() => setShowCreate(false)} onCreated={handleSiteCreated} />
        )}
      </AnimatePresence>
    </div>
  );
}
