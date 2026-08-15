export const emotionEmojis = [
  { code: 'happy', name: '开心', emoji: '😊' },
  { code: 'sad', name: '悲伤', emoji: '😢' },
  { code: 'angry', name: '愤怒', emoji: '😡' },
  { code: 'afraid', name: '害怕', emoji: '😨' },
  { code: 'sleepy', name: '困倦', emoji: '😴' },
  { code: 'anxious', name: '焦虑', emoji: '😰' },
  { code: 'crying', name: '大哭', emoji: '😭' },
  { code: 'thinking', name: '思考', emoji: '🤔' },
  { code: 'laughing', name: '大笑', emoji: '😂' },
  { code: 'bored', name: '无聊', emoji: '😑' },
  { code: 'surprised', name: '惊讶', emoji: '😲' },
  { code: 'excited', name: '兴奋', emoji: '🤩' },
  { code: 'loving', name: '喜爱', emoji: '😍' },
  { code: 'relaxed', name: '放松', emoji: '😌' },
  { code: 'confused', name: '困惑', emoji: '😕' },
  { code: 'worried', name: '担心', emoji: '😟' },
  { code: 'disappointed', name: '失望', emoji: '😞' },
  { code: 'embarrassed', name: '尴尬', emoji: '😳' },
  { code: 'impatient', name: '不耐烦', emoji: '🙄' },
  { code: 'playful', name: '调皮', emoji: '🤪' },
  { code: 'nauseous', name: '恶心', emoji: '🤢' },
  { code: 'calm', name: '平静', emoji: '🙂' },
  { code: 'touched', name: '感动', emoji: '🥹' },
  { code: 'confident', name: '自信', emoji: '😎' },
]

const OPTION_COUNT = 4

const emotionSets = emotionEmojis.map((target, targetIndex) => ({
  target: target.name,
  options: Array.from({ length: OPTION_COUNT }, (_, optionIndex) => {
    const emotion = emotionEmojis[(targetIndex + optionIndex) % emotionEmojis.length]

    return {
      emoji: emotion.emoji,
      name: emotion.name,
      correct: emotion.code === target.code,
    }
  }),
}))

export default emotionSets
