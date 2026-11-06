'use client';

import StructuredReportReflection from './report-reflection-structured';
import type { ReportRewrite } from '@/lib/report-rewrite';

interface ReportReflectionProps {
  userId: string;
  month: string;
  onDirtyChange?: (dirty: boolean) => void;
  onPreview: (report: ReportRewrite) => void;
}

export default function ReportReflection({ userId, month, onDirtyChange, onPreview }: ReportReflectionProps) {
  return <section className="ui-card p-4 md:p-6" aria-label="今月の振り返り">
    <div className="mb-5">
      <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">今月の振り返り</h3>
    </div>
    <StructuredReportReflection userId={userId} month={month} onDirtyChange={onDirtyChange} onPreview={onPreview} />
  </section>;
}
