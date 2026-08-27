import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UtensilsCrossed, Phone, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  slug: string | null;
}

interface Category {
  id: string;
  nom: string;
  ordre: number | null;
  parent_id: string | null;
}

interface Product {
  id: string;
  nom: string;
  prix: number;
  image_url: string | null;
  category_id: string;
}

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function PublicMenu({ slug }: { slug: string }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: resto } = await supabase
        .from('restaurants')
        .select('id, name, address, phone, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (!resto) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRestaurant(resto);

      const [catsRes, prodsRes] = await Promise.all([
        supabase
          .from('categories')
          .select('id, nom, ordre, parent_id')
          .eq('actif', true)
          .order('ordre', { ascending: true, nullsFirst: false }),
        supabase
          .from('products')
          .select('id, nom, prix, image_url, category_id')
          .eq('restaurant_id', resto.id)
          .eq('actif', true)
          .order('nom'),
      ]);

      const cats = catsRes.data || [];
      const prods = prodsRes.data || [];

      const prodCatIds = new Set(prods.map(p => p.category_id));

      const usedCatIds = new Set<string>();
      for (const catId of prodCatIds) {
        usedCatIds.add(catId);
        const cat = cats.find(c => c.id === catId);
        if (cat?.parent_id) {
          usedCatIds.add(cat.parent_id);
          const parent = cats.find(c => c.id === cat.parent_id);
          if (parent?.parent_id) usedCatIds.add(parent.parent_id);
        }
      }

      const allNeededCatIds = new Set<string>(usedCatIds);
      const allCatsNeeded: Category[] = [];

      for (const id of allNeededCatIds) {
        const found = cats.find(c => c.id === id);
        if (found) {
          allCatsNeeded.push(found);
        } else {
          const { data: extra } = await supabase
            .from('categories')
            .select('id, nom, ordre, parent_id')
            .eq('id', id)
            .maybeSingle();
          if (extra) allCatsNeeded.push(extra);
        }
      }

      setCategories(allCatsNeeded);
      setProducts(prods);
      const topCatIds = allCatsNeeded
        .filter(c => !c.parent_id)
        .map(c => c.id);
      setExpandedCats(new Set(topCatIds));
      setLoading(false);
    }

    load();
  }, [slug]);

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !restaurant) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-white gap-4">
        <UtensilsCrossed className="w-16 h-16 text-amber-500" />
        <h1 className="text-2xl font-bold">Menu introuvable</h1>
        <p className="text-stone-400">Ce restaurant n'existe pas ou n'est plus disponible.</p>
      </div>
    );
  }

  const topCats = categories
    .filter(c => !c.parent_id)
    .sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));

  return (
    <div style={{ minHeight: '100dvh', overflowY: 'auto' }} className="bg-stone-950 text-white">
      <header className="bg-stone-900 border-b border-stone-800 shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-stone-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-amber-400 tracking-wide">{restaurant.name}</h1>
              <div className="flex flex-wrap gap-3 mt-0.5">
                {restaurant.address && (
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <MapPin className="w-3 h-3" />
                    {restaurant.address}
                  </span>
                )}
                {restaurant.phone && (
                  <a
                    href={`tel:${restaurant.phone}`}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    {restaurant.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-12">
        {topCats.length === 0 && (
          <div className="text-center text-stone-500 py-16">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun menu disponible pour le moment.</p>
          </div>
        )}

        {topCats.map(cat => (
          <CategorySection
            key={cat.id}
            cat={cat}
            categories={categories}
            products={products}
            expanded={expandedCats.has(cat.id)}
            onToggle={() => toggleCat(cat.id)}
          />
        ))}
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 text-center text-stone-600 text-xs">
        <div className="border-t border-stone-800 pt-6">
          {restaurant.name} &mdash; Menu digital
        </div>
      </footer>
    </div>
  );
}

function CategorySection({
  cat,
  categories,
  products,
  expanded,
  onToggle,
}: {
  cat: Category;
  categories: Category[];
  products: Product[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const subCats = categories
    .filter(c => c.parent_id === cat.id)
    .sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));

  const directProducts = products
    .filter(p => p.category_id === cat.id)
    .sort((a, b) => a.nom.localeCompare(b.nom));

  const hasContent = subCats.some(sub => products.some(p => p.category_id === sub.id))
    || directProducts.length > 0;

  if (!hasContent) return null;

  return (
    <div className="bg-stone-900 rounded-2xl overflow-hidden border border-stone-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-800 transition-colors"
      >
        <h2 className="text-base font-bold text-amber-400 uppercase tracking-wider">{cat.nom}</h2>
        {expanded
          ? <ChevronUp className="w-5 h-5 text-stone-500 flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-stone-500 flex-shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {subCats.map(sub => {
            const subProds = products
              .filter(p => p.category_id === sub.id)
              .sort((a, b) => a.nom.localeCompare(b.nom));
            if (subProds.length === 0) return null;
            return (
              <div key={sub.id}>
                <div className="px-2 py-2 text-xs font-semibold text-stone-400 uppercase tracking-widest border-b border-stone-700/50 mb-1">
                  {sub.nom}
                </div>
                <div className="space-y-1">
                  {subProds.map(p => <ProductRow key={p.id} product={p} />)}
                </div>
              </div>
            );
          })}
          {directProducts.length > 0 && (
            <div className="space-y-1">
              {directProducts.map(p => <ProductRow key={p.id} product={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  return (
    <div className="flex items-center gap-3 bg-stone-800/50 rounded-xl px-3 py-3 hover:bg-stone-800 transition-colors">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.nom}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-stone-700"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-stone-700 flex-shrink-0 flex items-center justify-center">
          <UtensilsCrossed className="w-5 h-5 text-stone-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{product.nom}</div>
      </div>
      <div className="text-sm font-bold text-amber-400 whitespace-nowrap flex-shrink-0">
        {fmtNum(product.prix)} F
      </div>
    </div>
  );
}
