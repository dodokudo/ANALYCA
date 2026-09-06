/**
 * The research feature is scoped to specific dashboards while it is being built out.
 * Mirrors the pattern used for the YOKO-only content drafts endpoints.
 */
export const RESEARCH_ALLOWED_USER_IDS = [
  '10012809578833342', // @kudooo_ai  - main account
  '27016191458061252', // @kudooo_aii - tester account
];

export function isResearchAllowed(userId: unknown): userId is string {
  return typeof userId === 'string' && RESEARCH_ALLOWED_USER_IDS.includes(userId);
}
