/**
 * Formats a variant (size) label for display.
 *
 * For menu-included drinks, the label stored in the database looks like
 * "Moyenne - Inclus menu" or just "Inclus menu". We want to show:
 *  - "M Moyenne" for a menu drink with a size
 *  - "M" for a menu drink without a specific size
 *  - "Moyenne" for a regular drink with a size
 *  - nothing for items without a variant
 */
export function formatVariantLabel(label: string | null | undefined): string | null {
  if (!label || !label.trim()) return null;

  const isMenu = /inclus\s*menu/i.test(label);

  const sizeName = label
    .replace(/\s*[-–]\s*Inclus menu\s*/i, '')
    .replace(/Inclus menu/i, '')
    .trim();

  if (isMenu) {
    return sizeName ? `M ${sizeName}` : 'M';
  }

  return sizeName || null;
}

/**
 * Formats a display name combining the product name and its variant label.
 * For drinks, this shows the size so you can tell which specific drink was sold.
 * For menu drinks, the "M" prefix is added to the size.
 */
export function formatItemDisplayName(
  productName: string,
  variantLabel: string | null | undefined,
): string {
  const formatted = formatVariantLabel(variantLabel);
  if (!formatted) return productName;
  return `${productName} ${formatted}`;
}
