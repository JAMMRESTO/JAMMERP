import { supabase } from '../lib/supabase';
import { InventoryItem, InventoryUnit, InventoryMovement, ProductRecipe } from '../lib/types';

export async function fetchInventoryUnits(): Promise<InventoryUnit[]> {
  const { data } = await supabase.from('inventory_units').select('*').order('ordre');
  return (data || []) as InventoryUnit[];
}

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const { data } = await supabase
    .from('inventory_items')
    .select('*, unit:inventory_units(*)')
    .order('nom');
  return (data || []) as InventoryItem[];
}

export async function fetchActiveInventoryItems(): Promise<InventoryItem[]> {
  const { data } = await supabase
    .from('inventory_items')
    .select('*, unit:inventory_units(*)')
    .eq('actif', true)
    .order('nom');
  return (data || []) as InventoryItem[];
}

export async function fetchMovements(limit = 200): Promise<InventoryMovement[]> {
  const { data } = await supabase
    .from('inventory_movements')
    .select('*, item:inventory_items(nom, unit:inventory_units(symbole))')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as InventoryMovement[];
}

export async function fetchMovementsByDateRange(startISO: string, endISO: string): Promise<InventoryMovement[]> {
  const { data } = await supabase
    .from('inventory_movements')
    .select('*, item:inventory_items(nom, unit:inventory_units(symbole))')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false });
  return (data || []) as InventoryMovement[];
}

export async function fetchProductRecipes(productId: string): Promise<ProductRecipe[]> {
  const { data } = await supabase
    .from('product_recipes')
    .select('*, item:inventory_items(nom, unit:inventory_units(symbole)), unit:inventory_units(*)')
    .eq('product_id', productId)
    .order('ordre');
  return (data || []) as ProductRecipe[];
}

export async function saveInventoryItem(item: Partial<InventoryItem> & { nom: string; unit_id: string }): Promise<InventoryItem | null> {
  if (item.id) {
    const { data } = await supabase
      .from('inventory_items')
      .update({
        nom: item.nom,
        category: item.category || 'General',
        unit_id: item.unit_id,
        alert_threshold: item.alert_threshold || 0,
        actif: item.actif !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select('*, unit:inventory_units(*)')
      .single();
    return data as InventoryItem;
  }
  const { data } = await supabase
    .from('inventory_items')
    .insert({
      nom: item.nom,
      category: item.category || 'General',
      unit_id: item.unit_id,
      alert_threshold: item.alert_threshold || 0,
      actif: true,
    })
    .select('*, unit:inventory_units(*)')
    .single();
  return data as InventoryItem;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await supabase.from('inventory_items').delete().eq('id', id);
}

export async function recordPurchase(
  itemId: string,
  qty: number,
  unitId: string,
  unitCost: number,
  supplier: string,
  notes: string,
  createdBy: string | null
): Promise<void> {
  await supabase.rpc('record_purchase', {
    p_item_id: itemId,
    p_qty: qty,
    p_unit_id: unitId,
    p_unit_cost: unitCost,
    p_supplier: supplier,
    p_notes: notes,
    p_created_by: createdBy,
  });
}

export async function recordManualMovement(
  itemId: string,
  type: 'IN' | 'OUT' | 'LOSS',
  qty: number,
  unitId: string,
  notes: string,
  createdBy: string | null
): Promise<void> {
  const { data: unit } = await supabase
    .from('inventory_units')
    .select('base_factor')
    .eq('id', unitId)
    .maybeSingle();
  const baseFactor = (unit as any)?.base_factor || 1;
  const baseQty = qty * baseFactor;

  const { data: item } = await supabase
    .from('inventory_items')
    .select('stock_qty, avg_purchase_price')
    .eq('id', itemId)
    .maybeSingle();
  const currentQty = (item as any)?.stock_qty || 0;
  const unitCost = (item as any)?.avg_purchase_price || 0;

  const newQty = type === 'IN' ? currentQty + baseQty : Math.max(0, currentQty - baseQty);
  await supabase.from('inventory_items')
    .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  await supabase.from('inventory_movements').insert({
    item_id: itemId,
    type,
    qty: baseQty,
    unit_cost: unitCost,
    total_cost: baseQty * unitCost,
    reference: type === 'LOSS' ? 'Perte' : 'Mouvement manuel',
    notes,
    created_by: createdBy,
  });
}

export async function deductInventoryForOrder(orderId: string): Promise<void> {
  await supabase.rpc('deduct_inventory_for_order', { p_order_id: orderId });
}

export async function saveRecipeLine(
  productId: string,
  itemId: string,
  qty: number,
  unitId: string,
  ordre: number
): Promise<ProductRecipe | null> {
  const { data } = await supabase
    .from('product_recipes')
    .insert({ product_id: productId, item_id: itemId, qty, unit_id: unitId, ordre })
    .select('*, item:inventory_items(nom, unit:inventory_units(symbole)), unit:inventory_units(*)')
    .single();
  return data as ProductRecipe;
}

export async function deleteRecipeLine(recipeId: string): Promise<void> {
  await supabase.from('product_recipes').delete().eq('id', recipeId);
}

export function formatStockQty(qty: number, unit?: InventoryUnit): string {
  const formatted = qty % 1 === 0 ? qty.toString() : qty.toFixed(2);
  return unit ? `${formatted} ${unit.symbole}` : formatted;
}

export function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('fr-FR') + ' F';
}

export function convertToBase(qty: number, unit: InventoryUnit): number {
  return qty * unit.base_factor;
}

export function convertFromBase(qty: number, unit: InventoryUnit): number {
  return unit.base_factor > 0 ? qty / unit.base_factor : qty;
}

export function getUnitsForFamily(units: InventoryUnit[], family: string): InventoryUnit[] {
  return units.filter(u => u.famille === family);
}
