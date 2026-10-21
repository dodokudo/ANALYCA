export const PLAN_PRICES = {
  'ノーマル': { bankLumpSum: 500_000, other: 550_000 },
  'スタンダード': { bankLumpSum: 950_000, other: 1_000_000 },
  'プレミアム': { bankLumpSum: 1_900_000, other: 2_000_000 },
} as const;
export type BasePlan = keyof typeof PLAN_PRICES;
export function contractPrice(plan: BasePlan, bankLumpSum: boolean): number {
  return PLAN_PRICES[plan][bankLumpSum ? 'bankLumpSum' : 'other'];
}
