/** "2026-02-02 09:00 UTC": the same text on the server and in the browser. */
export function formatDate(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** "driving_licence" becomes "Driving licence". */
export function formatDocumentType(documentType: string): string {
  const words = documentType.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
