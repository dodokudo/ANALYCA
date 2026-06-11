export type Coupon = {
  code: string;
  trialDays: number;
  label: string;
};

const COUPONS: Record<string, Coupon> = {
  ANALYCA30: {
    code: 'ANALYCA30',
    trialDays: 30,
    label: '初回30日無料',
  },
};

export function normalizeCouponCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function getCoupon(value: unknown): Coupon | null {
  const code = normalizeCouponCode(value);
  return code ? COUPONS[code] || null : null;
}

export function getTrialDays(value: unknown, defaultDays: number): number {
  return getCoupon(value)?.trialDays || defaultDays;
}
