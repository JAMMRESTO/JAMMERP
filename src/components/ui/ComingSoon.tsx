import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

const pageLabels: Record<string, string> = {
  pos: 'Point de vente',
  tables: 'Tables',
  delivery: 'Livraisons',
  kitchen: 'Cuisine',
  inventory: 'Inventaire',
  reports: 'Rapports',
  online_orders: 'Commandes en ligne',
};

export function ComingSoon({ page }: { page: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
          <Construction size={36} className="text-blue-400" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">{pageLabels[page] ?? page}</h2>
        <p className="text-white/40 text-base">Ce module sera disponible prochainement.</p>
        <div className="mt-6 flex items-center gap-2 justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </motion.div>
    </div>
  );
}
