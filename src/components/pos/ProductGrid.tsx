import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, X, Utensils, Check } from 'lucide-react';
import type { Product, ProductVariant, Sauce, SelectedSauce, Flavor, SelectedFlavor, Category } from '../../types/database';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';

interface VariantModalProps {
  product: Product;
  onSelect: (variant: string, price?: number) => void;
  onClose: () => void;
  sym: string;
}

function VariantModal({ product, onSelect, onClose, sym }: VariantModalProps) {
  const variants = product.variants as ProductVariant[];

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="variant-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="variant-panel"
          initial={{ y: 32, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 32, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-sm bg-gray-900 border border-white/12 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-4 border-b border-white/8">
            <div className="flex gap-3 items-center min-w-0">
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-white font-bold text-base leading-tight truncate">{product.name}</p>
                <p className="text-blue-400 font-semibold text-sm mt-0.5">
                  {product.price.toLocaleString('fr-FR')} {sym}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center text-white/40 hover:text-white transition-all ml-2"
            >
              <X size={15} />
            </button>
          </div>

          {/* Variants */}
          <div className="p-5 pt-4">
            <p className="text-white/40 text-xs font-medium mb-3 uppercase tracking-wider">Choisir une variante</p>
            <div className="flex flex-col gap-2">
              {variants.map(v => {
                const displayPrice = v.price ?? product.price;
                return (
                  <motion.button
                    key={v.label}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { onSelect(v.label, v.price); onClose(); }}
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 text-white text-sm font-medium text-left transition-all flex items-center justify-between group"
                  >
                    <span>{v.label}</span>
                    <span className={`text-xs transition-colors ${v.price && v.price !== product.price ? 'text-amber-400 font-semibold' : 'text-white/20 group-hover:text-blue-400'}`}>
                      {displayPrice.toLocaleString('fr-FR')} {sym}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <button
              onClick={onClose}
              className="w-full mt-3 py-2.5 rounded-2xl bg-white/4 hover:bg-white/8 text-white/30 hover:text-white/60 text-sm transition-all"
            >
              Annuler
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

interface SauceModalProps {
  product: Product;
  sauces: Sauce[];
  required: boolean;
  maxCount: number;
  onConfirm: (sauces: SelectedSauce[]) => void;
  onClose: () => void;
}

function SauceModal({ product, sauces, required, maxCount, onConfirm, onClose }: SauceModalProps) {
  const [selected, setSelected] = useState<Sauce[]>([]);

  function toggle(sauce: Sauce) {
    setSelected(prev => {
      if (prev.some(s => s.id === sauce.id)) {
        return prev.filter(s => s.id !== sauce.id);
      }
      if (prev.length >= maxCount) {
        if (maxCount === 1) return [sauce];
        return prev;
      }
      return [...prev, sauce];
    });
  }

  function handleConfirm() {
    const payload: SelectedSauce[] = selected.map(s => ({
      id: s.id, name: s.name, price_supplement: s.price_supplement || 0,
    }));
    onConfirm(payload);
  }

  const canConfirm = required ? selected.length > 0 : true;
  const helper = required
    ? maxCount === 1 ? 'Choisissez 1 sauce' : `Choisissez ${maxCount} sauce${maxCount > 1 ? 's' : ''}`
    : maxCount === 1 ? 'Choisissez au plus 1 sauce (facultatif)' : `Choisissez au plus ${maxCount} sauces (facultatif)`;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="sauce-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="sauce-panel"
          initial={{ y: 32, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 32, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-sm bg-gray-900 border border-white/12 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-start justify-between p-5 pb-4 border-b border-white/8">
            <div className="flex gap-3 items-center min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <Utensils size={16} className="text-amber-300" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-base leading-tight truncate">{product.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{helper}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center text-white/40 hover:text-white transition-all ml-2"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 pt-4 max-h-[55vh] overflow-y-auto">
            {sauces.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">Aucune sauce disponible</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {sauces.map(s => {
                  const isSelected = selected.some(x => x.id === s.id);
                  const disabled = !isSelected && selected.length >= maxCount && maxCount > 1;
                  return (
                    <motion.button
                      key={s.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggle(s)}
                      disabled={disabled}
                      className={`aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 p-2 text-center
                        ${isSelected
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-100'
                          : disabled
                            ? 'bg-white/2 border-white/5 text-white/25'
                            : 'bg-white/5 hover:bg-amber-500/10 border-white/10 hover:border-amber-500/30 text-white'}`}
                    >
                      <span className="text-xs font-medium leading-tight line-clamp-3 break-words">{s.name}</span>
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-white/20'}`}>
                        {isSelected && <Check size={13} className="text-gray-900" strokeWidth={3} />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-5 pt-0 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-white/4 hover:bg-white/8 text-white/50 hover:text-white/80 text-sm transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-gray-900 text-sm font-semibold transition-all"
            >
              Valider {selected.length > 0 && `(${selected.length})`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

interface FlavorModalProps {
  product: Product;
  flavors: Flavor[];
  required: boolean;
  maxCount: number;
  onConfirm: (flavors: SelectedFlavor[]) => void;
  onClose: () => void;
}

function FlavorModal({ product, flavors, required, maxCount, onConfirm, onClose }: FlavorModalProps) {
  const [selected, setSelected] = useState<Flavor[]>([]);

  function toggle(flavor: Flavor) {
    setSelected(prev => {
      if (prev.some(f => f.id === flavor.id)) {
        return prev.filter(f => f.id !== flavor.id);
      }
      if (prev.length >= maxCount) {
        if (maxCount === 1) return [flavor];
        return prev;
      }
      return [...prev, flavor];
    });
  }

  function handleConfirm() {
    const payload: SelectedFlavor[] = selected.map(f => ({
      id: f.id, name: f.name, price_supplement: 0,
    }));
    onConfirm(payload);
  }

  const canConfirm = required ? selected.length > 0 : true;
  const helper = required
    ? maxCount === 1 ? 'Choisissez 1 gout' : `Choisissez ${maxCount} gout${maxCount > 1 ? 's' : ''}`
    : maxCount === 1 ? 'Choisissez au plus 1 gout (facultatif)' : `Choisissez au plus ${maxCount} gouts (facultatif)`;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="flavor-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="flavor-panel"
          initial={{ y: 32, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 32, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-sm bg-gray-900 border border-white/12 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-start justify-between p-5 pb-4 border-b border-white/8">
            <div className="flex gap-3 items-center min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Utensils size={16} className="text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-base leading-tight truncate">{product.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{helper}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center text-white/40 hover:text-white transition-all ml-2"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 pt-4 max-h-[55vh] overflow-y-auto">
            {flavors.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">Aucun gout disponible</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {flavors.map(f => {
                  const isSelected = selected.some(x => x.id === f.id);
                  const disabled = !isSelected && selected.length >= maxCount && maxCount > 1;
                  return (
                    <motion.button
                      key={f.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggle(f)}
                      disabled={disabled}
                      className={`aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 p-2 text-center
                        ${isSelected
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-100'
                          : disabled
                            ? 'bg-white/2 border-white/5 text-white/25'
                            : 'bg-white/5 hover:bg-blue-500/10 border-white/10 hover:border-blue-500/30 text-white'}`}
                    >
                      <span className="text-xs font-medium leading-tight line-clamp-3 break-words">{f.name}</span>
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                        {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-5 pt-0 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-white/4 hover:bg-white/8 text-white/50 hover:text-white/80 text-sm transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
            >
              Valider {selected.length > 0 && `(${selected.length})`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

interface ProductCardProps {
  product: Product;
  categories: Category[];
}

function ProductCard({ product, categories }: ProductCardProps) {
  const { addToCart, sauces: allSauces, flavors: allFlavors } = usePOS();
  const category = categories.find(c => c.id === product.category_id);
  const { settings } = useSettings();
  const [showVariants, setShowVariants] = useState(false);
  const [pendingVariant, setPendingVariant] = useState<{ label: string; price?: number } | null>(null);
  const [showSauces, setShowSauces] = useState(false);
  const [showFlavors, setShowFlavors] = useState(false);
  const [pendingSauces, setPendingSauces] = useState<SelectedSauce[]>([]);
  const [added, setAdded] = useState(false);
  const hasVariants = (product.variants as ProductVariant[]).length > 0;
  const needsSauce = settings.sauces_enabled && Boolean(category?.requires_sauce);
  const needsFlavor = settings.flavors_enabled && Boolean(category?.requires_flavor);

  const availableSauces = needsSauce
    ? (category?.allowed_sauce_ids?.length
        ? allSauces.filter(s => category.allowed_sauce_ids.includes(s.id))
        : allSauces)
    : [];

  const availableFlavors = needsFlavor
    ? (category?.allowed_flavor_ids?.length
        ? allFlavors.filter(fl => category.allowed_flavor_ids.includes(fl.id))
        : allFlavors)
    : [];

  function handleAdd() {
    if (hasVariants) {
      setShowVariants(true);
      return;
    }
    if (needsSauce && availableSauces.length > 0) {
      setPendingVariant({ label: '', price: undefined });
      setShowSauces(true);
      return;
    }
    if (needsFlavor && availableFlavors.length > 0) {
      setPendingVariant({ label: '', price: undefined });
      setShowFlavors(true);
      return;
    }
    finalize('', undefined, [], []);
  }

  function handleVariantSelect(label: string, price?: number) {
    setShowVariants(false);
    if (needsSauce && availableSauces.length > 0) {
      setPendingVariant({ label, price });
      setShowSauces(true);
      return;
    }
    if (needsFlavor && availableFlavors.length > 0) {
      setPendingVariant({ label, price });
      setShowFlavors(true);
      return;
    }
    finalize(label, price, [], []);
  }

  function handleSaucesConfirm(selected: SelectedSauce[]) {
    setShowSauces(false);
    if (needsFlavor && availableFlavors.length > 0) {
      setPendingSauces(selected);
      setShowFlavors(true);
      return;
    }
    const v = pendingVariant ?? { label: '', price: undefined };
    setPendingVariant(null);
    finalize(v.label, v.price, selected, []);
  }

  function handleFlavorsConfirm(selected: SelectedFlavor[]) {
    const v = pendingVariant ?? { label: '', price: undefined };
    setShowFlavors(false);
    setPendingVariant(null);
    setPendingSauces([]);
    finalize(v.label, v.price, pendingSauces, selected);
  }

  function finalize(variant: string, price: number | undefined, saucesForItem: SelectedSauce[], flavorsForItem: SelectedFlavor[]) {
    addToCart(product, variant, price, saucesForItem, flavorsForItem);
    setAdded(true);
    setTimeout(() => setAdded(false), 600);
  }

  const unavailable = product.track_stock && !product.is_available;

  return (
    <>
      {showVariants && (
        <VariantModal
          product={product}
          sym={settings.currency_symbol}
          onSelect={handleVariantSelect}
          onClose={() => setShowVariants(false)}
        />
      )}
      {showSauces && (
        <SauceModal
          product={product}
          sauces={availableSauces}
          required={Boolean(category?.sauce_required)}
          maxCount={Math.min(3, Math.max(1, category?.sauce_count ?? 1))}
          onConfirm={handleSaucesConfirm}
          onClose={() => { setShowSauces(false); setPendingVariant(null); }}
        />
      )}
      {showFlavors && (
        <FlavorModal
          product={product}
          flavors={availableFlavors}
          required={Boolean(category?.flavor_required)}
          maxCount={Math.min(3, Math.max(1, category?.flavor_count ?? 1))}
          onConfirm={handleFlavorsConfirm}
          onClose={() => { setShowFlavors(false); setPendingVariant(null); setPendingSauces([]); }}
        />
      )}
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={added
        ? { opacity: 1, scale: [1, 1.03, 1] }
        : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={unavailable ? undefined : handleAdd}
      whileTap={unavailable ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className={`relative rounded-xl border overflow-hidden flex flex-col transition-colors
        ${unavailable ? 'opacity-50 pointer-events-none' : 'hover:border-white/20 cursor-pointer'}
        ${added ? 'border-blue-500/50' : 'border-white/8'} bg-white/4`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-800/50 flex-shrink-0">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xl">
            🍽️
          </div>
        )}
        {unavailable && (
          <div className="absolute inset-0 bg-gray-950/70 flex items-center justify-center">
            <span className="text-white/60 text-[9px] font-medium px-1.5 py-0.5 bg-gray-900/80 rounded-md flex items-center gap-0.5">
              <AlertCircle size={9} /> Indisponible
            </span>
          </div>
        )}
        {hasVariants && !unavailable && (
          <div className="absolute top-1 right-1 bg-gray-900/80 rounded-md px-1 py-0.5 flex items-center gap-0.5">
            <ChevronDown size={8} className="text-white/50" />
            <span className="text-white/50 text-[8px]">{(product.variants as ProductVariant[]).length}</span>
          </div>
        )}
        {needsSauce && !unavailable && (
          <div className="absolute top-1 left-1 bg-amber-500/25 border border-amber-500/40 rounded-md px-1 py-0.5 flex items-center gap-0.5" title="Choix de sauce requis">
            <Utensils size={8} className="text-amber-200" />
          </div>
        )}
        {needsFlavor && !unavailable && (
          <div className="absolute top-1 left-1 bg-blue-500/25 border border-blue-500/40 rounded-md px-1 py-0.5 flex items-center gap-0.5" title="Choix de gout requis" style={{ left: needsSauce ? '20px' : '4px' }}>
            <Utensils size={8} className="text-blue-200" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-1.5 py-1.5 flex-1 flex flex-col justify-between gap-0.5">
        <p className="text-white text-[11px] sm:text-xs font-medium leading-tight line-clamp-2">{product.name}</p>
        <span className="text-blue-400 font-bold text-[11px] sm:text-xs">
          {product.price.toLocaleString('fr-FR')} {settings.currency_symbol}
        </span>
      </div>
    </motion.div>
    </>
  );
}

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  loading: boolean;
}

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

export function ProductGrid({ products, categories, loading }: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white/4 border border-white/8 overflow-hidden">
            <div className="aspect-square bg-white/5 animate-pulse" />
            <div className="px-1.5 py-1.5 space-y-1">
              <div className="h-2.5 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
          <AlertCircle size={22} className="text-white/20" />
        </div>
        <p className="text-white/40 font-medium text-sm">Aucun produit trouvé</p>
        <p className="text-white/20 text-xs mt-1">Essayez une autre recherche ou catégorie</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2"
    >
      <AnimatePresence mode="popLayout">
        {products.map(p => <ProductCard key={p.id} product={p} categories={categories} />)}
      </AnimatePresence>
    </motion.div>
  );
}
