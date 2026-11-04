'use client';

import type { ReactNode } from 'react';
import {
  ACTIVITY_FIELDS, emptyRow, FUNNEL_FIELDS, METRIC_FIELDS, PLAN_FIELDS, POST_FIELDS,
  REQUEST_FIELDS, type ReportField, type ReportRewrite,
} from '@/lib/report-rewrite';

export const reportButton = 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40';

function Section({ number, title, hint, children }: { number: number; title: string; hint?: string; children: ReactNode }) {
  return <section data-report-section={number} aria-label={title} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
    <div><h4 className="flex items-start gap-3 text-base font-semibold text-gray-900">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs text-violet-700">{number}</span>{title}
    </h4>{hint && <p className="mt-2 text-sm leading-6 text-gray-500">{hint}</p>}</div>
    {children}
  </section>;
}

function TextField({ label, value, hint, max = 4000, onChange }: {
  label: string; value: string; hint?: string; max?: number; onChange: (value: string) => void;
}) {
  return <label className="block min-w-0 text-sm font-medium text-gray-800">{label}
    {hint && <span className="mt-1 block text-xs font-normal leading-5 text-gray-500">{hint}</span>}
    <textarea aria-label={label} value={value} maxLength={max} rows={2} onChange={event => onChange(event.target.value)}
      className="mt-2 block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal leading-6 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
  </label>;
}

