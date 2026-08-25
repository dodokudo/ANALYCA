export type LineDraftCandidate = {
  id: string;
  status: string;
  lineMessageId: string | null;
  scheduleId: string | null;
  threadId: string | null;
};

export function isDraftReadyForLine(
  draft: Omit<LineDraftCandidate, 'id'>,
): boolean {
  return draft.status === 'ready' && !draft.lineMessageId && !draft.scheduleId && !draft.threadId;
}

export function selectReadyDraftsForLine<T extends LineDraftCandidate>(
  drafts: T[],
  draftIds?: string[],
): T[] {
  const eligible = drafts.filter(isDraftReadyForLine);
  if (!draftIds?.length) return eligible;
  const requestedIds = Array.from(new Set(draftIds));
  const eligibleById = new Map(eligible.map((draft) => [draft.id, draft]));
  const selected = requestedIds.map((draftId) => eligibleById.get(draftId));
  if (selected.some((draft) => !draft)) {
    throw new Error('完成前、LINE送信済み、予約済み、または公開済みの投稿が含まれています');
  }
  return selected as T[];
}
