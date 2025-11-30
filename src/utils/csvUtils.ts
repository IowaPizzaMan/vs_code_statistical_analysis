// Simple CSV parser that supports quoted fields with commas and newlines
export function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let cur: string[] = [];
    let curField = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    // escaped quote
                    curField += '"';
                    i++; // skip next
                } else {
                    inQuotes = false;
                }
            } else {
                curField += ch;
            }
        } else {
            if (ch === ',') {
                cur.push(curField);
                curField = '';
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === '\r') {
                // ignore
            } else if (ch === '\n') {
                cur.push(curField);
                rows.push(cur);
                cur = [];
                curField = '';
            } else {
                curField += ch;
            }
        }
    }
    // push last field
    if (inQuotes) {
        // unterminated quote -- treat as field end
        inQuotes = false;
    }
    if (curField !== '' || cur.length > 0) {
        cur.push(curField);
        rows.push(cur);
    }
    // filter empty trailing rows
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

export function getHeadersFromCSV(text: string): string[] {
    const rows = parseCSV(text);
    if (rows.length === 0) return [];
    return rows[0].map(h => (h || '').toString().trim());
}
