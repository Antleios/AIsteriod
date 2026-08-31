const gameContexts = { 'object-naming': 'OBJECT_NAMING', 'emoji-match': 'EMOJI_MATCH', 'color-line': 'COLOR_LINE' }

export function buildGameConversationContext(run, question, context) {
  if (gameContexts[run.gameCode] !== context) throw new Error('GAME_CONTEXT_MISMATCH')
  const state = { game: run.gameCode, status: run.status }
  if (!question) return state
  const payload = JSON.parse(question.clientPayloadJson)
  const expected = JSON.parse(question.answerJson)
  state.prompt = payload.prompt
  if (context === 'OBJECT_NAMING') {
    const answer = expected.displayAnswer ?? expected.acceptedAnswers?.[0] ?? ''
    state.answerCharacterCount = Array.from(answer).length
    const hint = String(payload.hint ?? '')
    state.hint = answer && hint.includes(answer) ? null : hint
  } else if (context === 'EMOJI_MATCH') {
    state.guidance = '可以引导观察眼睛、眉毛和嘴角的变化，不指出具体选项。'
  } else {
    state.guidance = '可以建议先选一个图形，再观察其他图形的颜色；形状不同也可能是同一种颜色。'
  }
  return state
}
