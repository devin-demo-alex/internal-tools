/** "2026-02-02 09:00 UTC": the same text on the server and in the browser. */
export function formatDate(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
