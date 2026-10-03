import { db } from './schema';

export async function exportJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const t of db.tables) data[t.name] = await t.toArray();
  return JSON.stringify({ app: 'liftlog', version: 1, exportedAt: new Date().toISOString(), data }, null, 1);
}

export async function importJSON(text: string) {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'liftlog' || !parsed.data) throw new Error('Not a LiftLog backup file');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = parsed.data[t.name];
      if (Array.isArray(rows) && rows.length) await t.bulkAdd(rows);
    }
  });
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
