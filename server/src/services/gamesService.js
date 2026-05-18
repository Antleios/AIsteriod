import prisma from '../db/prisma.js'

const GAME_INFO = {
  'object-naming': {
    id: 1,
    slug: 'object-naming',
    title: '物品命名游戏',
    dailyGoal: 10,
    description: '通过看图和语音说出日常物品名称。',
    config: null,
  },
  'emoji-match': {
    id: 2,
    slug: 'emoji-match',
    title: '表情匹配游戏',
    dailyGoal: 8,
    description: '根据情绪词选择对应的表情。',
    config: null,
  },
}

function parseJson(value, fallback) {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function serializeColorLineGame(config) {
  if (!config || !config.isActive) return null

  return {
    id: 3,
    slug: 'color-line',
    title: config.title,
    dailyGoal: config.dailyGoal,
    description: config.description,
    config: {
      totalPairs: config.totalPairs,
      palette: parseJson(config.paletteJson, []),
    },
  }
}

function serializeObjectNamingQuestion(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    answer: question.answer,
    hint: question.hint,
    assetType: question.assetType,
    assetValue: question.assetValue,
    difficulty: question.difficulty,
    options: [],
  }
}

function serializeEmojiMatchQuestion(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    answer: question.answer,
    hint: null,
    assetType: question.assetType,
    assetValue: null,
    difficulty: question.difficulty,
    options: parseJson(question.optionsJson, []).map((option, index) => ({
      id: index + 1,
      label: option.label,
      displayValue: option.displayValue,
      isCorrect: Boolean(option.isCorrect),
    })),
  }
}

export async function listGames() {
  const colorConfig = await prisma.colorLineConfig.findUnique({
    where: { key: 'default' },
  })
  const colorLineGame = serializeColorLineGame(colorConfig)

  return [
    GAME_INFO['object-naming'],
    GAME_INFO['emoji-match'],
    colorLineGame,
  ].filter(Boolean)
}

export async function getGameWithQuestions(slug) {
  if (slug === 'object-naming') {
    const questions = await prisma.objectNamingQuestion.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })

    return {
      game: GAME_INFO['object-naming'],
      questions: questions.map(serializeObjectNamingQuestion),
    }
  }

  if (slug === 'emoji-match') {
    const questions = await prisma.emojiMatchQuestion.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })

    return {
      game: GAME_INFO['emoji-match'],
      questions: questions.map(serializeEmojiMatchQuestion),
    }
  }

  if (slug === 'color-line') {
    const config = await prisma.colorLineConfig.findUnique({
      where: { key: 'default' },
    })
    const game = serializeColorLineGame(config)

    if (!game) return null

    return {
      game,
      questions: [],
    }
  }

  return null
}

export async function getColorLineRound() {
  const data = await getGameWithQuestions('color-line')
  if (!data) return null

  return {
    game: data.game,
    totalPairs: data.game.config?.totalPairs ?? 5,
    palette: data.game.config?.palette ?? [],
  }
}
