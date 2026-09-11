export type StyleCandidate = {
  mainText: string;
  comment1: string;
  comment2: string;
  voiceEvidenceIds: string[];
};

export type StyleRepairJob = {
  id: string;
  candidate: StyleCandidate;
  issues: string[];
};

export type StyleAudit = {
  contentPreserved: boolean;
  styleMatches: boolean;
  evidenceGrounded: boolean;
  issues: string[];
};

export type StyleRepairResult = {
  id: string;
  candidate: StyleCandidate | null;
  issues: string[];
  passed: boolean;
};

export const STYLE_CONTENT_RULES = [
  '内容の唯一の正本はapprovedです。本人実文voiceEvidenceは文体だけの参考です。本人実文の事実・主張・自己開示を追加したり、そこに合わせて採用内容を戻したりしないでください。',
  '文体ガイドに元台本の内容保持と書かれていても、この工程ではapprovedとの比較を優先します。',
  '意味・事実・数値・中心主張・結論・CTAを保持します。同じ意味の簡潔な言い換え、重複表現の整理、改行・句読点・語尾の変更は許容します。',
].join('\n');

export const STYLE_LENGTH_RULE = 'コメント1・2は各370〜500文字、狙いは420〜460文字です。改行・空白も1文字に数えます。改行を増やす場合は、意味を保った簡潔な言い換えで文字数の余裕を確保してください。文章を途中で切ったり、結論・事実を消して収めたりしないでください。';

/** Pure orchestration: only failing drafts are repaired, at most twice. No stored text is changed here. */
export async function runYokoStyleRepair(input: {
  jobs: StyleRepairJob[];
  transform: (jobs: StyleRepairJob[], attempt: number) => Promise<Map<string, StyleCandidate>>;
  validate: (candidate: StyleCandidate, id: string) => string[];
  audit: (jobs: StyleRepairJob[]) => Promise<Map<string, StyleAudit>>;
}): Promise<StyleRepairResult[]> {
  const results = new Map<string, StyleRepairResult>(input.jobs.map(job => [job.id, {
    id: job.id, candidate: null, issues: job.issues, passed: false,
  }]));
  let pending = input.jobs;
  for (let attempt = 0; pending.length && attempt < 3; attempt += 1) {
    let transformed: Map<string, StyleCandidate>;
    try {
      transformed = await input.transform(pending, attempt);
    } catch (error) {
      console.error('[yoko/style] transform failed', error);
      for (const job of pending) {
        const result = results.get(job.id)!;
        result.issues = [...result.issues, 'AI処理を完了できませんでした。もう一度AIで再調整してください。'];
      }
      break;
    }
    const auditJobs: StyleRepairJob[] = [];
    const retryJobs: StyleRepairJob[] = [];
    for (const job of pending) {
      const candidate = transformed.get(job.id);
      const issues = candidate ? input.validate(candidate, job.id) : ['AIの変換結果がありません'];
      results.set(job.id, { id: job.id, candidate: candidate || results.get(job.id)!.candidate, issues, passed: false });
      const next = { id: job.id, candidate: candidate || job.candidate, issues };
      if (issues.length) retryJobs.push(next);
      else auditJobs.push(next);
    }
    if (auditJobs.length) {
      let audits: Map<string, StyleAudit>;
      try {
        audits = await input.audit(auditJobs);
      } catch (error) {
        console.error('[yoko/style] audit failed', error);
        for (const job of auditJobs) {
          results.get(job.id)!.issues = ['AI監査を完了できませんでした。再監査またはAIで再調整してください。'];
        }
        // Do not rewrite candidates merely because the audit service is unavailable.
        break;
      }
      for (const job of auditJobs) {
        const audit = audits.get(job.id);
        const passed = Boolean(audit?.contentPreserved && audit.styleMatches && audit.evidenceGrounded);
        const issues = passed ? [] : audit?.issues?.length ? audit.issues : ['本人文体の監査に合格しませんでした'];
        results.set(job.id, { id: job.id, candidate: job.candidate, issues, passed });
        if (!passed) retryJobs.push({ ...job, issues });
      }
    }
    pending = retryJobs;
  }
  return input.jobs.map(job => results.get(job.id)!);
}
