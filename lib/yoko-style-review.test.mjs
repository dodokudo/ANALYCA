import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countYokoText,
  hasStaleStyleLengthError,
  isEditableStyleAuditState,
  manualStyleAuditFailureMessage,
  MANUAL_STYLE_AUDIT_ERROR_PREFIX,
  MANUAL_STYLE_AUDIT_PENDING_PREFIX,
  STORED_STYLE_AUDIT_ERROR_PREFIX,
  yokoCommentLengthGuide,
} from './yoko-style-review.ts';

test('Threadsと同じく空白と改行を含めた文字数と不足数を表示する', () => {
  assert.equal(countYokoText('あ \nい　う'), 6);
  assert.equal(yokoCommentLengthGuide('あ'.repeat(358)), '358文字（あと12文字）');
  assert.equal(yokoCommentLengthGuide('あ'.repeat(397)), '397文字（範囲内）');
});

test('監査NGは修正稿保持の状態と新しい指摘だけを返す', () => {
  assert.equal(
    manualStyleAuditFailureMessage(['コメン1が12文字不足です']),
    `${MANUAL_STYLE_AUDIT_ERROR_PREFIX} コメン1が12文字不足です`,
  );
});

test('監査案・再監査待ち・修正稿保持の全状態を編集対象として識別する', () => {
  assert.equal(isEditableStyleAuditState(`${STORED_STYLE_AUDIT_ERROR_PREFIX} 指摘`), true);
  assert.equal(isEditableStyleAuditState(`${MANUAL_STYLE_AUDIT_PENDING_PREFIX} 未監査`), true);
  assert.equal(isEditableStyleAuditState(`${MANUAL_STYLE_AUDIT_ERROR_PREFIX} 指摘`), true);
  assert.equal(isEditableStyleAuditState('投稿1: 文字数エラー'), false);
});

test('現在397文字に対する過去286文字の指摘を古い結果と判定する', () => {
  assert.equal(hasStaleStyleLengthError({
    lastError: `${STORED_STYLE_AUDIT_ERROR_PREFIX} コメント1が規定の370〜500文字外です（286文字）`,
    comment1: 'あ'.repeat(397),
    comment2: 'い'.repeat(430),
  }), true);
  assert.equal(hasStaleStyleLengthError({
    lastError: `${MANUAL_STYLE_AUDIT_ERROR_PREFIX} コメント1が規定の370〜500文字外です（325文字）`,
    comment1: 'あ'.repeat(325),
    comment2: 'い'.repeat(442),
  }), false);
});
