import type { Issue } from './domain';

export async function notifyDocumentOwner(issue: Issue): Promise<void> {
  if (issue.sample || issue.applicationId || issue.ownerNotification !== 'pending') return;
  const token = process.env.COURSE_DOCUMENTS_TOKEN;
  if (!token) throw new Error('Document notification is not configured');
  const response = await fetch('https://guardian-webhook-zdpkrgcsua-an.a.run.app/internal/course-documents/notify', {
    method: 'POST', signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: issue.id, name: issue.name, method: issue.method, amount: issue.amount, paidDate: issue.paidDate, number: issue.number }),
  });
  if (!response.ok || (await response.json()).accepted !== true) throw new Error('Document notification pending');
}
