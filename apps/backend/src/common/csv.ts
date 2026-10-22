// Quotes a CSV cell and neutralises spreadsheet formulas. Text beginning with = + - @ (or a tab/carriage return that
// spreadsheets strip before parsing) is prefixed with an apostrophe so Excel/Sheets treat it as text, not a formula.
// Numbers are written unchanged so amounts stay numeric.
export function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
