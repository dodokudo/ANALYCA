import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scheduleTabPath = new URL('../app/[userId]/components/schedule-tab.tsx', import.meta.url);
const scheduleEditorPath = new URL('../app/[userId]/components/schedule-editor.tsx', import.meta.url);
const schedulePreviewPath = new URL('../app/[userId]/components/schedule-preview.tsx', import.meta.url);

test('Threads preview is restricted to the requested account and desktop layout', async () => {
  const source = await readFile(scheduleTabPath, 'utf8');

  assert.match(source, /27016191458061252/);
  assert.match(source, /2xl:grid-cols-/);
  assert.match(source, /hidden 2xl:block/);
  assert.match(source, /sticky top-6/);
});

test('schedule editor streams the live draft to the preview', async () => {
  const source = await readFile(scheduleEditorPath, 'utf8');

  assert.match(source, /onPreviewChange/);
  assert.match(source, /mainText/);
  assert.match(source, /mediaItems/);
  assert.match(source, /comment7/);
});

test('preview renders the Threads post anatomy', async () => {
  const source = await readFile(schedulePreviewPath, 'utf8');

  assert.match(source, /Threadsでの表示イメージ/);
  assert.match(source, /thread-action/);
  assert.match(source, /whitespace-pre-wrap/);
  assert.match(source, /object-contain/);
});
