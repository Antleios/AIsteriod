const emotionSets = [
  {
    target: '开心',
    options: [
      { emoji: '😊', name: '开心', correct: true },
      { emoji: '😢', name: '悲伤', correct: false },
      { emoji: '😡', name: '愤怒', correct: false },
      { emoji: '😨', name: '害怕', correct: false },
    ],
  },
  {
    target: '悲伤',
    options: [
      { emoji: '😢', name: '悲伤', correct: true },
      { emoji: '😊', name: '开心', correct: false },
      { emoji: '😴', name: '困倦', correct: false },
      { emoji: '😰', name: '焦虑', correct: false },
    ],
  },
  {
    target: '愤怒',
    options: [
      { emoji: '😡', name: '愤怒', correct: true },
      { emoji: '😭', name: '大哭', correct: false },
      { emoji: '🤔', name: '思考', correct: false },
      { emoji: '😊', name: '开心', correct: false },
    ],
  },
  {
    target: '害怕',
    options: [
      { emoji: '😨', name: '害怕', correct: true },
      { emoji: '😡', name: '愤怒', correct: false },
      { emoji: '😂', name: '大笑', correct: false },
      { emoji: '😑', name: '无聊', correct: false },
    ],
  },
  {
    target: '惊讶',
    options: [
      { emoji: '😲', name: '惊讶', correct: true },
      { emoji: '😊', name: '开心', correct: false },
      { emoji: '😴', name: '困倦', correct: false },
      { emoji: '😰', name: '焦虑', correct: false },
    ],
  },
  {
    target: '大哭',
    options: [
      { emoji: '😭', name: '大哭', correct: true },
      { emoji: '😢', name: '悲伤', correct: false },
      { emoji: '😨', name: '害怕', correct: false },
      { emoji: '😂', name: '大笑', correct: false },
    ],
  },
  {
    target: '大笑',
    options: [
      { emoji: '😂', name: '大笑', correct: true },
      { emoji: '😊', name: '开心', correct: false },
      { emoji: '😭', name: '大哭', correct: false },
      { emoji: '😲', name: '惊讶', correct: false },
    ],
  },
  {
    target: '困倦',
    options: [
      { emoji: '😴', name: '困倦', correct: true },
      { emoji: '😡', name: '愤怒', correct: false },
      { emoji: '😰', name: '焦虑', correct: false },
      { emoji: '🤔', name: '思考', correct: false },
    ],
  },
  {
    target: '焦虑',
    options: [
      { emoji: '😰', name: '焦虑', correct: true },
      { emoji: '😨', name: '害怕', correct: false },
      { emoji: '😢', name: '悲伤', correct: false },
      { emoji: '😴', name: '困倦', correct: false },
    ],
  },
  {
    target: '思考',
    options: [
      { emoji: '🤔', name: '思考', correct: true },
      { emoji: '😲', name: '惊讶', correct: false },
      { emoji: '😑', name: '无聊', correct: false },
      { emoji: '😂', name: '大笑', correct: false },
    ],
  },
]

export default emotionSets
