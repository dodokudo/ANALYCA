'use client';

import { useState } from 'react';
import LegacyReportReflection from './report-reflection-legacy';
import StructuredReportReflection from './report-reflection-structured';
import type { ReportRewrite } from '@/lib/report-rewrite';

interface ReportReflectionProps {
  userId: string;
  month: string;
  onDirtyChange?: (dirty: boolean) => void;
  onPreview: (report: ReportRewrite) => void;
}

export default function ReportReflection({ userId, month, onDirtyChange, onPreview }: ReportReflectionProps) {
  const [format, setFormat] = useState<'legacy' | 'structured'>('legacy');
  return <section className="ui-card p-4 md:p-6" aria-label="今月の振り返り">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">今月の振り返り</h3>
      <div className="flex rounded-lg bg-gray-100 p-1" role="group" aria-label="レポートの形式">
        {([['legacy', '旧式'], ['structured', '新式']] as const).map(([value, label]) => <button
          key={value} type="button" aria-pressed={format === value} aria-controls={`reflection-${value}-${month}`}
          onClick={() => setFormat(value)}
          className={`rounded-md px-4 py-2 text-sm font-medium ${format === value ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          {label}
        </button>)}
      </div>
    </div>
    <div id={`reflection-legacy-${month}`} hidden={format !== 'legacy'}>
      <LegacyReportReflection userId={userId} month={month} />
    </div>
    <div id={`reflection-structured-${month}`} hidden={format !== 'structured'}>
      <StructuredReportReflection userId={userId} month={month} onDirtyChange={onDirtyChange} onPreview={onPreview} />
    </div>
  </section>;
}
