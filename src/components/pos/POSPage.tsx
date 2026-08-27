import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, FileText, CreditCard, History, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company, Produit, POSCartItem, POSSession, POSVente, POSVenteLigne } from '../../types';
import { generateNumero, formatCurrency } from '../../lib/utils';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import POSProductGrid from './POSProductGrid';
import POSCart from './POSCart';
import POSReceipt from './POSReceipt';
import POSOpenInvoices from './POSOpenInvoices';
import POSDepenseModal from './POSDepenseModal';
import POSSalesHistory from './POSSalesHistory';

interface Props {
  companyId: string;
  company: Company;
}

export default function POSPage({ companyId, company }: Props) {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [modePaiement, setModePaiement] = useState('Espèces');
  const [montantRecu, setMontantRecu] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProduits, setLoadingProduits] = useState(true);
  const [session, setSession] = useState<POSSession | null>(null);
  const [fondCaisse, setFondCaisse] = useState('');
  const [openingSession, setOpeningSession] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [receipt, setReceipt] = useState<(POSVente & { lignes: POSVenteLigne[] }) | null>(null);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showDepense, setShowDepense] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'produits' | 'panier'>('produits');

  useEffect(() => { loadAll(); }, [companyId]);

  const silentRefresh = useCallback(() => { loadProduits(true); loadTodayStats(); }, [companyId]);
  useRealtimeRefresh(['produits', 'pos_ventes'], companyId, silentRefresh);

  async function loadAll() {
    await Promise.all([loadProduits(), loadSession(), loadTodayStats()]);
  }

  async function loadProduits(silent = false) {
    if (!silent) setLoadingProduits(true);
    const { data } = await supabase
      .from('produits')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setProduits(data || []);
    if (!silent) setLoadingProduits(false);
  }

  async function loadSession() {
    const { data } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('company_id', companyId)
      .eq('statut', 'ouverte')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession(data as POSSession | null);
  }

  async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('pos_ventes')
      .select('total_ttc')
      .eq('company_id', companyId)
      .eq('statut', 'finalisée')
      .eq('date_vente', today);
    const d = data || [];
    setTodayCount(d.length);
  }

  async function openSession() {
    setOpeningSession(true);
    const { data: user } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('pos_sessions')
      .insert({
        company_id: companyId,
        opened_by: user?.user?.id || null,
        fond_caisse_ouverture: parseFloat(fondCaisse) || 0,
        statut: 'ouverte',
      })
      .select()
      .maybeSingle();
    setSession(data as POSSession | null);
    setFondCaisse('');
    setOpeningSession(false);
  }

  async function closeSession() {
    if (!session) return;
    if (!confirm('Fermer la session de caisse ?')) return;
    setClosingSession(true);
    await supabase.from('pos_sessions').update({
      statut: 'fermée',
      closed_at: new Date().toISOString(),
      fond_caisse_fermeture: session.fond_caisse_ouverture + session.total_especes,
    }).eq('id', session.id);
    setSession(null);
    setClosingSession(false);
  }

  function addToCart(produit: Produit, type: 'unite' | 'conditionnement' = 'unite') {
    const isConditionnement = type === 'conditionnement' && produit.prix_conditionnement != null && produit.quantite_par_conditionnement > 1;
    const prixUnitaire = isConditionnement ? produit.prix_conditionnement! : produit.prix_vente;
    const condQty = isConditionnement ? produit.quantite_par_conditionnement : 1;
    const uniteLabel = isConditionnement ? (produit.conditionnement_nom || produit.conditionnement || 'cond.') : (produit.unite || 'unité');
    const designation = isConditionnement ? `${produit.name} (${uniteLabel})` : produit.name;
    const cartKey = `${produit.id}_${type}`;

    setCart(prev => {
      const idx = prev.findIndex(i => i.produit_id === cartKey);
      if (idx >= 0) {
        const nextQty = prev[idx].quantite + 1;
        if (nextQty * condQty > produit.stock_actuel) return prev;
        const updated = [...prev];
        const item = { ...updated[idx], quantite: nextQty };
        item.montant_ht = item.quantite * (item.prix_unitaire / (1 + item.tva_taux / 100));
        item.montant_tva = item.montant_ht * (item.tva_taux / 100);
        item.montant_ttc = item.quantite * item.prix_unitaire;
        updated[idx] = item;
        return updated;
      }
      if (condQty > produit.stock_actuel) return prev;
      const tva = company.tva_enabled ? (produit.tva_taux || company.tva_rate || 0) : 0;
      const ht = prixUnitaire / (1 + tva / 100);
      return [...prev, {
        produit_id: cartKey,
        designation,
        quantite: 1,
        prix_unitaire: prixUnitaire,
        tva_taux: tva,
        montant_ht: ht,
        montant_tva: ht * (tva / 100),
        montant_ttc: prixUnitaire,
        stock_actuel: Math.floor(produit.stock_actuel / condQty),
        type_vente: type,
        conditionnement_quantite: condQty,
        unite_label: uniteLabel,
      }];
    });
  }

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) { removeItem(idx); return; }
    setCart(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], quantite: qty };
      item.montant_ht = item.quantite * (item.prix_unitaire / (1 + item.tva_taux / 100));
      item.montant_tva = item.montant_ht * (item.tva_taux / 100);
      item.montant_ttc = item.montant_ht + item.montant_tva;
      updated[idx] = item;
      return updated;
    });
  }

  function removeItem(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  async function validateSale() {
    if (cart.length === 0) return;
    setLoading(true);

    const { data: count } = await supabase.from('pos_ventes').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    const numero = generateNumero('VTE', count || 0);
    const totalHT = cart.reduce((a, i) => a + i.montant_ht, 0);
    const totalTVA = cart.reduce((a, i) => a + i.montant_tva, 0);
    const totalTTC = cart.reduce((a, i) => a + i.montant_ttc, 0);
    const recu = modePaiement === 'Espèces' ? (parseFloat(montantRecu) || totalTTC) : totalTTC;
    const monnaie = Math.max(0, recu - totalTTC);

    const { data: user } = await supabase.auth.getUser();

    const { data: newVente, error } = await supabase
      .from('pos_ventes')
      .insert({
        company_id: companyId,
        session_id: session?.id || null,
        numero,
        date_vente: new Date().toISOString().split('T')[0],
        total_ht: totalHT,
        total_tva: totalTVA,
        total_ttc: totalTTC,
        montant_recu: recu,
        monnaie_rendue: monnaie,
        mode_paiement: modePaiement,
        statut: 'finalisée',
        created_by: user?.user?.id || null,
      })
      .select()
      .maybeSingle();

    if (error || !newVente) { setLoading(false); return; }

    await supabase.from('pos_vente_lignes').insert(
      cart.map((item, i) => {
        const realProduitId = item.produit_id.includes('_') ? item.produit_id.split('_')[0] : item.produit_id;
        return {
          vente_id: newVente.id,
          produit_id: realProduitId,
          designation: item.designation,
          quantite: item.quantite,
          prix_unitaire: item.prix_unitaire,
          tva_taux: item.tva_taux,
          montant_ht: item.montant_ht,
          montant_tva: item.montant_tva,
          montant_ttc: item.montant_ttc,
          sort_order: i,
        };
      })
    );

    const stockUpdates: Array<{ id: string; stock_actuel: number; stock_avant: number; quantite: number }> = [];
    for (const item of cart) {
      const realProduitId = item.produit_id.includes('_') ? item.produit_id.split('_')[0] : item.produit_id;
      const produit = produits.find(p => p.id === realProduitId);
      if (!produit) continue;
      const condQty = item.conditionnement_quantite || 1;
      const stockDebit = item.quantite * condQty;
      const newStock = produit.stock_actuel - stockDebit;
      stockUpdates.push({ id: realProduitId, stock_actuel: newStock, stock_avant: produit.stock_actuel, quantite: stockDebit });
    }

    const mouvements = stockUpdates.map(u => ({
      company_id: companyId,
      produit_id: u.id,
      type_mouvement: 'sortie',
      quantite: u.quantite,
      stock_avant: u.stock_avant,
      stock_apres: u.stock_actuel,
      reference_type: 'pos_vente',
      notes: `Vente POS: ${numero}`,
    }));

    await Promise.all([
      ...stockUpdates.map(u => supabase.from('produits').update({ stock_actuel: u.stock_actuel }).eq('id', u.id)),
      mouvements.length > 0 ? supabase.from('mouvements_stock').insert(mouvements) : Promise.resolve(),
    ]);

    if (session) {
      const isCash = modePaiement === 'Espèces';
      const isWave = modePaiement === 'Wave';
      const isOM = modePaiement === 'Orange Money';
      const isOther = !isCash && !isWave && !isOM;
      await supabase.from('pos_sessions').update({
        total_ventes: session.total_ventes + totalTTC,
        total_especes: session.total_especes + (isCash ? totalTTC : 0),
        total_wave: session.total_wave + (isWave ? totalTTC : 0),
        total_om: session.total_om + (isOM ? totalTTC : 0),
        total_autres: session.total_autres + (isOther ? totalTTC : 0),
      }).eq('id', session.id);
      setSession(s => s ? {
        ...s,
        total_ventes: s.total_ventes + totalTTC,
        total_especes: s.total_especes + (isCash ? totalTTC : 0),
        total_wave: s.total_wave + (isWave ? totalTTC : 0),
        total_om: s.total_om + (isOM ? totalTTC : 0),
        total_autres: s.total_autres + (isOther ? totalTTC : 0),
      } : null);
    }

    const lignes = cart.map((item, i) => ({
      vente_id: newVente.id,
      produit_id: item.produit_id.includes('_') ? item.produit_id.split('_')[0] : item.produit_id,
      designation: item.designation,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      tva_taux: item.tva_taux,
      montant_ht: item.montant_ht,
      montant_tva: item.montant_tva,
      montant_ttc: item.montant_ttc,
      sort_order: i,
    }));

    setReceipt({ ...newVente as POSVente, lignes });
    setCart([]);
    setMontantRecu('');
    setMobileTab('produits');
    loadProduits();
    loadTodayStats();
    setLoading(false);
  }

  const sym = company.currency_symbol;
  const cartCount = cart.reduce((a, i) => a + i.quantite, 0);
  const cartTotal = cart.reduce((a, i) => a + i.montant_ttc, 0);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Point de Vente</h2>
          <p className="text-sm text-slate-500 mb-6">Ouvrez une session de caisse pour commencer à vendre</p>
          <div className="mb-4 text-left">
            <label className="block text-sm font-medium text-slate-700 mb-1">Fond de caisse initial</label>
            <input
              type="number"
              value={fondCaisse}
              onChange={e => setFondCaisse(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={openSession}
            disabled={openingSession}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-500 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Unlock className="w-5 h-5" />
            {openingSession ? 'Ouverture...' : 'Ouvrir la caisse'}
          </button>
        </div>
      </div>
    );
  }

  const sessionBar = (
    <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2 flex-wrap flex-shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
        <span className="text-sm font-semibold text-slate-900 truncate">Caisse ouverte</span>
        <span className="text-xs text-slate-400 flex-shrink-0">· {todayCount} vente{todayCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setShowHistory(true)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-gray-100 active:bg-gray-200 px-2.5 py-1.5 rounded-lg">
          <History className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setShowInvoices(true)}
          className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 active:bg-amber-100 px-2.5 py-1.5 rounded-lg">
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setShowDepense(true)}
          className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 active:bg-rose-100 px-2.5 py-1.5 rounded-lg">
          <CreditCard className="w-3.5 h-3.5" />
        </button>
        <button onClick={closeSession} disabled={closingSession}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-gray-100 active:bg-red-50 px-2.5 py-1.5 rounded-lg">
          <Lock className="w-3.5 h-3.5" />
        </button>
      </div>
      {session.total_ventes > 0 && (
        <div className="w-full flex items-center flex-wrap gap-x-3 gap-y-1 text-xs bg-blue-50 rounded-lg px-3 py-1.5">
          <span className="text-slate-500">Session: <span className="font-bold text-blue-700">{formatCurrency(session.total_ventes, sym)}</span></span>
          {session.total_especes > 0 && (
            <span className="text-slate-500">Esp.: <span className="font-bold text-emerald-600">{formatCurrency(session.total_especes, sym)}</span></span>
          )}
          {session.total_wave > 0 && (
            <span className="text-slate-500">Wave: <span className="font-bold text-sky-600">{formatCurrency(session.total_wave, sym)}</span></span>
          )}
          {session.total_om > 0 && (
            <span className="text-slate-500">OM: <span className="font-bold text-orange-600">{formatCurrency(session.total_om, sym)}</span></span>
          )}
        </div>
      )}
      {produits.some(p => p.stock_actuel <= p.stock_minimum && p.stock_actuel > 0) && (
        <div className="w-full flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Certains produits ont un stock faible
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="lg:hidden flex flex-col h-full pb-[calc(56px+36px)]">
        {sessionBar}

        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => setMobileTab('produits')}
            className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
              mobileTab === 'produits'
                ? 'text-blue-600'
                : 'text-slate-500'
            }`}
          >
            Produits
            {mobileTab === 'produits' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setMobileTab('panier')}
            className={`flex-1 py-3 text-sm font-bold transition-colors relative flex items-center justify-center gap-2 ${
              mobileTab === 'panier'
                ? 'text-blue-600'
                : 'text-slate-500'
            }`}
          >
            Panier
            {cartCount > 0 && (
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                mobileTab === 'panier' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {cartCount}
              </span>
            )}
            {cartCount > 0 && mobileTab !== 'panier' && (
              <span className="text-xs text-blue-600 font-bold">
                {formatCurrency(cartTotal, sym)}
              </span>
            )}
            {mobileTab === 'panier' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileTab === 'produits' ? (
            loadingProduits ? (
              <div className="flex justify-center items-center h-40">
                <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <POSProductGrid
                produits={produits}
                search={search}
                onSearch={setSearch}
                onAdd={(produit, type) => {
                  addToCart(produit, type);
                }}
                currencySymbol={sym}
                mobile
              />
            )
          ) : (
            <POSCart
              items={cart}
              modePaiement={modePaiement}
              montantRecu={montantRecu}
              tvaEnabled={company.tva_enabled}
              currencySymbol={sym}
              onUpdateQty={updateQty}
              onRemove={removeItem}
              onModeChange={setModePaiement}
              onMontantRecuChange={setMontantRecu}
              onValidate={validateSale}
              loading={loading}
            />
          )}
        </div>

        {mobileTab === 'produits' && cartCount > 0 && (
          <button
            onClick={() => setMobileTab('panier')}
            className="flex-shrink-0 mx-3 mb-2 flex items-center justify-between bg-blue-600 text-white px-5 py-4 rounded-2xl shadow-xl shadow-blue-600/30 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-blue-600 text-[10px] font-black rounded-full flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              </div>
              <span className="font-bold">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
            </div>
            <span className="font-black text-lg">{formatCurrency(cartTotal, sym)}</span>
          </button>
        )}
      </div>

      <div className="hidden lg:flex flex-col h-full">
        {sessionBar}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden">
            {loadingProduits ? (
              <div className="flex justify-center items-center h-40">
                <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <POSProductGrid
                produits={produits}
                search={search}
                onSearch={setSearch}
                onAdd={(produit, type) => addToCart(produit, type)}
                currencySymbol={sym}
              />
            )}
          </div>
          <div className="w-80 xl:w-96 2xl:w-[420px] flex-shrink-0 overflow-hidden flex flex-col border-l border-gray-100">
            <POSCart
              items={cart}
              modePaiement={modePaiement}
              montantRecu={montantRecu}
              tvaEnabled={company.tva_enabled}
              currencySymbol={sym}
              onUpdateQty={updateQty}
              onRemove={removeItem}
              onModeChange={setModePaiement}
              onMontantRecuChange={setMontantRecu}
              onValidate={validateSale}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {receipt && (
        <POSReceipt
          vente={receipt}
          company={company}
          onClose={() => setReceipt(null)}
          onNewSale={() => setReceipt(null)}
        />
      )}

      {showInvoices && (
        <POSOpenInvoices
          companyId={companyId}
          currencySymbol={sym}
          sessionId={session?.id || null}
          onClose={() => setShowInvoices(false)}
          onPaid={() => { loadTodayStats(); loadSession(); }}
        />
      )}

      {showDepense && (
        <POSDepenseModal
          companyId={companyId}
          sessionId={session?.id || null}
          onClose={() => setShowDepense(false)}
          onSaved={async (montant) => {
            setShowDepense(false);
            if (session) {
              await supabase.from('pos_sessions').update({
                total_ventes: session.total_ventes - montant,
                total_especes: session.total_especes - montant,
              }).eq('id', session.id);
              setSession(s => s ? {
                ...s,
                total_ventes: s.total_ventes - montant,
                total_especes: s.total_especes - montant,
              } : null);
            }
          }}
        />
      )}

      {showHistory && (
        <POSSalesHistory
          companyId={companyId}
          currencySymbol={sym}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
