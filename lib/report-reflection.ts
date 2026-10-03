export const REFLECTION_FIELDS = [
  { key: 'summary', label: '今月の総括', placeholder: '今月の運用全体を振り返って、伝えたいこと' },
  { key: 'results', label: '成果・わかったこと', placeholder: '反応の良かった投稿や、数字からわかったこと' },
  { key: 'improvements', label: '課題・改善点', placeholder: '課題と、改善したいこと' },
  { key: 'nextMonth', label: '来月の運用方針', placeholder: '次に取り組むことや、検証すること' },
] as const;

export type ReflectionFields = Record<typeof REFLECTION_FIELDS[number]['key'], string>;
export interface ReflectionRevision {
  revision: number;
  requestId: string;
  fields: ReflectionFields;
  savedAt: string;
}
export interface ReflectionWrite {
  expectedRevision: number;
  requestId: string;
  fields: ReflectionFields;
}
export const EMPTY_REFLECTION: ReflectionFields = { summary: '', results: '', improvements: '', nextMonth: '' };

export function sameReflection(a: ReflectionFields, b: ReflectionFields): boolean {
  return REFLECTION_FIELDS.every(({ key }) => a[key] === b[key]);
}

export function parseReflectionWrite(value: unknown): ReflectionWrite {
  const input = value as Partial<ReflectionWrite>;
  if (!input || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision! < 0
    || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)
    || !input.fields) throw new Error('保存する内容を確認してください');
  const fields = { ...EMPTY_REFLECTION };
  for (const { key } of REFLECTION_FIELDS) {
    if (typeof input.fields[key] !== 'string' || input.fields[key].length > 10000) throw new Error('各項目は10,000文字以内で入力してください');
    fields[key] = input.fields[key];
  }
  return { expectedRevision: input.expectedRevision!, requestId: input.requestId, fields };
}

/** Keep the submitted snapshot separate from ongoing typing and retain ambiguous requests for retry. */
export class ReflectionEditor {
  fields: ReflectionFields;
  savedFields: ReflectionFields;
  revision: number;
  pending: ReflectionWrite | null = null;
  constructor(current: ReflectionRevision | null) {
    this.fields = { ...(current?.fields ?? EMPTY_REFLECTION) };
    this.savedFields = { ...this.fields };
    this.revision = current?.revision ?? 0;
  }
  get dirty(): boolean { return !sameReflection(this.fields, this.savedFields); }
  begin(requestId: string): ReflectionWrite {
    if (!this.pending) this.pending = { fields: { ...this.fields }, expectedRevision: this.revision, requestId };
    return this.pending;
  }
  acknowledge(saved: ReflectionRevision): void {
    if (!this.pending || saved.requestId !== this.pending.requestId || !sameReflection(saved.fields, this.pending.fields)
      || saved.revision !== this.pending.expectedRevision + 1) {
      throw new Error('保存内容を確認できませんでした。文章を保持しています。再保存してください');
    }
    this.savedFields = { ...saved.fields };
    this.revision = saved.revision;
    this.pending = null;
  }
}
