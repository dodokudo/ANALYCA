import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readMediaBreakdown, summarizeMediaBreakdown } from '../instagram-media-breakdown';

test('uses actual period breakdown, including activity on older reels, and respects zero vs missing', () => {
  const result = readMediaBreakdown([
    { name: 'views', total_value: { value: 100, breakdowns: [{ dimension_keys: ['media_product_type'], results: [{ dimension_values: ['REEL'], value: 80 }, { dimension_values: ['STORY'], value: 20 }] }] } },
    { name: 'comments', total_value: { value: 0, breakdowns: [{ dimension_keys: ['media_product_type'] }] } },
    { name: 'shares', total_value: { value: 2, breakdowns: [{ dimension_keys: ['media_product_type'], results: [{ dimension_values: ['STORY'], value: 2 }] }] } },
    { name: 'saves', total_value: { value: 5 } },
  ]);
  assert.deepEqual(result.REEL, { views: 80, comments: 0, shares: 0 });
  assert.equal(result.STORY.views, 20);
  const rows = [{ media_breakdown: JSON.stringify(result) }, { media_breakdown: JSON.stringify(result) }];
  assert.equal(summarizeMediaBreakdown(rows, 'REEL', 2).views, 160);
  assert.equal(summarizeMediaBreakdown(rows, 'REEL', 2).saves, null);
  assert.equal(summarizeMediaBreakdown(rows, 'REEL', 3).views, null);
  assert.equal(summarizeMediaBreakdown([...rows, {}], 'REEL', 3).views, null);
});
