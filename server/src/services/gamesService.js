import { randomInt } from 'node:crypto'
import prisma from '../db/prisma.js'

const EMOJI_MATCH_OPTION_COUNT = 4

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

function shuffle(items) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export function buildEmojiMatchQuestions(emojis, questionCount) {
  const distinctLabels = new Set(emojis.map((emoji) => emoji.label))
  if (distinctLabels.size < EMOJI_MATCH_OPTION_COUNT) {
    throw new Error('Emoji match requires at least 4 active emotion labels')
  }

  const targets = shuffle(emojis).slice(0, questionCount)

  return targets.map((target) => {
    const distractors = shuffle(
      emojis.filter(
        (emoji) => emoji.id !== target.id && emoji.label !== target.label,
      ),
    ).slice(0, EMOJI_MATCH_OPTION_COUNT - 1)
    const options = shuffle([target, ...distractors])

    return {
      id: target.id,
      prompt: target.label,
      answer: target.label,
      hint: null,
      assetType: 'emoji',
      assetValue: null,
      difficulty: target.difficulty,
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        displayValue: option.displayValue,
        isCorrect: option.id === target.id,
      })),
    }
  })
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
    const selectedQuestions = shuffle(questions).slice(
      0,
      GAME_INFO['object-naming'].dailyGoal,
    )

    return {
      game: GAME_INFO['object-naming'],
      questions: selectedQuestions.map(serializeObjectNamingQuestion),
    }
  }

  if (slug === 'emoji-match') {
    const emojis = await prisma.emotionEmoji.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })
    const questions = buildEmojiMatchQuestions(
      emojis,
      GAME_INFO['emoji-match'].dailyGoal,
    )

    return {
      game: GAME_INFO['emoji-match'],
      questions,
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