function RowFields({ fields, row, onChange }: {
  fields: readonly ReportField[]; row: Record<string, string>; onChange: (row: Record<string, string>) => void;
}) {
  return <div className="grid gap-4 md:grid-cols-2">{fields.map(field => field.options
    ? <label key={field.key} className="block text-sm font-medium text-gray-800">{field.label}
      <select aria-label={field.label} value={row[field.key]} onChange={event => onChange({ ...row, [field.key]: event.target.value })}
        className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm font-normal">
        <option value="">選択してください</option>{field.options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
    : <TextField key={field.key} label={field.label} hint={field.hint} value={row[field.key]}
      onChange={value => onChange({ ...row, [field.key]: value })} />)}</div>;
}

function RowEditor<T extends Record<string, string>>({ fields, rows, noun, max, onChange }: {
  fields: readonly ReportField[]; rows: T[]; noun: string; max: number; onChange: (rows: T[]) => void;
}) {
  return <div className="space-y-4">{rows.map((row, index) => <div key={index} className="space-y-4 rounded-lg bg-gray-50 p-4">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{noun} {index + 1}</p>
      <button type="button" className="text-xs text-gray-500 underline" onClick={() => {
        if (Object.values(row).some(value => value.trim()) && !window.confirm(`書き直し版の${noun} ${index + 1}を削除しますか？ 当初の原文は変わりません。`)) return;
        onChange(rows.filter((_, i) => i !== index));
      }}>{noun} {index + 1}を削除</button></div>
    <RowFields fields={fields} row={row} onChange={value => onChange(rows.map((item, i) => i === index ? value as T : item))} />
  </div>)}<button type="button" className={reportButton} disabled={rows.length >= max}
    onClick={() => onChange([...rows, emptyRow(fields) as T])}>＋ {noun}を追加</button>
    <span className="ml-3 text-xs text-gray-500">最大{max}件</span>
  </div>;
}

export function ReportRewriteForm({ report, onChange }: { report: ReportRewrite; onChange: (report: ReportRewrite) => void }) {
  function change<K extends keyof ReportRewrite>(key: K, value: ReportRewrite[K]): void { onChange({ ...report, [key]: value }); }
  return <div className="space-y-5">
    <Section number={1} title="今月の運用は、ひとことで言うと？" hint="各欄は短い1〜2文で。詳しい内容は下の項目に記入してください。">
      <TextField label="今月の結果" value={report.summary} max={600} onChange={value => change('summary', value)} />
      <TextField label="課題・未確認のこと" value={report.issue} max={600} onChange={value => change('issue', value)} />
      <TextField label="次の対応" value={report.direction} max={600} onChange={value => change('direction', value)} />
    </Section>
    <Section number={2} title="目標に対して、どれくらい進んだ？" hint="成果と作業量を分けて記入。目標がなければ「未設定」、確認できない数字は「未確認」と記入します。">
      <TextField label="運用の目的" hint="この運用で、クライアントの何を増やす・改善するか" value={report.objective} onChange={value => change('objective', value)} />
      <RowEditor fields={METRIC_FIELDS} rows={report.metrics} noun="指標" max={12} onChange={value => change('metrics', value)} />
    </Section>
    <Section number={3} title="今月、実際に何をした？" hint="実施済みの作業を1件ずつ追加してください。④に同じ作業の結果を記入します。">
      <div className="space-y-4">{report.activities.map((row, index) => <div key={index} className="space-y-4 rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">作業 {index + 1}</p>
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => {
            if (Object.values(row).some(value => value.trim()) && !window.confirm(`書き直し版の作業 ${index + 1}と、その結果を削除しますか？ 当初の原文は変わりません。`)) return;
            change('activities', report.activities.filter((_, i) => i !== index));
          }}>作業 {index + 1}を削除</button></div>
        <RowFields fields={ACTIVITY_FIELDS.slice(0, 5)} row={row} onChange={value => change('activities', report.activities.map((item, i) => i === index ? { ...item, ...value } : item))} />
      </div>)}<button type="button" className={reportButton} disabled={report.activities.length >= 30}
        onClick={() => change('activities', [...report.activities, emptyRow(ACTIVITY_FIELDS)])}>＋ 作業を追加</button></div>
    </Section>
    <Section number={4} title="やったことは、効果があった？" hint="③の作業ごとに結果と判断を書いてください。事実・仮説・未確認を区別します。">
      {!report.activities.length && <p className="text-sm text-gray-500">③で作業を追加すると、その結果の記入欄が表示されます。</p>}
      {report.activities.map((row, index) => <div key={index} className="space-y-4 rounded-lg bg-gray-50 p-4">
        <h5 className="break-words text-sm font-semibold">作業 {index + 1}：{row.task || '作業名は③に記入してください'}</h5>
        <RowFields fields={ACTIVITY_FIELDS.slice(5)} row={row} onChange={value => change('activities', report.activities.map((item, i) => i === index ? { ...item, ...value } : item))} />
      </div>)}
    </Section>
    <Section number={5} title="どんな投稿に反応があった？" hint="実際の投稿と数字を添えて、次の制作に活かす点を記入してください。">
      <RowEditor fields={POST_FIELDS} rows={report.posts} noun="投稿" max={8} onChange={value => change('posts', value)} />
      <TextField label="補足・投稿を紹介できない理由" hint="投稿がない場合は理由を記入してください" value={report.postsNote} onChange={value => change('postsNote', value)} />
    </Section>
    <Section number={6} title="LINE登録や問い合わせにつながった？" hint="閲覧、プロフィール訪問、リンククリック、LINE登録などを順に追加。期間や流入経路が異なる数字は、同じ人の移動として扱わないでください。">
      <RowEditor fields={FUNNEL_FIELDS} rows={report.funnel} noun="段階" max={12} onChange={value => change('funnel', value)} />
      <TextField label="改善が必要な箇所とその理由" hint="判断できない場合は、何を確認する必要があるか" value={report.funnelNote} onChange={value => change('funnelNote', value)} />
    </Section>
    <Section number={7} title="来月は、具体的に何を変える？" hint="優先する施策を3つまで。誰が、いつまでに、何をするかを明記してください。">
      <RowEditor fields={PLAN_FIELDS} rows={report.plans} noun="計画" max={3} onChange={value => change('plans', value)} />
    </Section>
    <Section number={8} title="クライアントにお願いしたいことは？">
      <RowEditor fields={REQUEST_FIELDS} rows={report.requests} noun="依頼" max={10} onChange={value => change('requests', value)} />
      <TextField label="補足・依頼がない場合" hint="依頼がなければ「今月のお願いはありません」と記入してください" value={report.requestsNote} onChange={value => change('requestsNote', value)} />
    </Section>
  </div>;
}

