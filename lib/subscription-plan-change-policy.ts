export const PLAN_CHANGE_INITIAL_AMOUNT = 0;

export function canActivatePendingPlanChange(
  effectiveAt: Date | null,
  now: Date = new Date(),
): boolean {
  return effectiveAt !== null && effectiveAt.getTime() <= now.getTime();
}
