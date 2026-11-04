export interface ReportField {
  key: string;
  label: string;
  hint?: string;
  options?: readonly string[];
}

export const METRIC_FIELDS = [
  { key: 'kind', label: '種類', options: ['成果', '作業量'] },
  { key: 'name', label: '指標名', hint: '例：LINE登録数' },
  { key: 'previous', label: '前月の実績', hint: '単位も記入。不明なら「未確認」' },
  { key: 'actual', label: '今月の実績' },
  { key: 'target', label: '今月の目標', hint: '目標がなければ「未設定」' },
  { key: 'assessment', label: '結果の説明', hint: '目標・前月と比べてどうだったか' },
] as const satisfies readonly ReportField[];
export const ACTIVITY_FIELDS = [
  { key: 'task', label: '実施したこと', hint: '例：過去投稿の再投稿' },
  { key: 'purpose', label: '何のために行ったか' },
  { key: 'period', label: '実施日・期間' },
  { key: 'quantity', label: '実施した件数・本数' },
  { key: 'changes', label: '具体的に変更した箇所', hint: '変更がなければ「変更なし」。予定ではなく実施済みの内容' },
  { key: 'result', label: '結果', hint: '数字と単位を記入。未確認ならその旨を記入' },
  { key: 'evidence', label: '確認に使った資料・集計時点', hint: '参照したデータ、投稿URL、確認日など' },
  { key: 'comparison', label: '比較条件', hint: '比較対象・期間・公開後の日数。未確認の条件も明記' },
  { key: 'learning', label: '分かったこと', hint: '事実と仮説を区別して記入' },
  { key: 'unknown', label: 'まだ分からないこと', hint: 'なければ「なし」' },
  { key: 'decision', label: '次の判断', options: ['継続', '変更', '停止', '判断保留'] },
  { key: 'nextAction', label: '次にどう対応するか' },
] as const satisfies readonly ReportField[];
export const POST_FIELDS = [
  { key: 'signal', label: '反応', options: ['良かった', '弱かった', '判断保留'] },
  { key: 'content', label: '投稿の内容' },
  { key: 'url', label: '投稿URL', hint: 'https:// で始まる実際の投稿URL' },
  { key: 'metric', label: '反応を示す数字・集計時点' },
  { key: 'reason', label: 'この結果をどう考えるか', hint: '推測の場合は「仮説」と記入' },
  { key: 'nextAction', label: '次の投稿に取り入れること' },
] as const satisfies readonly ReportField[];
export const FUNNEL_FIELDS = [
  { key: 'name', label: '段階', hint: '例：プロフィール訪問、LINE登録、問い合わせ' },
  { key: 'value', label: '件数・人数', hint: '取れない数字は「未計測」。0とは区別' },
  { key: 'scope', label: '集計期間・流入経路・参照元', hint: '同じ対象を数えているか確認できるように記入' },
] as const satisfies readonly ReportField[];
export const PLAN_FIELDS = [
  { key: 'task', label: '変更・継続すること' },
  { key: 'details', label: '具体的に行う作業' },
  { key: 'owner', label: '担当者' },
  { key: 'due', label: '期限・実施日' },
  { key: 'quantity', label: '件数・本数' },
  { key: 'success', label: '成功を判断する数字・条件' },
] as const satisfies readonly ReportField[];
export const REQUEST_FIELDS = [
  { key: 'request', label: 'お願い・確認したいこと' },
  { key: 'due', label: '回答・提供をお願いしたい期限' },
] as const satisfies readonly ReportField[];

type Row<T extends readonly ReportField[]> = Record<T[number]['key'], string>;
export interface ReportRewrite {
  summary: string;
  issue: string;
  direction: string;
  objective: string;
  metrics: Row<typeof METRIC_FIELDS>[];
  activities: Row<typeof ACTIVITY_FIELDS>[];
  posts: Row<typeof POST_FIELDS>[];
  postsNote: string;
  funnel: Row<typeof FUNNEL_FIELDS>[];
  funnelNote: string;
  plans: Row<typeof PLAN_FIELDS>[];
  requests: Row<typeof REQUEST_FIELDS>[];
  requestsNote: string;
}
export type RewriteStatus = 'draft' | 'submitted';
export interface RewriteRevision {
  revision: number;
  requestId: string;
  status: RewriteStatus;
  report: ReportRewrite;
  savedAt: string;
}
export interface RewriteWrite {
  expectedRevision: number;
  requestId: string;
  status: RewriteStatus;
  report: ReportRewrite;
}
export interface RewriteState {
  current: RewriteRevision | null;
  submitted: RewriteRevision | null;
}

export function emptyRow<T extends readonly ReportField[]>(fields: T): Row<T> {
  return Object.fromEntries(fields.map(field => [field.key, ''])) as Row<T>;
}
export function emptyRewrite(): ReportRewrite {
  return {
    summary: '', issue: '', direction: '', objective: '', metrics: [], activities: [],
    posts: [], postsNote: '', funnel: [], funnelNote: '', plans: [], requests: [], requestsNote: '',
  };
}

