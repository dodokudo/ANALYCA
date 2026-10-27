import fs from 'node:fs';
import path from 'node:path';
import { sheetDate, type InstagramSheetSource } from '../lib/instagram-sheet-import';

const [sourcePath, mediaPath] = process.argv.slice(2);
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as InstagramSheetSource;
const media = JSON.parse(fs.readFileSync(mediaPath, 'utf8')) as Array<{ id: string; permalink: string; timestamp: string }>;
const urlKey = (value: unknown) => String(value || '').split('?')[0].replace(/\/$/, '');
const byUrl = new Map(media.map(row => [urlKey(row.permalink), row]));
const byId = new Map(media.map(row => [row.id, row]));
const resolutions = [];
for (const [index, row] of source.reels.entries()) {
  if (!index) continue;
  const timestamp = sheetDate(row[5], true);
  const matched = byUrl.get(urlKey(row[4])) || byId.get(String(row[0]));
  const atSameTime = media.filter(item => Math.abs(Date.parse(item.timestamp) - Date.parse(timestamp || '')) < 1000);
  const canonical = matched && Math.abs(Date.parse(matched.timestamp) - Date.parse(timestamp || '')) < 1000
    ? matched : atSameTime.length === 1 ? atSameTime[0] : undefined;
  const oldId = row[0];
  if (canonical) {
    row[0] = canonical.id;
    row[4] = canonical.permalink;
  } else if (typeof oldId === 'number') {
    row[0] = `sheet:${oldId}`;
  }
  if (oldId !== row[0]) resolutions.push({ type: 'reel', row: index + 1, oldId, id: row[0], verified: Boolean(canonical) });
  if (!row[0] && timestamp) throw new Error(`Unresolved reel identity at row ${index + 1}`);
}
for (const [index, row] of source.stories.entries()) {
  if (typeof row[0] === 'number') {
    const oldId = row[0]; row[0] = `sheet:${oldId}`;
    resolutions.push({ type: 'story', row: index + 1, oldId, id: row[0], verified: false });
  }
}
const directory = path.dirname(sourcePath);
fs.writeFileSync(path.join(directory, 'resolved-source.json'), JSON.stringify(source));
fs.writeFileSync(path.join(directory, 'id-resolution.json'), JSON.stringify(resolutions, null, 2));
console.log({ verified: resolutions.filter(row => row.verified).length, archiveKeys: resolutions.filter(row => !row.verified).length });
