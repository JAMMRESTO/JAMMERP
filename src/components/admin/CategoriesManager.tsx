import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, LayoutGrid, Printer as PrinterIcon, AlertCircle, ChevronRight, FolderOpen, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Category, Printer } from '../../lib/types';
import { invalidateCatPrinterCache } from '../../services/printingHub';

interface CatForm { nom: string; actif: boolean; printer_id: string; parent_id: string; }
const empty: CatForm = { nom: '', actif: true, printer_id: '', parent_id: '' };

const printerTypeColors: Record<string, { pill: string; card: string; dot: string }> = {
  CUISINE: { pill: 'bg-orange-100 text-orange-700', card: 'border-orange-300 bg-orange-50 ring-orange-400', dot: 'bg-orange-400' },
  BAR:     { pill: 'bg-blue-100 text-blue-700',   card: 'border-blue-300 bg-blue-50 ring-blue-400',   dot: 'bg-blue-400' },
  CAISSE:  { pill: 'bg-green-100 text-green-700', card: 'border-green-300 bg-green-50 ring-green-400', dot: 'bg-green-400' },
  AUTRE:   { pill: 'bg-gray-100 text-gray-700',   card: 'border-gray-300 bg-gray-50 ring-gray-400',   dot: 'bg-gray-400' },
};

