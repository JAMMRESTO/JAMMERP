export type PaperWidth = 58 | 80;

export interface EscPosLayout {
  width: PaperWidth;
  columns: number;
}

export const LAYOUT_58: EscPosLayout = { width: 58, columns: 32 };
export const LAYOUT_80: EscPosLayout = { width: 80, columns: 48 };

export function layoutForWidth(width: PaperWidth): EscPosLayout {
  return width === 58 ? LAYOUT_58 : LAYOUT_80;
}

const ESC = 0x1b;
const GS = 0x1d;

const INIT = new Uint8Array([ESC, 0x40]);
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
const DOUBLE_ON = new Uint8Array([ESC, 0x21, 0x30]);
const DOUBLE_OFF = new Uint8Array([ESC, 0x21, 0x00]);
const SMALL_ON = new Uint8Array([ESC, 0x21, 0x01]);
const SMALL_OFF = new Uint8Array([ESC, 0x21, 0x00]);
const CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const CUT = new Uint8Array([GS, 0x56, 0x42, 0x00]);
const FEED_LINES = (n: number) => new Uint8Array([ESC, 0x64, n & 0xff]);

function setCodepage(codepageId: number): Uint8Array {
  return new Uint8Array([ESC, 0x74, codepageId]);
}

const CP858_ID = 19;

const CP858_MAP: Record<number, number> = {
  0xe0: 0x85, 0xe8: 0x8a, 0xe9: 0x82, 0xea: 0x88, 0xeb: 0x89,
  0xee: 0x8b, 0xef: 0x8f, 0xf4: 0x94, 0xf6: 0x99, 0xf9: 0x97,
  0xfb: 0x93, 0xfc: 0x81, 0xe7: 0x87, 0xe1: 0xa0, 0xed: 0xa1,
  0xf3: 0xa2, 0xf1: 0xa4, 0xd1: 0xa5, 0xe2: 0x83, 0xca: 0x8c,
  0xcb: 0x8d, 0xcf: 0xc7, 0xd6: 0x98, 0xdf: 0xe1, 0xc0: 0xb7,
  0xc8: 0xd4, 0xc9: 0x90,
  0x2019: 0x92, 0x2018: 0x91, 0x201c: 0x93, 0x201d: 0x94,
  0x2026: 0x85, 0x20ac: 0xd5,
  0xff: 0xf8, 0xe6: 0x92, 0xc6: 0x91,
  0xf2: 0xe0,
};

function encodeText(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      bytes.push(code);
    } else if (CP858_MAP[code] !== undefined) {
      bytes.push(CP858_MAP[code]);
    } else {
      bytes.push(0x3f);
    }
  }
  return new Uint8Array(bytes);
}

class ByteBuilder {
  private chunks: Uint8Array[] = [];

  append(data: Uint8Array): this {
    this.chunks.push(data);
    return this;
  }

  text(text: string): this {
    return this.append(encodeText(text));
  }

  line(text: string = ''): this {
    return this.text(text + '\n');
  }

  init(): this { return this.append(INIT); }
  boldOn(): this { return this.append(BOLD_ON); }
  boldOff(): this { return this.append(BOLD_OFF); }
  doubleOn(): this { return this.append(DOUBLE_ON); }
  doubleOff(): this { return this.append(DOUBLE_OFF); }
  smallOn(): this { return this.append(SMALL_ON); }
  smallOff(): this { return this.append(SMALL_OFF); }
  center(): this { return this.append(CENTER); }
  left(): this { return this.append(LEFT); }
  cut(): this { return this.append(CUT); }
  feed(n: number): this { return this.append(FEED_LINES(n)); }
  codepage858(): this { return this.append(setCodepage(CP858_ID)); }

  build(): Uint8Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '.' : s;
}

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function padLine(left: string, right: string, cols: number): string {
  const space = cols - left.length - right.length;
  if (space < 1) return left + '\n' + ' '.repeat(Math.max(0, cols - right.length)) + right;
  return left + ' '.repeat(space) + right;
}

export interface EscPosItem {
  nom: string;
  qty: number;
  notes?: string;
  options?: string[];
  unitPrice: number;
}

export interface EscPosTicketParams {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
  type: string;
  tableNom: string;
  ticketNumber: string;
  items: EscPosItem[];
  total?: number;
  montantRecu?: number;
  monnaie?: number;
  paymentMethodLabel?: string;
  width: PaperWidth;
  isOrderTicket?: boolean;
}

