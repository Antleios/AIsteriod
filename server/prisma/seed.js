import { PrismaClient } from '@prisma/client'
import { colorPalette } from '../../src/data/colorItems.js'
import objects from '../../src/data/objects.js'
import emotionEmojis from './data/emotionEmojis.js'

const prisma = new PrismaClient()
const TOTAL_COLOR_PAIRS = 5

async function seedObjectNaming() {
  await prisma.objectNamingQuestion.deleteMany()

  await prisma.objectNamingQuestion.createMany({
    data: objects.map((object) => ({
      prompt: '请说出图片上的物品名称',
      answer: object.name,
      hint: object.hint,
      assetType: 'emoji',
      assetValue: object.emoji,
      difficulty: 1,
      isActive: true,
    })),
  })
}

async function seedEmojiMatch() {
  await prisma.$transaction([
    prisma.emotionEmoji.updateMany({
      data: { isActive: false },
    }),
    ...emotionEmojis.map((emoji) =>
      prisma.emotionEmoji.upsert({
        where: { code: emoji.code },
        update: {
          label: emoji.label,
          displayValue: emoji.displayValue,
          difficulty: 1,
          isActive: true,
        },
        create: {
          ...emoji,
          difficulty: 1,
          isActive: true,
        },
      }),
    ),
  ])
}

async function seedColorLine() {
  await prisma.colorLineConfig.upsert({
    where: { key: 'default' },
    update: {
      title: '颜色连线游戏',
      dailyGoal: 5,
      description: '拖拽相同颜色的物品进行配对。',
      totalPairs: TOTAL_COLOR_PAIRS,
      paletteJson: JSON.stringify(colorPalette),
      isActive: true,
    },
    create: {
      key: 'default',
      title: '颜色连线游戏',
      dailyGoal: 5,
      description: '拖拽相同颜色的物品进行配对。',
      totalPairs: TOTAL_COLOR_PAIRS,
      paletteJson: JSON.stringify(colorPalette),
      isActive: true,
    },
  })
}

async function main() {
  await seedObjectNaming()
  await seedEmojiMatch()
  await seedColorLine()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
