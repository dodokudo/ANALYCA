import type { PlanBillingCycle } from './univapay/plans';

const DAY_MS = 24 * 60 * 60 * 1000;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface ProratedUpgradeQuote {
  proratedAmount: number;
  fullDifference: number;
  periodStart: string;
  periodEnd: string;
  remainingDays: number;
  totalDays: number;
}

function formatCalendarDate(value: CalendarDate): string {
  return [
    String(value.year).padStart(4, '0'),
    String(value.month).padStart(2, '0'),
    String(value.day).padStart(2, '0'),
  ].join('-');
}

function parseDateKey(value: string): CalendarDate {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid billing date: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toUtcTime(value: CalendarDate): number {
  return Date.UTC(value.year, value.month - 1, value.day);
}

function daysBetween(start: CalendarDate, end: CalendarDate): number {
  return Math.round((toUtcTime(end) - toUtcTime(start)) / DAY_MS);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function previousBillingDate(end: CalendarDate, billingCycle: PlanBillingCycle): CalendarDate {
  const base = new Date(Date.UTC(end.year, end.month - 1, 1));
  if (billingCycle === 'yearly') {
    base.setUTCFullYear(base.getUTCFullYear() - 1);
  } else {
    base.setUTCMonth(base.getUTCMonth() - 1);
  }
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  return { year, month, day: Math.min(end.day, daysInMonth(year, month)) };
}

export function getJstDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getBillingDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid billing date: ${value}`);
  return getJstDateKey(date);
}

export function calculateProratedUpgradeQuote(input: {
  currentPrice: number;
  targetPrice: number;
  billingCycle: PlanBillingCycle;
  nextBillingDate: string;
  now?: Date;
}): ProratedUpgradeQuote {
  const fullDifference = input.targetPrice - input.currentPrice;
  if (fullDifference <= 0) throw new Error('Target plan must be more expensive');

  const periodEnd = parseDateKey(getBillingDateKey(input.nextBillingDate));
  const periodStart = previousBillingDate(periodEnd, input.billingCycle);
  const today = parseDateKey(getJstDateKey(input.now || new Date()));
  const totalDays = daysBetween(periodStart, periodEnd);
  const remainingDays = Math.min(totalDays, Math.max(0, daysBetween(today, periodEnd)));
  if (totalDays <= 0 || remainingDays <= 0) {
    throw new Error('次回更新日を過ぎているため、日割り金額を計算できません');
  }

  return {
    proratedAmount: Math.max(1, Math.round(fullDifference * remainingDays / totalDays)),
    fullDifference,
    periodStart: formatCalendarDate(periodStart),
    periodEnd: formatCalendarDate(periodEnd),
    remainingDays,
    totalDays,
  };
}
