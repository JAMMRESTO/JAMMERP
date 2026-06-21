import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, X } from 'lucide-react';
import type { Product, ProductVariant } from '../../types/database';
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

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = usePOS();
  const { settings } = useSettings();
  const [showVariants, setShowVariants] = useState(false);
  const [added, setAdded] = useState(false);
  const hasVariants = (product.variants as ProductVariant[]).length > 0;

  function handleAdd() {
    if (hasVariants) {
      setShowVariants(true);
      return;
    }
    triggerAdd('');
  }

  function triggerAdd(variant: string, price?: number) {
    addToCart(product, variant, price);
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
          onSelect={triggerAdd}
          onClose={() => setShowVariants(false)}
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
  loading: boolean;
}

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

export function ProductGrid({ products, loading }: ProductGridProps) {
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
        {products.map(p => <ProductCard key={p.id} product={p} />)}
      </AnimatePresence>
    </motion.div>
  );
}
