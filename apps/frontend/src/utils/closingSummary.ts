const SUMMARY_FILLINGS = ['Veg', 'Paneer', 'Cheese Corn'] as const;

function fillingFromDisplayName(displayName: string): string {
  if (/cheese\s*corn/i.test(displayName)) return 'Cheese Corn';
  if (/paneer/i.test(displayName)) return 'Paneer';
  if (/veg/i.test(displayName)) return 'Veg';
  return 'Unknown';
}

function toDDMMYYYY(dateStr: string): string {
  return dateStr.split('-').reverse().join('-');
}

/**
 * The closing-stock message staff paste into chat: leftovers and wastage per
 * filling. Shared by the staff and admin closing-stock pages so both copy the
 * same text.
 */
export function buildClosingSummary(
  date: string,
  items: { displayName: string; packets: number; pieces: number; wastage: number }[],
): string {
  const data: Record<string, { packets: number; pieces: number; wastage: number }> = {};
  for (const item of items) {
    data[fillingFromDisplayName(item.displayName)] = { packets: item.packets, pieces: item.pieces, wastage: item.wastage };
  }

  const lines: string[] = [];
  lines.push(`Data: ${toDDMMYYYY(date)}`);
  lines.push('');
  lines.push('Left Over:');
  for (const f of SUMMARY_FILLINGS) {
    const d = data[f] ?? { packets: 0, pieces: 0, wastage: 0 };
    let s: string;
    if (d.packets > 0 && d.pieces > 0) {
      s = `${d.packets} ${d.packets === 1 ? 'Packet' : 'Packets'} and ${d.pieces} ${d.pieces === 1 ? 'piece' : 'pieces'}`;
    } else if (d.packets > 0) {
      s = `${d.packets} ${d.packets === 1 ? 'Packet' : 'Packets'}`;
    } else if (d.pieces > 0) {
      s = `${d.pieces} ${d.pieces === 1 ? 'Piece' : 'Pieces'}`;
    } else {
      s = '0';
    }
    lines.push(`${f}: ${s}`);
  }
  lines.push('');
  lines.push('Wastage:');
  let hasWastage = false;
  for (const f of SUMMARY_FILLINGS) {
    const d = data[f] ?? { packets: 0, pieces: 0, wastage: 0 };
    if (d.wastage > 0) {
      lines.push(`${f}: ${d.wastage} ${d.wastage === 1 ? 'piece' : 'pieces'}`);
      hasWastage = true;
    }
  }
  if (!hasWastage) {
    lines.push('None');
  }
  return lines.join('\n');
}

/** Copies text, falling back to a hidden textarea where the Clipboard API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
