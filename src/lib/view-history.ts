import prisma from './prisma';

/** One entry per counterparty; input must be sorted newest-first (updated_at / created_at desc). */
export function dedupeViewHistory<T>(rows: T[], counterpartyId: (row: T) => bigint): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = String(counterpartyId(row));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Record a profile view once per pair; re-visits bump updated_at (shows as latest in lists). */
export async function recordProfileView(viewerId: bigint, viewedUserId: bigint): Promise<void> {
  if (viewerId === viewedUserId) return;

  const existing = await prisma.profileView.findFirst({
    where: { viewer_id: viewerId, viewed_user_id: viewedUserId },
    orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
    select: { id: true },
  });

  if (existing) {
    await prisma.profileView.update({
      where: { id: existing.id },
      data: { updated_at: new Date() },
    });
    return;
  }

  await prisma.profileView.create({
    data: { viewer_id: viewerId, viewed_user_id: viewedUserId },
  });
}
