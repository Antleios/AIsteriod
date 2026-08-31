import { emotionEmojis } from './emotionEmojis.js'
import { colorPalette } from './colorItems.js'

const lastVariantIndexes = new Map()

const messageBuilders = {
  objectNaming: {
    prompt: [
      () => ({
        display: '请说出图片上的物品名称',
        speech: '请说出图片上的物品名称',
      }),
      () => ({
        display: '看看图片，你知道这是什么吗？',
        speech: '看看图片，你知道这是什么吗？',
      }),
      () => ({
        display: '仔细看一看，请告诉我它的名字',
        speech: '仔细看一看，请告诉我它的名字。',
      }),
      () => ({
        display: '轮到你啦，说说图片里是什么吧',
        speech: '轮到你啦，说说图片里是什么吧。',
      }),
    ],
    listening: [
      () => ({ display: '我在认真听你说……', speech: '' }),
      () => ({ display: '慢慢说，我在听……', speech: '' }),
      () => ({ display: '想好后告诉我吧……', speech: '' }),
      () => ({ display: '不用着急，我听着呢……', speech: '' }),
    ],
    correct: [
      ({ answer }) => ({
        display: answer
          ? `答对了！这就是${answer}！嗯，做到了。🎉`
          : '答对了！嗯，做到了。🎉',
        speech: answer
          ? `答对了！这就是${answer}！嗯，做到了。`
          : '答对了！嗯，做到了。',
      }),
      ({ answer }) => ({
        display: answer
          ? `说得真准确，这是${answer}！⭐`
          : '说得真准确！继续保持！⭐',
        speech: answer
          ? `说得真准确，这是${answer}！`
          : '说得真准确！继续保持！',
      }),
      ({ answer }) => ({
        display: answer
          ? `没错，就是${answer}！你认出来了！👏`
          : '没错！你认出来了！👏',
        speech: answer
          ? `没错，就是${answer}！你认出来了！`
          : '没错！你认出来了！',
      }),
      ({ answer }) => ({
        display: answer
          ? `回答正确！${answer}记得很清楚呢！✨`
          : '回答正确！记得很清楚呢！✨',
        speech: answer
          ? `回答正确！${answer}记得很清楚呢！`
          : '回答正确！记得很清楚呢！',
      }),
    ],
    incorrect: [
      ({ heard }) => ({
        display: heard
          ? `我听到的是“${heard}”，再仔细看看？🤔`
          : '再仔细看看图片，想一想这是什么？🤔',
        speech: '再仔细看看图片，想一想这是什么？',
      }),
      ({ heard }) => ({
        display: heard
          ? `你刚才说了“${heard}”，我们再观察一下图片吧。`
          : '没关系，我们再观察一下图片吧。',
        speech: '没关系，我们再观察一下图片吧。',
      }),
      () => ({
        display: '没关系，我们看看提示，再想一想它叫什么。💡',
        speech: '没关系，我们看看提示，再想一想它叫什么。',
      }),
      () => ({
        display: '先别着急，看看提示，再试一次吧。🙂',
        speech: '先别着急，看看提示，再试一次吧。',
      }),
    ],
    reveal: [
      ({ answer, emoji }) => ({
        display: `这是${answer}哦！${emoji}`,
        speech: `这是${answer}哦！`,
      }),
      ({ answer, emoji }) => ({
        display: `答案是${answer}，记住它啦！${emoji}`,
        speech: `答案是${answer}，记住它啦！`,
      }),
      ({ answer, emoji }) => ({
        display: `它叫${answer}，我们下次再认一认！${emoji}`,
        speech: `它叫${answer}，我们下次再认一认！`,
      }),
    ],
    recordError: [
      () => ({ display: '训练记录暂不可用，请再试一次。', speech: '' }),
      () => ({ display: '刚才的答案没有保存成功，请重新试一次。', speech: '' }),
      () => ({ display: '记录训练结果时遇到问题，请稍后重试。', speech: '' }),
    ],
    revealError: [
      () => ({ display: '答案暂不可用，请稍后再试。', speech: '' }),
      () => ({ display: '现在还不能显示答案，请过一会儿再试。', speech: '' }),
      () => ({ display: '答案获取失败了，请稍后重新点击。', speech: '' }),
    ],
    completion: [
      ({ goal }) => ({
        display: '嗯，做到了。今日训练全部完成！',
        detail: `今天认识了 ${goal} 个物品，继续加油！`,
      }),
      ({ goal }) => ({
        display: '今天的物品训练完成啦！',
        detail: `你认真练习了 ${goal} 个物品，表现很棒！`,
      }),
      ({ goal }) => ({
        display: '今天的练习完成了，可以休息一下。',
        detail: `${goal} 个物品训练已经完成，明天继续保持！`,
      }),
    ],
  },
  emojiMatch: {
    prompt: [
      ({ target }) => ({
        display: `请选出表示“${target}”的表情`,
        speech: `请选出表示${target}的表情。`,
      }),
      ({ target }) => ({
        display: `哪个表情看起来是“${target}”？`,
        speech: `哪个表情看起来是${target}？`,
      }),
      ({ target }) => ({
        display: `找一找代表“${target}”的表情吧`,
        speech: `找一找代表${target}的表情吧。`,
      }),
      ({ target }) => ({
        display: `想一想，“${target}”应该是哪张脸？`,
        speech: `想一想，${target}应该是哪张脸？`,
      }),
    ],
    waiting: [
      ({ target }) => ({ display: `点击你觉得是“${target}”的表情吧`, speech: '' }),
      ({ target }) => ({ display: `仔细看看，选出“${target}”的表情`, speech: '' }),
      () => ({ display: '慢慢观察，选好后点一下吧', speech: '' }),
      () => ({ display: '看看每张脸，哪一个最合适呢？', speech: '' }),
    ],
    correct: [
      ({ emoji, target }) => ({
        display: `答对了！${emoji} 就是${target}！嗯，做到了。🎉`,
        speech: `答对了！这就是${target}！嗯，做到了。`,
      }),
      ({ emoji, target }) => ({
        display: `选得真准！${emoji} 表示${target}！⭐`,
        speech: `选得真准！这个表情表示${target}！`,
      }),
      ({ emoji, target }) => ({
        display: `没错，${emoji} 正是${target}的表情！👏`,
        speech: `没错，正是${target}的表情！`,
      }),
      ({ emoji, target }) => ({
        display: `回答正确！你认出了${target}${emoji}！✨`,
        speech: `回答正确！你认出了${target}！`,
      }),
    ],
    incorrect: [
      ({ emoji, optionName, target }) => ({
        display: `${emoji} 是“${optionName}”哦，再想想哪个是“${target}”？🤔`,
        speech: `这个表情是${optionName}，再想想哪个是${target}。`,
      }),
      ({ optionName, target }) => ({
        display: `这个更像“${optionName}”，再找找“${target}”吧。`,
        speech: `这个更像${optionName}，再找找${target}吧。`,
      }),
      ({ target }) => ({
        display: `还差一点，再观察一下哪个表情是“${target}”。💡`,
        speech: `还差一点，再观察一下哪个表情是${target}。`,
      }),
      ({ target }) => ({
        display: `没关系，看看其他表情，重新找找“${target}”吧。🙂`,
        speech: `没关系，看看其他表情，重新找找${target}吧。`,
      }),
    ],
    recordError: [
      () => ({ display: '训练记录暂不可用，请再试一次。', speech: '' }),
      () => ({ display: '这次选择没有保存成功，请重新选择。', speech: '' }),
      () => ({ display: '记录训练结果时遇到问题，请稍后再试。', speech: '' }),
    ],
    completion: [
      ({ goal }) => ({
        display: '嗯，做到了。今日表情训练全部完成！',
        detail: `今天认识了 ${goal} 种情绪表情，继续加油！`,
      }),
      ({ goal }) => ({
        display: '今天的表情训练完成啦！',
        detail: `你练习了 ${goal} 种情绪，观察得很认真！`,
      }),
      ({ goal }) => ({
        display: '今天的表情练习完成了，可以休息一下。',
        detail: `${goal} 道表情题已经完成，表现很不错！`,
      }),
    ],
  },
  colorLine: {
    prompt: [
      () => ({
        display: '请把相同颜色的物品连起来',
        speech: '请把相同颜色的物品连起来。',
      }),
      () => ({
        display: '找出颜色相同的两个图形，把它们连起来',
        speech: '找出颜色相同的两个图形，把它们连起来。',
      }),
      () => ({
        display: '看看哪些颜色一样，动手连一连吧',
        speech: '看看哪些颜色一样，动手连一连吧。',
      }),
      () => ({
        display: '请帮助每个颜色找到相同颜色的伙伴',
        speech: '请帮助每个颜色找到相同颜色的伙伴。',
      }),
    ],
    playing: [
      () => ({ display: '按住一个物品，拖到相同颜色的上面', speech: '' }),
      () => ({ display: '选一个颜色，再把它拖到同色物品上', speech: '' }),
      () => ({ display: '从一个图形出发，连接相同的颜色', speech: '' }),
      () => ({ display: '仔细观察，找找颜色相同的伙伴', speech: '' }),
    ],
    dragging: [
      () => ({ display: '拖到相同颜色的物品上', speech: '' }),
      () => ({ display: '沿着线找到同颜色的伙伴吧', speech: '' }),
      () => ({ display: '继续拖动，看看哪个颜色和它一样', speech: '' }),
      () => ({ display: '把它带到相同颜色的图形那里', speech: '' }),
    ],
    selected: [
      ({ label }) => ({ display: '', speech: `选中了${label}。` }),
      ({ label }) => ({ display: '', speech: `你拿起了${label}图形。` }),
      ({ label }) => ({ display: '', speech: `现在从${label}开始连线。` }),
    ],
    correct: [
      ({ label }) => ({
        display: `嗯，做到了。${label}配对成功！🎉`,
        speech: `${label}配对成功！`,
      }),
      ({ label }) => ({
        display: `连对了！两个${label}找到伙伴啦！⭐`,
        speech: `连对了！两个${label}找到伙伴啦！`,
      }),
      ({ label }) => ({
        display: `没错，它们都是${label}！👏`,
        speech: `没错，它们都是${label}！`,
      }),
      ({ label }) => ({
        display: `${label}连接正确，做得很好！✨`,
        speech: `${label}连接正确，做得很好！`,
      }),
    ],
    incorrect: [
      () => ({
        display: '这两个颜色不一样哦，再试试吧。🤔',
        speech: '这两个颜色不一样，再试试吧。',
      }),
      () => ({
        display: '颜色还没有配对成功，再观察一下吧。',
        speech: '颜色还没有配对成功，再观察一下吧。',
      }),
      () => ({
        display: '再看一看，它们的颜色有一点不同。💡',
        speech: '再看一看，它们的颜色有一点不同。',
      }),
      () => ({
        display: '没关系，换一个相同颜色的图形试试。🙂',
        speech: '没关系，换一个相同颜色的图形试试。',
      }),
    ],
    recordError: [
      () => ({ display: '训练记录暂不可用，请重新连线。', speech: '' }),
      () => ({ display: '这次连线没有保存成功，请再连一次。', speech: '' }),
      () => ({ display: '记录训练结果时遇到问题，请稍后重试。', speech: '' }),
    ],
    tip: [
      () => ({ display: '💡 按住一个彩色物品，拖到另一个相同颜色的物品上即可配对' }),
      () => ({ display: '💡 先观察颜色，再从一个图形拖到相同颜色的图形' }),
      () => ({ display: '💡 圆形和方形中各有一个相同颜色，试着把它们连起来' }),
    ],
    completion: [
      ({ goal }) => ({
        display: '今日全部完成！',
        detail: `今天完成了 ${goal} 对颜色配对！`,
      }),
      ({ goal }) => ({
        display: '今天的颜色训练完成啦！',
        detail: `${goal} 对颜色都成功找到了伙伴！`,
      }),
      ({ goal }) => ({
        display: '任务完成，颜色辨认得很准确！',
        detail: `你完成了 ${goal} 对连线，表现很棒！`,
      }),
    ],
    roundCompletion: [
      ({ total }) => ({
        display: '全部配对成功！',
        detail: `你成功匹配了所有 ${total} 对！`,
      }),
      ({ total }) => ({
        display: '这一轮全部连对了！',
        detail: `${total} 对颜色都已经正确连接！`,
      }),
      ({ total }) => ({
        display: '本轮挑战完成！',
        detail: `所有 ${total} 对颜色都找到了伙伴！`,
      }),
    ],
  },
}

