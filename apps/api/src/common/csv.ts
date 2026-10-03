/**
 * Minimal RFC 4180 CSV reader: quoted fields, doubled quotes, commas and newlines inside quotes,
 * CRLF or LF line endings, and an optional UTF-8 byte-order mark (Excel adds one).
 * Returns rows of strings; fully blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('A quoted field is not closed.');
  if (field !== '' || row.length) endRow();
  return rows;
}

/** Quotes a value for CSV output when it needs it. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
