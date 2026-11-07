const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reconcileMessages } = require('../dist-electron/chat-state');
const msg = (id, text = String(id)) => ({ id, text });
test('older pages preserve existing newer messages', () => {
  assert.deepEqual(reconcileMessages([msg(2, 'atual'), msg(3)], [msg(1), msg(2, 'antiga')], 'older', new Set()), [msg(1), msg(2, 'atual'), msg(3)]);
});
test('a fresh snapshot keeps older history but reconciles deletions and edits', () => {
  assert.deepEqual(reconcileMessages([msg(1), msg(2, 'antiga'), msg(3)], [msg(2, 'editada'), msg(4)], 'latest', new Set()), [msg(1), msg(2, 'editada'), msg(4)]);
});
test('events received while loading take precedence over stale snapshots', () => {
  assert.deepEqual(reconcileMessages([msg(1), msg(2, 'tempo real'), msg(4)], [msg(2, 'antiga'), msg(3), msg(4)], 'latest', new Set([2, 3, 4])), [msg(1), msg(2, 'tempo real'), msg(4)]);
});
