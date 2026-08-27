export function formatCurrency(amount: number, symbol = 'F CFA'): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ' + symbol;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateInput(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

export function generateNumero(prefix: string, count: number): string {
  const year = new Date().getFullYear();
  const num = String(count + 1).padStart(4, '0');
  return `${prefix}${year}-${num}`;
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getStatutColor(statut: string): string {
  const map: Record<string, string> = {
    brouillon: 'bg-gray-100 text-gray-700',
    envoyé: 'bg-blue-100 text-blue-700',
    envoyée: 'bg-blue-100 text-blue-700',
    accepté: 'bg-emerald-100 text-emerald-700',
    refusé: 'bg-red-100 text-red-700',
    converti: 'bg-emerald-100 text-emerald-700',
    partiellement_payée: 'bg-amber-100 text-amber-700',
    payée: 'bg-emerald-100 text-emerald-700',
    annulée: 'bg-red-100 text-red-700',
    reçue: 'bg-blue-100 text-blue-700',
    traité: 'bg-emerald-100 text-emerald-700',
  };
  return map[statut] || 'bg-gray-100 text-gray-700';
}

export function getStatutLabel(statut: string): string {
  const map: Record<string, string> = {
    brouillon: 'Brouillon',
    envoyé: 'Envoyé',
    envoyée: 'Envoyée',
    accepté: 'Accepté',
    refusé: 'Refusé',
    converti: 'Converti',
    partiellement_payée: 'Part. payée',
    payée: 'Payée',
    annulée: 'Annulée',
    reçue: 'Reçue',
    traité: 'Traité',
  };
  return map[statut] || statut;
}

export const MODES_PAIEMENT = [
  'Espèces',
  'Wave',
  'Orange Money',
  'Chèque',
  'Virement bancaire',
  'Carte bancaire',
  'Autre',
];

export const CATEGORIES_DEPENSES = [
  'Loyer',
  'Salaires',
  'Eau & Électricité',
  'Transport',
  'Communication',
  'Fournitures',
  'Marketing',
  'Maintenance',
  'Taxes & Impôts',
  'Autre',
];
