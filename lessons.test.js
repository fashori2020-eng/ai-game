import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessons, summary } from './lessons.js';

test('lesson content follows the requested format', () => {
  assert.equal(lessons.length, 5);
  assert.equal(new Set(lessons.map(lesson => lesson.title)).size, 5);
  for (const lesson of lessons) {
    assert.match(lesson.bad, /^\/\/ ضعف‌های عمده:/);
    assert.ok(lesson.issues.length >= 3);
    assert.ok(lesson.good.split('\n').length <= 20);
    for (const code of [lesson.bad, lesson.good]) assert.match(code, /class \w+ : MonoBehaviour/);
  }
  assert.equal(summary.length, 5);
});
