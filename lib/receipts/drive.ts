import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import { fiscalPeriod, type DocumentKind, type Issue } from './domain';
import { credentials, withLock } from './store';

function driveClient() {
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}
const escapeQuery = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function folders(drive: drive_v3.Drive, parent: string) {
  const all: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const r = await drive.files.list({ q: `'${escapeQuery(parent)}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`, fields: 'nextPageToken,files(id,name)', pageSize: 100, pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true });
    all.push(...(r.data.files || [])); pageToken = r.data.nextPageToken || undefined;
  } while (pageToken);
  return all;
}
async function ensureFolder(drive: drive_v3.Drive, parent: string, name: string, matches: (name: string) => boolean = n => n === name): Promise<string> {
  const found = (await folders(drive, parent)).filter(f => matches(f.name || ''));
  if (found.length > 1) throw new Error('Multiple matching accounting folders; review destination before saving');
  if (found[0]?.id) return found[0].id;
  const r = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }, supportsAllDrives: true, fields: 'id' });
  if (!r.data.id) throw new Error('Drive folder creation failed');
  return r.data.id;
}
export async function ensureMonthFolders(month: string): Promise<{ month: string; receipt: string; invoice: string }> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid month');
  const root = process.env.RECEIPTS_DRIVE_ROOT_ID;
  if (!root) throw new Error('RECEIPTS_DRIVE_ROOT_ID is not configured');
  return withLock('drive-folders', async () => {
    const drive = driveClient();
    let parent = root;
    if (process.env.RECEIPTS_DRIVE_USE_FISCAL_PERIOD === 'true') {
      const start = Number(process.env.RECEIPTS_FISCAL_START_MONTH);
      const year = Number(process.env.RECEIPTS_FISCAL_ANCHOR_YEAR);
      const period = Number(process.env.RECEIPTS_FISCAL_ANCHOR_PERIOD);
      if (!(start >= 1 && start <= 12 && year >= 2000 && period >= 1)) throw new Error('Fiscal period configuration required');
      parent = await ensureFolder(drive, root, fiscalPeriod(month, start, year, period));
    }
    const [year, m] = month.split('-');
    const pattern = new RegExp(`^${year}年0?${Number(m)}月(?:$|[【（(\\s])`);
    const monthId = await ensureFolder(drive, parent, `${year}年${m}月`, name => pattern.test(name));
    const receipt = await ensureFolder(drive, monthId, '領収書');
    const invoice = await ensureFolder(drive, monthId, '請求書');
    return { month: monthId, receipt, invoice };
  });
}
export async function reserveDriveId(): Promise<string> {
  const r = await driveClient().files.generateIds({ count: 1, space: 'drive', type: 'files' });
  if (!r.data.ids?.[0]) throw new Error('Could not reserve a Drive file ID');
  return r.data.ids[0];
}
export async function saveDocumentToDrive(issue: Issue, kind: DocumentKind, folder: string, bytes: Buffer): Promise<void> {
  const doc = issue.documents[kind];
  if (!doc?.driveId) throw new Error('Reserve and persist a Drive ID first');
  const drive = driveClient();
  try {
    const r = await drive.files.get({ fileId: doc.driveId, supportsAllDrives: true, fields: 'id,parents,size,trashed' });
    if (r.data.trashed || !r.data.parents?.includes(folder) || Number(r.data.size) !== bytes.length) throw new Error('Existing Drive PDF does not match the issuance record');
    return;
  } catch (e) { if ((e as { code?: number }).code !== 404) throw e; }
  await drive.files.create({ supportsAllDrives: true, fields: 'id', requestBody: {
    id: doc.driveId, name: doc.filename, parents: [folder], mimeType: 'application/pdf',
    appProperties: { issuanceId: issue.id, documentKind: kind },
  }, media: { mimeType: 'application/pdf', body: Readable.from(bytes) } });
  // Inherit the accounting folder's permissions. Never make customer PDFs public.
}
