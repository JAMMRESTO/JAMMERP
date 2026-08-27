import { motion } from 'framer-motion';
import {
  TrendingUp, AlertTriangle, XCircle, Package,
  BarChart3, Star
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import type { Product, Category } from '../../types/database';

interface InventoryDashboardProps {
  products: Product[];
  categories: Category[];
  onNavigate: (tab: string) => void;
}

export function InventoryDashboard({ products, categories, onNavigate }: InventoryDashboardProps) {
  const { settings } = useSettings();
  const sym = settings.currency_symbol;

  const totalProducts = products.length;
  const outOfStock = products.filter(p => p.track_stock && (p.stock ?? 0) <= 0);
  const lowStock = products.filter(p => p.track_stock && p.stock !== null && p.stock > 0 && p.stock <= p.low_stock_threshold);
  const available = products.filter(p => p.is_available);

  // Top margin products
  const byMargin = [...products]
    .filter(p => p.price > 0 && p.cost_price > 0)
    .map(p => ({ ...p, margin: Math.round(((p.price - p.cost_price) / p.price) * 100) }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  // Low stock alert products
  const alertProducts = [...outOfStock, ...lowStock].slice(0, 5);

  // Stock value
  const stockValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * p.cost_price, 0);

  const catMap = new Map(categories.map(c => [c.id, c]));

  const stats = [
    { label: 'Total produits', value: totalProducts, icon: Package, color: '#3B82F6' },
    { label: 'Disponibles', value: available.length, icon: Package, color: '#10B981' },
    { label: 'Ruptures de stock', value: outOfStock.length, icon: XCircle, color: '#EF4444', onClick: () => onNavigate('products') },
    { label: 'Stock bas', value: lowStock.length, icon: AlertTriangle, color: '#F59E0B', onClick: () => onNavigate('products') },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={s.onClick}
              className={`glass-card rounded-2xl p-4 border border-white/8 hover:border-white/14 transition-all ${s.onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '22', border: `1px solid ${s.color}33` }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Stock value */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card rounded-2xl p-5 border border-white/8"
      >
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={15} className="text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Valeur du stock</h3>
        </div>
        <p className="text-3xl font-black text-blue-400">{stockValue.toLocaleString('fr-FR')} {sym}</p>
        <p className="text-white/30 text-xs mt-1">Basé sur le coût de production des produits suivis</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top margin */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl border border-white/8 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
            <TrendingUp size={15} className="text-emerald-400" />
            <h3 className="text-white font-semibold text-sm">Meilleurs marges</h3>
          </div>
          <div className="divide-y divide-white/5">
            {byMargin.length === 0 ? (
              <p className="text-white/30 text-sm p-5">Aucune donnée disponible</p>
            ) : byMargin.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                <span className="text-white/20 text-xs font-bold w-4">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="text-white/20 m-auto mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-white/30 text-xs">{catMap.get(p.category_id ?? '')?.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${p.margin >= 50 ? 'text-emerald-400' : p.margin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                    {p.margin}%
                  </p>
                  <p className="text-white/30 text-[10px]">{p.price.toLocaleString('fr-FR')} {sym}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-2xl border border-white/8 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400" />
              <h3 className="text-white font-semibold text-sm">Alertes stock</h3>
            </div>
            {alertProducts.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {alertProducts.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-white/5">
            {alertProducts.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <Star size={24} className="text-emerald-400 mb-2" />
                <p className="text-emerald-400 text-sm font-medium">Tous les stocks sont bons!</p>
              </div>
            ) : alertProducts.map(p => {
              const isOut = (p.stock ?? 0) <= 0;
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                    {isOut ? <XCircle size={14} className="text-red-400" /> : <AlertTriangle size={14} className="text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.name}</p>
                    <p className={`text-xs ${isOut ? 'text-red-400' : 'text-amber-400'}`}>
                      {isOut ? 'Rupture de stock' : `${p.stock} ${p.unit} restant${(p.stock ?? 0) > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate('movements')}
                    className="text-blue-400 hover:text-blue-300 text-xs transition-colors flex-shrink-0"
                  >
                    Réappro.
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