const GROUPS = [
  { key: 'metrics', title: '② 目標と結果', fields: METRIC_FIELDS, max: 12 },
  { key: 'activities', title: '③④ 実施内容と効果', fields: ACTIVITY_FIELDS, max: 30 },
  { key: 'posts', title: '⑤ 投稿の反応', fields: POST_FIELDS, max: 8 },
  { key: 'funnel', title: '⑥ 成果までの流れ', fields: FUNNEL_FIELDS, max: 12 },
  { key: 'plans', title: '⑦ 来月の計画', fields: PLAN_FIELDS, max: 3 },
  { key: 'requests', title: '⑧ お願い・確認事項', fields: REQUEST_FIELDS, max: 10 },
] as const;
export const REWRITE_GROUPS = GROUPS;

/** Missing facts stay explicitly unconfirmed; drafts can be saved before completion. */
export function submissionIssues(report: ReportRewrite): string[] {
  const issues: string[] = [];
  for (const [key, label] of [
    ['summary', '① 今月の結果'], ['issue', '① 課題・未確認のこと'], ['direction', '① 次の対応'],
    ['objective', '② 運用の目的'], ['funnelNote', '⑥ 改善が必要な箇所とその理由'],
  ] as const) if (!report[key].trim()) issues.push(`${label}を記入してください`);
  for (const group of GROUPS) {
    const rows = report[group.key] as Record<string, string>[];
    if (!rows.length && !['posts', 'requests'].includes(group.key)) issues.push(`${group.title}を1件以上記入してください`);
    rows.forEach((row, index) => group.fields.forEach(field => {
      if (!row[field.key].trim()) issues.push(`${group.title} ${index + 1}件目「${field.label}」を記入してください`);
    }));
  }
  if (!report.posts.length && !report.postsNote.trim()) issues.push('⑤ 投稿を追加するか、紹介できない理由を記入してください');
  if (!report.requests.length && !report.requestsNote.trim()) issues.push('⑧ 依頼がない場合も「今月のお願いはありません」と記入してください');
  return issues;
}

export function parseRewriteWrite(value: unknown): RewriteWrite {
  const input = value as Partial<RewriteWrite> | null;
  if (!input || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision! < 0
    || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)
    || !['draft', 'submitted'].includes(input.status!) || !input.report || typeof input.report !== 'object') {
    throw new Error('保存する内容を確認してください');
  }
  const report = emptyRewrite();
  const string = (value: unknown, label: string, max = 4000): string => {
    if (typeof value !== 'string' || value.length > max) throw new Error(`${label}は${max.toLocaleString()}文字以内で入力してください`);
    return value;
  };
  for (const key of ['summary', 'issue', 'direction', 'objective', 'postsNote', 'funnelNote', 'requestsNote'] as const) {
    report[key] = string(input.report[key], key, ['summary', 'issue', 'direction'].includes(key) ? 600 : 4000);
  }
  for (const group of GROUPS) {
    const rows = input.report[group.key];
    if (!Array.isArray(rows) || rows.length > group.max) throw new Error(`${group.title}は${group.max}件以内で入力してください`);
    const parsed = rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${group.title}の入力を確認してください`);
      return Object.fromEntries((group.fields as readonly ReportField[]).map(field => {
        const text = string(row[field.key], field.label);
        if (text && field.options && !field.options.includes(text)) throw new Error(`${field.label}を選択してください`);
        if (field.key === 'url' && text) {
          let valid = false;
          try { valid = ['https:', 'http:'].includes(new URL(text).protocol); } catch { /* Invalid URL */ }
          if (!valid) throw new Error('投稿URLは https:// または http:// で始まるURLを入力してください');
        }
        return [field.key, text];
      }));
    });
    // Each group is normalized against its own field definition above.
    (report[group.key] as Record<string, string>[]) = parsed;
  }
  if (input.status === 'submitted') {
    const issues = submissionIssues(report);
    if (issues.length) throw new Error(issues[0]);
  }
  return { expectedRevision: input.expectedRevision!, requestId: input.requestId, status: input.status!, report };
}

/** Retain the exact request across network failures; never acknowledge mismatched responses. */
export class RewriteEditor {
  report: ReportRewrite;
  savedReport: ReportRewrite;
  revision: number;
  pending: RewriteWrite | null = null;
  constructor(current: RewriteRevision | null) {
    this.report = structuredClone(current?.report ?? emptyRewrite());
    this.savedReport = structuredClone(this.report);
    this.revision = current?.revision ?? 0;
  }
  get dirty(): boolean { return JSON.stringify(this.report) !== JSON.stringify(this.savedReport); }
  begin(status: RewriteStatus, requestId: string): RewriteWrite {
    if (!this.pending) this.pending = { report: structuredClone(this.report), status, requestId, expectedRevision: this.revision };
    return this.pending;
  }
  acknowledge(saved: RewriteRevision): void {
    if (!this.pending || saved.requestId !== this.pending.requestId || saved.status !== this.pending.status
      || saved.revision !== this.pending.expectedRevision + 1
      || JSON.stringify(saved.report) !== JSON.stringify(this.pending.report)) {
      throw new Error('保存内容を確認できませんでした。再試行してください');
    }
    this.savedReport = structuredClone(saved.report);
    this.revision = saved.revision;
    this.pending = null;
  }
}
