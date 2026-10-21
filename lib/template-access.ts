// Explicitly selected dashboards; billing status alone does not grant this tab.
const TEMPLATE_USER_IDS = new Set([
  '10012809578833342', // @kudooo_ai
  '26175083318785401', // @asano2739
  '26246188431711672', // @atrecess_academy
  'd2ad29b7-24c2-45ea-9955-ff283d2e5430', // @dr_sara_yubishaburi
  '2497734a-d418-472c-b8a2-e8bc6f27eede', // @hanarabi.mama24
  '178ce52d-45f7-46c6-88cd-1918d07a82a3', // @keiko_detox
  '27076125818724783', // @saorin_buppan
  '5713887c-aaf0-4801-9b25-41bbb10999d2', // @mitsuyo_5
]);

export function isTemplateAllowed(userId: unknown): userId is string {
  return typeof userId === 'string' && TEMPLATE_USER_IDS.has(userId);
}
