export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAt}|${c.id}`).toString('base64');
}

export function decodeCursor(s: string): Cursor | null {
  try {
    const [createdAt, id] = Buffer.from(s, 'base64').toString('utf8').split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
