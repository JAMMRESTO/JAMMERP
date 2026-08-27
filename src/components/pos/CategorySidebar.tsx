import { Category } from '../../lib/types';

interface Props {
  categories: Category[];
  selectedCategory: string | null;
  onSelect: (id: string | null) => void;
  mobile?: boolean;
}

export default function CategorySidebar({ categories, selectedCategory, onSelect, mobile }: Props) {
  const parentCats = categories.filter(c => !c.parent_id);
  const subCats = categories.filter(c => !!c.parent_id);

  const activeParentId = selectedCategory
    ? (parentCats.find(p => p.id === selectedCategory)
        ? selectedCategory
        : subCats.find(s => s.id === selectedCategory)?.parent_id || null)
    : null;

  const visibleSubs = activeParentId ? subCats.filter(s => s.parent_id === activeParentId) : [];

  if (mobile) {
    return (
      <div className="flex-shrink-0" style={{ background: '#162032' }}>
        <div className="grid grid-cols-4 gap-0 border-b border-white/10">
          <button
            onClick={() => onSelect(null)}
            className={`flex items-center justify-center py-3 px-1 text-[11px] font-bold tracking-wide uppercase transition-all border-r border-white/10 ${
              !selectedCategory
                ? 'bg-amber-500 text-white'
                : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            Tout
          </button>
          {parentCats.map(cat => {
            const isSelected = selectedCategory === cat.id;
            const isActive = activeParentId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`flex items-center justify-center py-3 px-1 text-[11px] font-semibold text-center leading-tight transition-all border-r border-white/10 ${
                  isSelected
                    ? 'bg-amber-500 text-white'
                    : isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat.nom}
              </button>
            );
          })}
        </div>

        {visibleSubs.length > 0 && (
          <div className="grid grid-cols-4 gap-0 border-b border-white/10" style={{ background: '#0f1a29' }}>
            {visibleSubs.map(sub => (
              <button
                key={sub.id}
                onClick={() => onSelect(sub.id)}
                className={`flex items-center justify-center py-2 px-1 text-[10px] font-semibold text-center leading-tight transition-all border-r border-white/5 ${
                  selectedCategory === sub.id
                    ? 'bg-amber-500/80 text-white'
                    : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {sub.nom}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex flex-col overflow-y-auto" style={{ background: '#162032' }}>
      <button
        onClick={() => onSelect(null)}
        className={`w-full flex items-center justify-center min-h-[52px] text-xs font-bold tracking-wide uppercase transition-all border-b border-white/10 flex-shrink-0 px-2 ${
          !selectedCategory
            ? 'bg-amber-500 text-white'
            : 'text-white/50 hover:bg-white/10 hover:text-white'
        }`}
      >
        Tout
      </button>

      {parentCats.map(cat => {
        const isActive = activeParentId === cat.id;
        const catSubs = subCats.filter(s => s.parent_id === cat.id);
        const isSelected = selectedCategory === cat.id;

        return (
          <div key={cat.id} className="flex-shrink-0">
            <button
              onClick={() => onSelect(cat.id)}
              className={`w-full flex items-center justify-center min-h-[52px] text-xs font-semibold tracking-wide transition-all border-b border-white/10 text-center leading-tight px-2 ${
                isSelected
                  ? 'bg-amber-500 text-white'
                  : isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{cat.nom}</span>
              {catSubs.length > 0 && (
                <span className="absolute right-1.5 text-[8px] text-white/30">{catSubs.length}</span>
              )}
            </button>

            {isActive && visibleSubs.length > 0 && (
              <div className="border-b border-white/10" style={{ background: '#0f1a29' }}>
                {visibleSubs.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => onSelect(sub.id)}
                    className={`w-full flex items-center justify-center min-h-[40px] text-[10px] font-semibold transition-all border-b border-white/5 px-2 text-center leading-tight ${
                      selectedCategory === sub.id
                        ? 'bg-amber-500/80 text-white'
                        : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                    }`}
                  >
                    <span className="mr-0.5 text-white/30">›</span> {sub.nom}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
