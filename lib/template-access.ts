// Initial rollout: show the library only on Kudo's main dashboard.
const TEMPLATE_USER_IDS = new Set(['10012809578833342']);

export function isTemplateAllowed(userId: unknown): userId is string {
  return typeof userId === 'string' && TEMPLATE_USER_IDS.has(userId);
}
