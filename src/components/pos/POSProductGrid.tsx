import { Package, Search } from 'lucide-react';
import { Product } from '../../lib/types';

interface Props {
  products: Product[];
  search: string;
  onSearchChange: (v: string) => void;
  onProductClick: (product: Product) => void;
}

const TILE_COLORS = [
  'bg-cyan-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-cyan-600',
  'bg-teal-600',
  'bg-sky-600',
];

export default function POSProductGrid({ products, search, onSearchChange, onProductClick }: Props) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ background: '#1e2a3a' }}>
      <div className="px-3 py-2 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <Search size={14} className="text-white/50 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
            className="bg-transparent text-white text-sm w-full focus:outline-none placeholder:text-white/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30">
            <Package size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Aucun produit</p>
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gridAutoRows: '140px',
            }}
          >
            {products.map((product, idx) => {
              const colorClass = TILE_COLORS[idx % TILE_COLORS.length];
              return (
                <button
                  key={product.id}
                  onClick={() => onProductClick(product)}
                  className={`group relative rounded-xl overflow-hidden text-left flex flex-col hover:brightness-110 transition-all active:scale-95 focus:outline-none shadow-md ${product.image_url ? '' : colorClass}`}
                >
                  {product.image_url ? (
                    <div className="absolute inset-0">
                      <img
                        src={product.image_url}
                        alt={product.nom}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package size={32} className="text-white/30" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 px-2 pb-2 pt-4">
                    <p className="font-bold text-white text-xs leading-tight line-clamp-2 drop-shadow">{product.nom}</p>
                    <p className="text-white/90 text-xs font-black mt-0.5 drop-shadow">{product.prix.toLocaleString('fr-FR')} F</p>
                  </div>
                  {((product.options && product.options.length > 0) || (product.variant_groups && product.variant_groups.length > 0)) && (
                    <div className="absolute top-1.5 right-1.5 bg-white/25 backdrop-blur-sm text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border border-white/30">
                      +
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
