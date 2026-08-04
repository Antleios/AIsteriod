import { apiGet } from './client.js'

export async function fetchObjectNamingQuestions() {
  const data = await apiGet('/api/games/object-naming/questions')

  return data.questions.map((question) => ({
    id: question.id,
    name: question.answer,
    emoji: question.assetValue,
    hint: question.hint,
  }))
}

export async function fetchEmojiMatchQuestions() {
  const data = await apiGet('/api/games/emoji-match/questions')

  return data.questions.map((question) => ({
    id: question.id,
    target: question.answer ?? question.prompt,
    options: question.options.map((option) => ({
      emoji: option.displayValue,
      name: option.label,
      correct: option.isCorrect,
    })),
  }))
}

export async function fetchColorLineRoundConfig() {
  const data = await apiGet('/api/games/color-line/round')

  return {
    dailyGoal: data.game?.dailyGoal ?? 5,
    totalPairs: data.totalPairs ?? 5,
    palette: data.palette ?? [],
  }
}
