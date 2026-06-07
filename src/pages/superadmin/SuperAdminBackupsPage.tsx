import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Download, Upload, Trash2, Loader2, CheckCircle2,
  AlertTriangle, Clock, HardDrive, RefreshCw, Shield, Building2, ChevronDown,
  RotateCcw, Timer, Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

interface Backup {
  id: string;
  site_id: string;
  tenant_id: string;
  type: 'manual' | 'auto';
  label: string;
  scope: 'config' | 'full';
  tables_included: string[];
  record_count: number;
  size_bytes: number;
  status: string;
  created_at: string;
}

interface SiteOption {
  id: string;
  name: string;
  tenant_name: string;
  tenant_id: string;
}

interface TenantSchedule {
  id: string;
  name: string;
  backup_enabled: boolean;
  backup_cron: string;
  backup_scope: 'config' | 'full';
  last_auto_backup_at: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function SuperAdminBackupsPage() {
  const toast = useToast();

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Backup | null>(null);
  const [confirmReset, setConfirmReset] = useState<'data' | 'config' | 'full' | null>(null);
  const [resetting, setResetting] = useState(false);
  const [schedules, setSchedules] = useState<TenantSchedule[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    loadSites();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (selectedSite) loadBackups();
  }, [selectedSite]);

  async function loadSites() {
    const { data: sitesData } = await supabase
      .from('sites')
      .select('id, name, tenant_id, tenants(name)')
      .order('name');

    if (sitesData) {
      setSites(sitesData.map((s: any) => ({
        id: s.id,
        name: s.name,
        tenant_name: s.tenants?.name ?? '',
        tenant_id: s.tenant_id,
      })));
    }
  }