function pickIndex(key, length) {
  if (length <= 1) return 0

  const previousIndex = lastVariantIndexes.get(key)
  const offset = Math.floor(Math.random() * (length - 1)) + 1
  const nextIndex = previousIndex === undefined
    ? Math.floor(Math.random() * length)
    : (previousIndex + offset) % length

  lastVariantIndexes.set(key, nextIndex)
  return nextIndex
}

function pickGameMessage(game, scene, context = {}) {
  const builders = messageBuilders[game]?.[scene]
  if (!builders?.length) {
    return { display: '', speech: '' }
  }

  const index = pickIndex(`${game}.${scene}`, builders.length)
  return builders[index](context)
}

export { pickGameMessage }

// Only these context-free, developer-authored phrases may enter the shared audio cache.
export const fixedSpeechTexts = new Set([
  ...messageBuilders.objectNaming.prompt,
  ...messageBuilders.objectNaming.incorrect,
  ...messageBuilders.colorLine.prompt,
  ...messageBuilders.colorLine.incorrect,
].map(build => build({}).speech).filter(Boolean))
for (const emotion of emotionEmojis) {
  for (const build of [...messageBuilders.emojiMatch.prompt, ...messageBuilders.emojiMatch.correct]) {
    fixedSpeechTexts.add(build({ target: emotion.name, emoji: emotion.emoji }).speech)
  }
  for (const option of emotionEmojis) {
    for (const build of messageBuilders.emojiMatch.incorrect) fixedSpeechTexts.add(build({ target: emotion.name, optionName: option.name, emoji: option.emoji }).speech)
  }
}
for (const color of colorPalette) {
  for (const build of [...messageBuilders.colorLine.selected, ...messageBuilders.colorLine.correct]) fixedSpeechTexts.add(build({ label: color.name }).speech)
}
