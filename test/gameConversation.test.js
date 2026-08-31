import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isGameConversation } from '../shared/gameIntent.js'
import { buildGameConversationContext } from '../server/src/services/gameConversationContext.js'

test('hint requests and emotional expressions are not answers', () => {
  for (const text of ['可以给我一点提示吗', '这个物品的名称是几个字', '我觉得好难', '我不想玩了', '不知道，可以帮我吗']) {
    assert.equal(isGameConversation(text), true, text)
  }
  for (const text of ['苹果', '这是一个苹果', '看起来像苹果']) assert.equal(isGameConversation(text), false, text)
})

test('model context contains authoritative hints and character count but not the answer', () => {
  const question = { clientPayloadJson: JSON.stringify({ prompt: '这是什么？', hint: '一种水果', assetValue: '🍎' }), answerJson: JSON.stringify({ displayAnswer: '苹果' }) }
  const context = buildGameConversationContext({ gameCode: 'object-naming', status: 'ACTIVE' }, question, 'OBJECT_NAMING')
  assert.equal(context.answerCharacterCount, 2)
  assert.equal(context.hint, '一种水果')
  assert.equal(JSON.stringify(context).includes('苹果'), false)
  assert.equal(JSON.stringify(context).includes('🍎'), false)
  question.clientPayloadJson = JSON.stringify({ hint: '这是苹果' })
  assert.equal(buildGameConversationContext({ gameCode: 'object-naming' }, question, 'OBJECT_NAMING').hint, null)
  assert.throws(() => buildGameConversationContext({ gameCode: 'emoji-match' }, question, 'OBJECT_NAMING'))
})
