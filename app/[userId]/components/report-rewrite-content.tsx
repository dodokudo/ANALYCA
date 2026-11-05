'use client';

import type { ReactNode } from 'react';
import type { MonthlyClientReport, ReportRewrite } from '@/lib/report-rewrite';

export const reportButton = 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40';
const initiatives = [ ['action', '実施したこと'], ['purpose', '狙い'], ['result', '結果・根拠'], ['judgment', '判断'] ] as const;
const findings = [ ['positive', '良かった点'], ['problem', '改善が必要な点'], ['cause', '原因についての考え'] ] as const;
const plans = [ ['action', '来月やること'], ['reason', 'そうする理由'], ['check', '何を見て効果を確認するか'] ] as const;

export function monthlyReport(report: ReportRewrite): MonthlyClientReport {
  return report.monthly ?? {
    evaluation: report.narrative?.summary ?? report.summary,
    initiatives: report.activities.map(row => ({ action: row.task, purpose: row.purpose, result: row.result, judgment: [row.decision, row.nextAction].filter(Boolean).join('：') })),
    findings: { positive: '', problem: report.issue, cause: '' },
    plans: report.plans.map(row => ({ action: [row.task, row.details].filter(Boolean).join('\n'), reason: '', check: '' })),
    requests: '',
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title} className="space-y-4">
    <h4 className="border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">{title}</h4>{children}
  </section>;
}
function Value({ children }: { children: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">{children}</p>;
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-gray-800">{label}
    <textarea aria-label={label} value={value} maxLength={4000} rows={3} onChange={event => onChange(event.target.value)}
      className="mt-2 block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-3 font-normal leading-7 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
  </label>;
}

export function ReportRewriteForm({ report, onChange }: { report: ReportRewrite; onChange: (report: ReportRewrite) => void }) {
  const monthly = monthlyReport(report);
  const change = (value: Partial<MonthlyClientReport>) => onChange({ ...report, monthly: { ...monthly, ...value } });
  return <div className="space-y-8">
    <Section title="1．今月の成果と評価">
      <p className="text-sm text-gray-500">数字の一覧は上の表を使います。今月どうだったかを3〜5行でまとめてください。</p>
      <TextField label="今月の成果と評価" value={monthly.evaluation} onChange={evaluation => change({ evaluation })} />
    </Section>
    <Section title="2．今月行ったことと、その結果">
      <p className="text-sm text-gray-500">今月試したこと・変えたこと・注力したことを、取り組みごとに書きます。</p>
      {monthly.initiatives.map((row, index) => <div key={index} className="space-y-4 rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between"><h5 className="font-semibold">取り組み {index + 1}</h5>
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => {
            if (Object.values(row).some(Boolean) && !window.confirm('この取り組みを新式から削除しますか？ 旧式の原文は変わりません。')) return;
            change({ initiatives: monthly.initiatives.filter((_, i) => i !== index) });
          }}>削除</button></div>
        {initiatives.map(([key, label]) => <TextField key={key} label={label} value={row[key]} onChange={value => change({ initiatives: monthly.initiatives.map((item, i) => i === index ? { ...item, [key]: value } : item) })} />)}
      </div>)}
      <button type="button" className={reportButton} disabled={monthly.initiatives.length >= 10} onClick={() => change({ initiatives: [...monthly.initiatives, { action: '', purpose: '', result: '', judgment: '' }] })}>＋ 取り組みを追加</button>
    </Section>
    <Section title="3．分かったこと・残った課題">
      {findings.map(([key, label]) => <TextField key={key} label={label} value={monthly.findings[key]} onChange={value => change({ findings: { ...monthly.findings, [key]: value } })} />)}
    </Section>
    <Section title="4．来月の運用方針">
      {monthly.plans.map((row, index) => <div key={index} className="space-y-4 rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between"><h5 className="font-semibold">方針 {index + 1}</h5>
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => {
            if (Object.values(row).some(Boolean) && !window.confirm('この方針を新式から削除しますか？ 旧式の原文は変わりません。')) return;
            change({ plans: monthly.plans.filter((_, i) => i !== index) });
          }}>削除</button></div>
        {plans.map(([key, label]) => <TextField key={key} label={label} value={row[key]} onChange={value => change({ plans: monthly.plans.map((item, i) => i === index ? { ...item, [key]: value } : item) })} />)}
      </div>)}
      <button type="button" className={reportButton} disabled={monthly.plans.length >= 3} onClick={() => change({ plans: [...monthly.plans, { action: '', reason: '', check: '' }] })}>＋ 方針を追加</button>
    </Section>
    <Section title="5．クライアント様への確認・お願い（ある場合だけ）">
      <TextField label="確認・お願い（なければ空欄）" value={monthly.requests} onChange={requests => change({ requests })} />
    </Section>
  </div>;
}

export function ReportRewriteView({ report }: { report: ReportRewrite }) {
  const monthly = monthlyReport(report);
  return <div className="space-y-8">
    <Section title="1．今月の成果と評価"><Value>{monthly.evaluation}</Value></Section>
    <Section title="2．今月行ったことと、その結果">
      {monthly.initiatives.map((row, index) => <div key={index} className="space-y-4 rounded-lg bg-gray-50 p-4">
        <h5 className="whitespace-pre-wrap break-words font-semibold text-gray-900">{row.action}</h5>
        <dl className="space-y-3">{initiatives.slice(1).map(([key, label]) => <div key={key}><dt className="mb-1 text-xs font-semibold text-gray-500">{label}</dt><dd><Value>{row[key]}</Value></dd></div>)}</dl>
      </div>)}
    </Section>
    <Section title="3．分かったこと・残った課題"><dl className="space-y-4">{findings.map(([key, label]) => <div key={key}><dt className="mb-1 text-sm font-semibold text-gray-900">{label}</dt><dd><Value>{monthly.findings[key]}</Value></dd></div>)}</dl></Section>
    <Section title="4．来月の運用方針">
      <div className="overflow-x-auto rounded-lg border border-gray-200"><table className="w-full min-w-[640px] table-fixed text-left text-sm">
        <thead className="bg-gray-50"><tr>{plans.map(([key, label]) => <th key={key} className="p-3 font-medium text-gray-700">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200">{monthly.plans.map((row, index) => <tr key={index}>{plans.map(([key]) => <td key={key} className="p-3 align-top"><Value>{row[key]}</Value></td>)}</tr>)}</tbody>
      </table></div>
    </Section>
    {monthly.requests.trim() && <Section title="5．クライアント様への確認・お願い"><Value>{monthly.requests}</Value></Section>}
  </div>;
}
