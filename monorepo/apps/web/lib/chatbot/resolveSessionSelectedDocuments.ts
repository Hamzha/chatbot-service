export type SessionSelectedDocRow = {
  ragSourceKey: string;
  /** Human-readable filename when the document still exists in the library. */
  displayName: string;
  documentId: string | null;
  inLibrary: boolean;
};

/**
 * Maps a chat session's vector-store keys to library filenames (stable, testable).
 */
export function resolveSelectedDocumentsFromLibrary(
  libraryRows: Array<{ id: string; source: string; ragSourceKey: string }>,
  selectedRagKeys: string[],
): SessionSelectedDocRow[] {
  const byKey = new Map<string, { id: string; source: string }>();
  for (const row of libraryRows) {
    byKey.set(row.ragSourceKey, { id: row.id, source: row.source });
  }
  return selectedRagKeys.map((ragSourceKey) => {
    const row = byKey.get(ragSourceKey);
    const inLibrary = Boolean(row);
    return {
      ragSourceKey,
      displayName: row?.source ?? "Document no longer in library",
      documentId: row ? row.id : null,
      inLibrary,
    };
  });
}