  async function loadBackups() {
    if (!selectedSite) return;
    setLoading(true);
    const { data } = await supabase
      .from('backups')
      .select('id, site_id, tenant_id, type, label, scope, tables_included, record_count, size_bytes, status, created_at')
      .eq('site_id', selectedSite.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setBackups((data ?? []) as Backup[]);
    setLoading(false);
  }

  async function createBackup(scope: 'config' | 'full') {
    if (!selectedSite) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          site_id: selectedSite.id,
          tenant_id: selectedSite.tenant_id,
          scope,
          type: 'manual',
          label: `Sauvegarde ${scope === 'full' ? 'complete' : 'configuration'} - ${selectedSite.name} - ${new Date().toLocaleDateString('fr-FR')}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast('success', 'Sauvegarde creee avec succes');
        loadBackups();
      } else {
        toast('error', result.error ?? 'Erreur lors de la sauvegarde');
      }
    } catch {
      toast('error', 'Erreur reseau');
    }
    setCreating(false);
  }

  async function handleRestore(backup: Backup) {
    if (!selectedSite) return;
    setRestoring(backup.id);
    setConfirmRestore(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          backup_id: backup.id,
          site_id: selectedSite.id,
          mode: 'replace',
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast('success', `Restauration terminee: ${result.total_restored} enregistrements`);
      } else {
        toast('error', result.error ?? 'Erreur lors de la restauration');
      }
    } catch {
      toast('error', 'Erreur reseau');
    }
    setRestoring(null);
  }

  async function deleteBackup(id: string) {
    const { error } = await supabase.from('backups').delete().eq('id', id);
    if (error) {
      toast('error', 'Erreur lors de la suppression');
    } else {
      setBackups(prev => prev.filter(b => b.id !== id));
      toast('success', 'Sauvegarde supprimee');
    }
  }

  async function downloadBackup(backup: Backup) {
    const { data } = await supabase
      .from('backups')
      .select('data')
      .eq('id', backup.id)
      .single();
    if (!data) { toast('error', 'Donnees introuvables'); return; }
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${backup.scope}_${selectedSite?.name ?? 'site'}_${new Date(backup.created_at).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function backupAllSites() {
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    let successCount = 0;
    for (const site of sites) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-site`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            site_id: site.id,
            tenant_id: site.tenant_id,
            scope: 'full',
            type: 'auto',
            label: `Sauvegarde globale - ${site.name} - ${new Date().toLocaleDateString('fr-FR')}`,
          }),
        });
        const result = await res.json();
        if (result.success) successCount++;
      } catch { /* continue */ }
    }
    toast('success', `Sauvegarde globale: ${successCount}/${sites.length} sites sauvegardes`);
    if (selectedSite) loadBackups();
    setCreating(false);
  }

  async function handleReset(scope: 'data' | 'config' | 'full') {
    if (!selectedSite) return;
    setResetting(true);
    setConfirmReset(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          site_id: selectedSite.id,
          scope,
          confirm: 'RESET_CONFIRMED',
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast('success', `Reinitialisation terminee: ${result.total_deleted} enregistrements supprimes pour ${result.site}`);
      } else {
        toast('error', result.error ?? 'Erreur lors de la reinitialisation');
      }
    } catch {
      toast('error', 'Erreur reseau');
    }
    setResetting(false);
  }

  async function loadSchedules() {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, backup_enabled, backup_cron, backup_scope, last_auto_backup_at')
      .order('name');
    if (error) {
      const { data: fallback } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');
      if (fallback) {
        setSchedules(fallback.map((t: any) => ({
          id: t.id,
          name: t.name,
          backup_enabled: true,
          backup_cron: '0 3 * * *',
          backup_scope: 'full' as const,
          last_auto_backup_at: null,
        })));
      }
    } else if (data) {
      setSchedules(data as TenantSchedule[]);
    }
    setSchedulesLoaded(true);
  }

  async function saveSchedule(tenantId: string, field: string, value: boolean | string) {
    setSavingSchedule(tenantId);
    const { error } = await supabase
      .from('tenants')
      .update({ [field]: value })
      .eq('id', tenantId);
    if (error) {
      toast('error', 'Erreur lors de la sauvegarde');
    } else {
      setSchedules(prev => prev.map(s => s.id === tenantId ? { ...s, [field]: value } : s));
      toast('success', 'Planification mise a jour');
    }
    setSavingSchedule(null);
  }

  async function purgeOldBackups() {
    setPurging(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { error, count } = await supabase
        .from('backups')
        .delete({ count: 'exact' })
        .eq('type', 'manual')
        .lt('created_at', cutoff.toISOString());
      if (error) {
        toast('error', 'Erreur lors du nettoyage');
      } else {
        toast('success', `${count ?? 0} anciennes sauvegardes manuelles supprimees`);
        if (selectedSite) loadBackups();
      }
    } catch {
      toast('error', 'Erreur reseau');
    }
    setPurging(false);
  }

  async function triggerAutoBackup() {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      let successCount = 0;
      const enabledTenantIds = schedules.filter(s => s.backup_enabled).map(s => s.id);
      const sitesToBackup = sites.filter(s => enabledTenantIds.includes(s.tenant_id));

      for (const site of sitesToBackup) {
        const schedule = schedules.find(s => s.id === site.tenant_id);
        const scope = schedule?.backup_scope ?? 'full';
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-site`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              site_id: site.id,
              tenant_id: site.tenant_id,
              scope,
              type: 'auto',
              label: `Sauvegarde automatique - ${site.name} - ${new Date().toLocaleDateString('fr-FR')}`,
            }),
          });
          const result = await res.json();
          if (result.success) successCount++;
        } catch { /* continue */ }
      }

      if (successCount > 0) {
        toast('success', `Sauvegarde automatique: ${successCount}/${sitesToBackup.length} sites sauvegardes`);
      } else if (sitesToBackup.length === 0) {
        toast('error', 'Aucun site avec sauvegarde automatique activee');
      } else {
        toast('error', 'Erreur lors de la sauvegarde automatique');
      }
      loadSchedules();
      if (selectedSite) loadBackups();
    } catch {
      toast('error', 'Erreur reseau');
    }
    setCreating(false);
  }

  const lastAuto = backups.find(b => b.type === 'auto');

  return (
    <div className="p-4 lg:p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <Database size={18} className="text-red-400" />
            Sauvegardes & Restauration
          </h1>
          <p className="text-white/40 text-xs mt-0.5">Gerez les sauvegardes de tous les sites de la plateforme</p>
        </div>
        <button
          onClick={backupAllSites}
          disabled={creating || sites.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold transition-all"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
          Sauvegarder tous les sites
        </button>
      </div>

      {/* Site selector */}
      <div className="relative">
        <button
          onClick={() => setShowSiteDropdown(!showSiteDropdown)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:border-white/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-white/40" />
            {selectedSite ? (
              <span>
                <span className="font-medium">{selectedSite.name}</span>
                <span className="text-white/40 ml-2">({selectedSite.tenant_name})</span>
              </span>
            ) : (
              <span className="text-white/40">Selectionner un site...</span>
            )}
          </div>
          <ChevronDown size={14} className={`text-white/40 transition-transform ${showSiteDropdown ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showSiteDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto"
              style={{ scrollbarWidth: 'thin' }}
            >
              {sites.map(site => (
                <button
                  key={site.id}
                  onClick={() => { setSelectedSite(site); setShowSiteDropdown(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors ${
                    selectedSite?.id === site.id ? 'bg-red-500/10 text-red-400' : 'text-white/70'
                  }`}
                >
                  <Building2 size={12} className="text-white/30 flex-shrink-0" />
                  <span className="font-medium">{site.name}</span>
                  <span className="text-white/30 text-xs ml-auto">{site.tenant_name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Auto-backup schedule - always visible */}
      <div className="bg-white/4 rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-amber-400" />
            <h3 className="text-white font-semibold text-sm">Planification automatique</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerAutoBackup}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 text-[10px] font-semibold transition-all disabled:opacity-40"
            >
              <Sparkles size={10} /> Lancer maintenant
            </button>
            <button
              onClick={purgeOldBackups}
              disabled={purging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-white/50 text-[10px] font-medium transition-all disabled:opacity-40"
            >
              {purging ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
              Purger anciennes
            </button>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {!schedulesLoaded ? (
            <div className="px-5 py-4 text-center">
              <Loader2 size={14} className="animate-spin text-white/20 mx-auto" />
              <p className="text-white/30 text-xs mt-2">Chargement des tenants...</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="px-5 py-4 text-center">
              <p className="text-white/30 text-xs">Aucun tenant disponible</p>
            </div>
          ) : (
            schedules.map(schedule => (
              <div key={schedule.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => saveSchedule(schedule.id, 'backup_enabled', !schedule.backup_enabled)}
                    disabled={savingSchedule === schedule.id}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      schedule.backup_enabled ? 'bg-emerald-500/60' : 'bg-white/10'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      schedule.backup_enabled ? 'left-[18px]' : 'left-0.5'
                    }`} />
                  </button>
                  <Building2 size={12} className="text-white/30 flex-shrink-0" />
                  <span className="text-white text-xs font-medium truncate">{schedule.name}</span>
                  {schedule.backup_enabled && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                      Actif
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={schedule.backup_scope}
                    onChange={e => saveSchedule(schedule.id, 'backup_scope', e.target.value)}
                    disabled={savingSchedule === schedule.id}
                    className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-[10px] font-medium focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="full">Complete</option>
                    <option value="config">Configuration</option>
                  </select>
                  <select
                    value={schedule.backup_cron}
                    onChange={e => saveSchedule(schedule.id, 'backup_cron', e.target.value)}
                    disabled={savingSchedule === schedule.id}
                    className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-[10px] font-medium focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="0 3 * * *">Quotidien 3h</option>
                    <option value="0 3 * * 1">Hebdomadaire (lundi 3h)</option>
                    <option value="0 3 1 * *">Mensuel (1er du mois 3h)</option>
                    <option value="0 */6 * * *">Toutes les 6h</option>
                    <option value="0 */12 * * *">Toutes les 12h</option>
                  </select>
                  <span className="text-white/25 text-[10px]">
                    {schedule.last_auto_backup_at
                      ? `Derniere: ${formatDate(schedule.last_auto_backup_at)}`
                      : 'Jamais'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Site-specific content */}
      {selectedSite ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/4 rounded-2xl p-4 border border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <Database size={14} className="text-blue-400" />
                <span className="text-white/50 text-xs">Total sauvegardes</span>
              </div>
              <p className="text-white font-bold text-xl">{backups.length}</p>
            </div>
            <div className="bg-white/4 rounded-2xl p-4 border border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-amber-400" />
                <span className="text-white/50 text-xs">Derniere automatique</span>
              </div>
              <p className="text-white font-semibold text-sm">
                {lastAuto ? formatDate(lastAuto.created_at) : 'Aucune'}
              </p>
            </div>
            <div className="bg-white/4 rounded-2xl p-4 border border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={14} className="text-emerald-400" />
                <span className="text-white/50 text-xs">Espace utilise</span>
              </div>
              <p className="text-white font-semibold text-sm">
                {formatSize(backups.reduce((s, b) => s + b.size_bytes, 0))}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => createBackup('config')}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-all"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
              Sauvegarder configuration
            </button>
            <button
              onClick={() => createBackup('full')}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-all"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <HardDrive size={13} />}
              Sauvegarde complete
            </button>
            <button
              onClick={loadBackups}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all border border-white/8"
            >
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>

          {/* Backups list */}
          <div className="bg-white/3 rounded-2xl border border-white/8 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Historique - {selectedSite.name}</h3>
              <span className="text-white/30 text-xs">{backups.length} sauvegarde{backups.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-white/30" />
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <Database size={28} className="text-white/15" />
                <p className="text-white/30 text-sm">Aucune sauvegarde pour ce site</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {backups.map(backup => (
                  <div key={backup.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/3 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      backup.type === 'auto' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-blue-500/10 border border-blue-500/20'
                    }`}>
                      {backup.type === 'auto'
                        ? <Clock size={14} className="text-amber-400" />
                        : <Database size={14} className="text-blue-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-xs font-medium truncate">{backup.label}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${
                          backup.scope === 'full'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}>
                          {backup.scope === 'full' ? 'Complet' : 'Config'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-white/30 text-[10px]">{formatDate(backup.created_at)}</span>
                        <span className="text-white/25 text-[10px]">{backup.record_count} enr.</span>
                        <span className="text-white/25 text-[10px]">{formatSize(backup.size_bytes)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => downloadBackup(backup)} title="Telecharger"
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all">
                        <Download size={12} />
                      </button>
                      <button onClick={() => setConfirmRestore(backup)} disabled={restoring === backup.id} title="Restaurer"
                        className="w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-all disabled:opacity-30">
                        {restoring === backup.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      </button>
                      <button onClick={() => deleteBackup(backup.id)} title="Supprimer"
                        className="w-7 h-7 rounded-lg bg-red-500/8 hover:bg-red-500/15 flex items-center justify-center text-red-400/40 hover:text-red-400 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger zone - Reset */}
          <div className="border border-red-500/20 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-red-500/20 bg-red-500/5 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <h3 className="text-red-400 font-semibold text-sm">Zone dangereuse - Reinitialisation</h3>
            </div>
            <div className="p-4 sm:p-5 space-y-4 bg-red-500/3">
              <p className="text-white/50 text-xs leading-relaxed">
                La reinitialisation supprime definitivement les donnees du site selectionne.
                Creez une sauvegarde complete avant toute reinitialisation.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setConfirmReset('data')}
                  disabled={resetting}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-all disabled:opacity-40"
                >
                  <RotateCcw size={12} /> Effacer donnees operationnelles
                </button>
                <button
                  onClick={() => setConfirmReset('config')}
                  disabled={resetting}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-all disabled:opacity-40"
                >
                  <RotateCcw size={12} /> Effacer configuration
                </button>
                <button
                  onClick={() => setConfirmReset('full')}
                  disabled={resetting}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600/60 hover:bg-red-600/80 border border-red-500/30 text-white text-xs font-bold transition-all disabled:opacity-40"
                >
                  {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Reinitialisation complete
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white/3 rounded-2xl border border-white/8 p-8 flex flex-col items-center gap-3">
          <Building2 size={32} className="text-white/15" />
          <p className="text-white/40 text-sm">Selectionnez un site pour voir les sauvegardes et les actions</p>
          <p className="text-white/25 text-xs">La planification automatique ci-dessus s'applique a tous les tenants</p>
        </div>
      )}

      {/* Restore confirmation modal */}
      <AnimatePresence>
        {confirmRestore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmRestore(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Confirmer la restauration</h3>
                  <p className="text-white/40 text-xs mt-0.5">Action irreversible</p>
                </div>
              </div>

              <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-300 text-xs">
                  Les donnees du site <strong>{selectedSite?.name}</strong> seront remplacees par celles de la sauvegarde
                  du <strong>{formatDate(confirmRestore.created_at)}</strong>.
                </p>
              </div>

              <div className="bg-white/4 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Portee</span>
                  <span className="text-white/80">{confirmRestore.scope === 'full' ? 'Complete' : 'Configuration'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Enregistrements</span>
                  <span className="text-white/80">{confirmRestore.record_count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Tables</span>
                  <span className="text-white/80">{confirmRestore.tables_included.length}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setConfirmRestore(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 font-medium rounded-xl text-sm transition-colors">
                  Annuler
                </button>
                <button onClick={() => handleRestore(confirmRestore)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-colors">
                  Restaurer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset confirmation modal */}
      <AnimatePresence>
        {confirmReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmReset(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-red-500/25 rounded-2xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Reinitialiser les donnees</h3>
                  <p className="text-red-400/70 text-xs mt-0.5 font-medium">ACTION IRREVERSIBLE</p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 space-y-2">
                <p className="text-red-300 text-xs leading-relaxed">
                  Vous allez <strong>supprimer definitivement</strong> les donnees du site <strong>{selectedSite?.name}</strong>.
                </p>
                <div className="bg-red-900/30 rounded-lg p-2">
                  <p className="text-red-200/70 text-[10px] leading-snug">
                    {confirmReset === 'data' && 'Ventes, paiements, commandes, livraisons, sessions de caisse, mouvements de stock et clients seront supprimes.'}
                    {confirmReset === 'config' && 'Categories, produits, parametres, utilisateurs, roles, tables, recettes, ingredients et entrepots seront supprimes. Les parametres par defaut seront recrees.'}
                    {confirmReset === 'full' && 'TOUTES les donnees du site seront supprimees. Les parametres par defaut seront recrees. Le site sera vide.'}
                  </p>
                </div>
              </div>

              <div className="bg-white/4 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Site</span>
                  <span className="text-white/80">{selectedSite?.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Portee</span>
                  <span className="text-red-400 font-semibold">
                    {confirmReset === 'data' ? 'Donnees operationnelles' : confirmReset === 'config' ? 'Configuration' : 'Complete'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setConfirmReset(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 font-medium rounded-xl text-sm transition-colors">
                  Annuler
                </button>
                <button onClick={() => handleReset(confirmReset)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-colors">
                  {resetting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Reinitialiser'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
