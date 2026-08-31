import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesObjectAnswer } from '../shared/objectNaming.js'

test('accepts common spoken answer frames', () => {
  for (const answer of ['苹果', '苹果。', '这是苹果', '这是一个苹果呀', '看起来像苹果',
    '看起来像是一个苹果', '我觉得这看起来像一个苹果', '图上的是苹果',
    '图片上的物品是苹果', '应该是苹果吧']) {
    assert.equal(matchesObjectAnswer(answer, ['苹果']), true, answer)
  }
})

test('rejects negation, alternatives, wrong objects, fragments and compound nouns', () => {
  for (const answer of ['', '这是香蕉', '不是苹果', '这不是苹果', '看起来不像苹果',
    '这是苹果还是香蕉', '苹果或者香蕉', '苹果手机', '这是苹果汁', '苹',
    '不是香蕉也不是苹果', '我不喜欢苹果', '这是苹果吗']) {
    assert.equal(matchesObjectAnswer(answer, ['苹果']), false, answer)
  }
})

test('supports configured answer variants and counters without changing target words', () => {
  assert.equal(matchesObjectAnswer('这是一只小狗', ['狗', '小狗']), true)
  assert.equal(matchesObjectAnswer('那是一辆汽车', ['汽车']), true)
  assert.equal(matchesObjectAnswer('这是一个 APPLE', ['apple']), true)
  assert.equal(matchesObjectAnswer('这是一辆车', ['汽车']), false)
})
