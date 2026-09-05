/**
 * The research feature is scoped to a single dashboard while it is being built out.
 * Mirrors the pattern used for the YOKO-only content drafts endpoints.
 */
export const RESEARCH_ALLOWED_USER_IDS = ['27016191458061252'];

export function isResearchAllowed(userId: unknown): userId is string {
  return typeof userId === 'string' && RESEARCH_ALLOWED_USER_IDS.includes(userId);
}