export default function CategoriesManager() {
  const [cats, setCats] = useState<Category[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState<CatForm>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [catsRes, printersRes] = await Promise.all([
      supabase.from('categories').select('*, printer:printers(*)').order('ordre'),
      supabase.from('printers').select('*').eq('active', true).order('type'),
    ]);
    setCats(catsRes.data || []);
    setPrinters(printersRes.data || []);
    setLoading(false);
  };

  const parentCats = cats.filter(c => !c.parent_id);
  const subCats = cats.filter(c => !!c.parent_id);

  const openCreate = (parentId?: string) => {
    setEditCat(null);
    setForm({ ...empty, parent_id: parentId || '' });
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditCat(c);
    setForm({ nom: c.nom, actif: c.actif, printer_id: c.printer_id || '', parent_id: c.parent_id || '' });
    setShowModal(true);
  };

  const close = () => { setShowModal(false); setEditCat(null); };

  const handleSave = async () => {
    if (!form.nom) return;
    setSaving(true);
    const payload = {
      nom: form.nom,
      actif: form.actif,
      printer_id: form.printer_id || null,
      parent_id: form.parent_id || null,
    };
    if (editCat) {
      await supabase.from('categories').update(payload).eq('id', editCat.id);
    } else {
      const maxOrdre = cats.filter(c => !!c.parent_id === !!form.parent_id).reduce((m, c) => Math.max(m, c.ordre), -1);
      await supabase.from('categories').insert({ ...payload, ordre: maxOrdre + 1 });
    }
    invalidateCatPrinterCache();
    await fetchAll();
    setSaving(false);
    close();
  };

  const handleDelete = async (id: string) => {
    const hasSubs = subCats.some(c => c.parent_id === id);
    if (hasSubs && !confirm('Cette catégorie a des sous-catégories. Supprimer quand même ?')) return;
    if (!hasSubs && !confirm('Supprimer cette catégorie ?')) return;
    await supabase.from('categories').delete().eq('id', id);
    invalidateCatPrinterCache();
    setCats(prev => prev.filter(c => c.id !== id && c.parent_id !== id));
  };

  const moveParent = async (id: string, dir: -1 | 1) => {
    const list = [...parentCats];
    const idx = list.findIndex(c => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    await Promise.all([
      supabase.from('categories').update({ ordre: b.ordre }).eq('id', a.id),
      supabase.from('categories').update({ ordre: a.ordre }).eq('id', b.id),
    ]);
    await fetchAll();
  };

  const moveSub = async (parentId: string, id: string, dir: -1 | 1) => {
    const list = subCats.filter(c => c.parent_id === parentId);
    const idx = list.findIndex(c => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    await Promise.all([
      supabase.from('categories').update({ ordre: b.ordre }).eq('id', a.id),
      supabase.from('categories').update({ ordre: a.ordre }).eq('id', b.id),
    ]);
    await fetchAll();
  };

  const effectivePrinter = (c: Category): Printer | null => {
    if (c.printer) return c.printer;
    if (c.parent_id) {
      const parent = cats.find(p => p.id === c.parent_id);
      if (parent) return effectivePrinter(parent);
    }
    return null;
  };

  const catsWithoutPrinter = cats.filter(c => c.actif && !effectivePrinter(c));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Catégories</h2>
          <p className="text-sm text-gray-500 mt-0.5">{parentCats.length} catégorie(s) · {subCats.length} sous-catégorie(s)</p>
        </div>
        <button onClick={() => openCreate()} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {catsWithoutPrinter.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Catégories sans imprimante</p>
            <p className="text-xs text-red-600 mt-0.5">
              Les catégories suivantes bloqueront la validation des commandes :{' '}
              <strong>
                {catsWithoutPrinter.map((c, i) => (
                  <span key={c.id}>
                    <button onClick={() => openEdit(c)} className="underline underline-offset-2 hover:text-red-800">{c.nom}</button>
                    {i < catsWithoutPrinter.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </strong>
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {parentCats.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">Aucune catégorie</div>
          ) : (
            parentCats.map((parent, i) => {
              const children = subCats.filter(c => c.parent_id === parent.id);
              const pPrinter = effectivePrinter(parent);
              const colors = pPrinter ? (printerTypeColors[pPrinter.type] || printerTypeColors.AUTRE) : null;
              return (
                <div key={parent.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4 bg-gray-50/80">
                    {/* Reorder arrows */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveParent(parent.id, -1)}
                        disabled={i === 0}
                        className="w-6 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 rounded transition-colors"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        onClick={() => moveParent(parent.id, 1)}
                        disabled={i === parentCats.length - 1}
                        className="w-6 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 rounded transition-colors"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>

                    <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={15} className="text-amber-500 flex-shrink-0" />
                        <p className="font-semibold text-gray-900">{parent.nom}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{children.length} sous-catégorie(s)</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {pPrinter && colors ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${colors.pill}`}>
                          <PrinterIcon size={10} />
                          {pPrinter.nom}
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600 flex items-center gap-1">
                          <AlertCircle size={10} />
                          Aucune
                        </span>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${parent.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {parent.actif ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openCreate(parent.id)}
                        className="w-8 h-8 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 transition-all"
                        title="Ajouter une sous-catégorie"
                      >
                        <Plus size={14} />
                      </button>
                      <button onClick={() => openEdit(parent)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 transition-all">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(parent.id)} className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {children.length > 0 && (
                    <div className="divide-y divide-gray-50">
                      {children.map((sub, si) => {
                        const subPrinter = effectivePrinter(sub);
                        const inherited = !sub.printer_id && !!subPrinter;
                        const subColors = subPrinter ? (printerTypeColors[subPrinter.type] || printerTypeColors.AUTRE) : null;
                        return (
                          <div key={sub.id} className="flex items-center gap-4 px-5 py-3 pl-10">
                            {/* Sub reorder arrows */}
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => moveSub(parent.id, sub.id, -1)}
                                disabled={si === 0}
                                className="w-5 h-4 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 rounded transition-colors"
                              >
                                <ArrowUp size={10} />
                              </button>
                              <button
                                onClick={() => moveSub(parent.id, sub.id, 1)}
                                disabled={si === children.length - 1}
                                className="w-5 h-4 flex items-center justify-center text-gray-300 hover:text-gray-500 disabled:opacity-20 rounded transition-colors"
                              >
                                <ArrowDown size={10} />
                              </button>
                            </div>
                            <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 text-sm">{sub.nom}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {subPrinter && subColors ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${subColors.pill} ${inherited ? 'opacity-70' : ''}`}>
                                  {inherited && <span className="font-bold">↑</span>}
                                  <PrinterIcon size={9} />
                                  {subPrinter.nom}
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 flex items-center gap-1">
                                  <AlertCircle size={9} />
                                  Aucune
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sub.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {sub.actif ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => openEdit(sub)} className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 transition-all">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleDelete(sub.id)} className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500 transition-all">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <LayoutGrid size={18} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">
                  {editCat ? 'Modifier' : 'Nouvelle'} {form.parent_id ? 'sous-catégorie' : 'catégorie'}
                </h3>
              </div>
              <button onClick={close}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom</label>
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="Ex: Boissons"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Catégorie parente</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                >
                  <option value="">— Aucune (catégorie principale) —</option>
                  {parentCats.filter(p => !editCat || p.id !== editCat.id).map(p => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Imprimante
                  {!form.parent_id && <span className="text-red-500 ml-0.5">*</span>}
                  {form.parent_id && <span className="text-gray-400 text-xs font-normal ml-1">(héritée du parent si non définie)</span>}
                </label>

                <div className="grid grid-cols-1 gap-2">
                  {form.parent_id && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, printer_id: '' }))}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition-all ${
                        form.printer_id === ''
                          ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-600">Hériter du parent</span>
                      <span className="text-xs text-gray-400 ml-2">imprimante automatique</span>
                    </button>
                  )}
                  {printers.map(p => {
                    const c = printerTypeColors[p.type] || printerTypeColors.AUTRE;
                    const selected = form.printer_id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, printer_id: p.id }))}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition-all flex items-center gap-3 ${
                          selected
                            ? `${c.card} ring-2`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                        <span className="font-medium text-gray-800 flex-1">{p.nom}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.pill}`}>{p.type}</span>
                        {selected && <Check size={14} className="text-green-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {!form.printer_id && !form.parent_id && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} /> Requis pour valider une commande
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.actif ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.actif ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-700">{form.actif ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={close} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nom}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Check size={16} /> {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