function Value({ children }: { children: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">{children || '未記入'}</p>;
}
function Facts({ fields, row }: { fields: readonly ReportField[]; row: Record<string, string> }) {
  return <dl className="grid gap-4 md:grid-cols-2">{fields.map(field => <div key={field.key} className="min-w-0">
    <dt className="mb-1 text-xs font-medium text-gray-500">{field.label}</dt><dd><Value>{row[field.key]}</Value></dd>
  </div>)}</dl>;
}

export function ReportRewriteView({ report }: { report: ReportRewrite }) {
  return <div className="space-y-5">
    <Section number={1} title="今月の運用は、ひとことで言うと？">
      <div className="grid gap-3 lg:grid-cols-3">{[
        ['今月の結果', report.summary], ['課題・未確認のこと', report.issue], ['次の対応', report.direction],
      ].map(([label, value]) => <div key={label} className="rounded-lg bg-violet-50 p-4"><p className="mb-2 text-xs font-semibold text-violet-800">{label}</p><Value>{value}</Value></div>)}</div>
    </Section>
    <Section number={2} title="目標に対して、どれくらい進んだ？">
      <Value>{report.objective}</Value>
      {['成果', '作業量', ''].map(kind => {
        const metrics = report.metrics.filter(row => row.kind === kind);
        return metrics.length ? <div key={kind} className="space-y-3"><h5 className="text-sm font-semibold">{kind || '種類未選択'}</h5>
          {metrics.map((row, index) => <div key={index} className="rounded-lg border border-gray-200 p-4">
            <h6 className="mb-3 break-words font-semibold">{row.name || '指標名未記入'}</h6>
            <dl className="mb-3 grid grid-cols-3 gap-3">{[['前月', row.previous], ['今月', row.actual], ['目標', row.target]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-semibold">{value || '未記入'}</dd></div>)}</dl>
            <Value>{row.assessment}</Value>
          </div>)}</div> : null;
      })}
    </Section>
    <Section number={3} title="今月、実際に何をした？">
      {report.activities.map((row, index) => <div key={index} className="rounded-lg bg-gray-50 p-4"><h5 className="mb-4 break-words font-semibold">作業 {index + 1}：{row.task || '未記入'}</h5><Facts fields={ACTIVITY_FIELDS.slice(1, 5)} row={row} /></div>)}
    </Section>
    <Section number={4} title="やったことは、効果があった？">
      {report.activities.map((row, index) => <div key={index} className="rounded-lg bg-gray-50 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h5 className="min-w-0 break-words font-semibold">作業 {index + 1}：{row.task || '未記入'}</h5><span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700">{row.decision || '判断未記入'}</span></div>
        <Facts fields={ACTIVITY_FIELDS.slice(5).filter(field => field.key !== 'decision')} row={row} />
      </div>)}
    </Section>
    <Section number={5} title="どんな投稿に反応があった？">
      {report.posts.map((row, index) => <div key={index} className="space-y-3 rounded-lg bg-gray-50 p-4"><p className="text-xs font-semibold text-violet-700">{row.signal || '反応未記入'}</p>
        <Value>{row.content}</Value>{/^https?:\/\//i.test(row.url) && <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-violet-700 underline">実際の投稿を見る ↗</a>}
        <Facts fields={POST_FIELDS.slice(3)} row={row} />
      </div>)}{report.postsNote && <Value>{report.postsNote}</Value>}
    </Section>
    <Section number={6} title="LINE登録や問い合わせにつながった？">
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{report.funnel.map((row, index) => <li key={index} className="min-w-0 rounded-lg bg-gray-50 p-4"><p className="break-words text-xs text-gray-500">{index + 1}. {row.name || '段階未記入'}</p><p className="my-2 whitespace-pre-wrap break-words text-lg font-semibold">{row.value || '未記入'}</p><Value>{row.scope}</Value></li>)}</ol>
      <p className="text-xs text-gray-500">各段階の集計期間・流入経路をご確認ください。数字の差がそのまま離脱人数を示すとは限りません。</p><Value>{report.funnelNote}</Value>
    </Section>
    <Section number={7} title="来月は、具体的に何を変える？">
      {report.plans.map((row, index) => <div key={index} className="rounded-lg bg-gray-50 p-4"><h5 className="mb-4 break-words font-semibold">{index + 1}. {row.task || '計画未記入'}</h5><Facts fields={PLAN_FIELDS.slice(1)} row={row} /></div>)}
    </Section>
    <Section number={8} title="クライアントにお願いしたいことは？">
      {report.requests.map((row, index) => <div key={index} className="rounded-lg bg-amber-50 p-4"><Facts fields={REQUEST_FIELDS} row={row} /></div>)}{report.requestsNote && <Value>{report.requestsNote}</Value>}
    </Section>
  </div>;
}