export function buildEscPosTicket(params: EscPosTicketParams): Uint8Array {
  const layout = layoutForWidth(params.width);
  const cols = layout.columns;
  const b = new ByteBuilder();
  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  });

  b.init().codepage858();

  const isOrderTicket = params.isOrderTicket || params.type === 'INITIAL';
  const showPrices = params.type === 'BILL' || params.type === 'RECEIPT';
  const typeLabel = params.type === 'INITIAL' ? 'BON DE COMMANDE'
    : params.type === 'ADDONS' ? 'AJOUTS'
    : params.type === 'BILL' ? 'ADDITION'
    : params.type === 'RECEIPT' ? 'FACTURE'
    : params.type === 'TEST' ? 'TEST IMPRESSION'
    : params.type === 'REPORT_X' ? 'RAPPORT X'
    : params.type === 'REPORT_Z' ? 'CLOTURE Z'
    : params.type;

  const doubleCols = Math.floor(cols / 2);
  const line = '-'.repeat(cols);
  const dline = '='.repeat(cols);

  if (isOrderTicket) {
    const dest = params.type === 'INITIAL' ? '' : '';
    b.center().doubleOn().boldOn().line(typeLabel + dest).boldOff().doubleOff().left();
    b.line(dline);
    b.boldOn().text(`Table: ${params.tableNom}`).boldOff().line(` · Ticket ${params.ticketNumber} · ${now}`);
    b.line(line);
  } else {
    b.center();
    b.doubleOn().line(params.restaurantName).doubleOff();
    if (showPrices) {
      if (params.address) b.line(params.address);
      if (params.phone) b.line('Tel: ' + params.phone);
      b.line(dline);
      b.boldOn().line(typeLabel).boldOff();
    } else {
      b.boldOn().line(typeLabel).boldOff();
      b.line(dline);
    }
    b.left();
    if (showPrices || params.type === 'TEST' || params.type === 'ADDONS') {
      b.line(`Table ${params.tableNom} · Ticket ${params.ticketNumber} · ${now}`);
      b.line(line);
    }
  }

  const merged = mergeItems(params.items);
  for (const item of merged) {
    const prefix = `${item.qty}x `;
    const lineTotal = fmtNum(item.unitPrice * item.qty) + 'F';

    if (isOrderTicket && !showPrices) {
      const dMaxNom = doubleCols - prefix.length;
      b.doubleOn().boldOn().text(prefix).line(truncate(item.nom, Math.max(6, dMaxNom))).boldOff().doubleOff();
    } else {
      if (showPrices) {
        const maxNom = cols - prefix.length - lineTotal.length - 1;
        const label = prefix + truncate(item.nom, Math.max(8, maxNom));
        const padding = Math.max(1, cols - label.length - lineTotal.length);
        b.boldOn().text(label).text(' '.repeat(padding)).line(lineTotal).boldOff();
      } else {
        b.boldOn().text(prefix).line(truncate(item.nom, Math.max(8, cols - prefix.length))).boldOff();
      }
    }

    if (item.options && item.options.length > 0) {
      b.text('  > ').line(item.options.join(', '));
    }
    if (item.notes) {
      b.smallOn().text('  ! ').line(item.notes).smallOff();
    }
  }

  if (!isOrderTicket) b.line(line);

  if (showPrices) {
    const itemsTotal = merged.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const computedTotal = (params.total && params.total > 0) ? params.total : itemsTotal;
    const totalStr = fmtNum(computedTotal) + ' FCFA';
    b.line(dline);
    b.center().doubleOn().boldOn();
    b.line(padLine('TOTAL:', totalStr, doubleCols));
    b.boldOff().doubleOff().left();

    if (params.type === 'RECEIPT' && params.paymentMethodLabel) {
      b.line(padLine('PAIEMENT:', params.paymentMethodLabel, cols));
    }
    if (params.type === 'RECEIPT' && params.montantRecu !== undefined && params.montantRecu > 0) {
      b.line(padLine('RECU:', fmtNum(params.montantRecu) + ' FCFA', cols));
    }
    if (params.type === 'RECEIPT' && params.monnaie !== undefined && params.monnaie > 0) {
      b.boldOn().line(padLine('MONNAIE:', fmtNum(params.monnaie) + ' FCFA', cols)).boldOff();
    }
    b.line(line);
  }

  if (!isOrderTicket) {
    b.center().line('Merci de votre confiance').left();
  }

  b.feed(3);
  b.cut();
  return b.build();
}

function mergeItems(items: EscPosItem[]): EscPosItem[] {
  const map = new Map<string, EscPosItem>();
  for (const item of items) {
    const key = `${item.nom}|${item.unitPrice}|${(item.options || []).join(',')}|${item.notes || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

export function buildEscPosTestTicket(printerName: string, width: PaperWidth): Uint8Array {
  const layout = layoutForWidth(width);
  const cols = layout.columns;
  const b = new ByteBuilder();
  b.init().codepage858();
  b.center().doubleOn().boldOn().line('TEST IMPRESSION').boldOff().doubleOff().left();
  b.line('='.repeat(cols));
  b.line(`Imprimante: ${printerName}`);
  b.line(`Largeur: ${width}mm (${cols} colonnes)`);
  b.line(`Date: ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`);
  b.line('-'.repeat(cols));
  b.boldOn().line('Accents: é è à ù ç ê î ô û').boldOff();
  b.line('Français: café résumé hôtel');
  b.line('Symbole: € ° µ §');
  b.line('-'.repeat(cols));
  b.center().line('Impression OK').left();
  b.feed(3);
  b.cut();
  return b.build();
}
