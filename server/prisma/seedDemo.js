import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/security/password.js'

const prisma = new PrismaClient()
const DAY_MS = 24 * 60 * 60 * 1_000
const MINUTE_MS = 60 * 1_000
const ACCOUNT_PASSWORD =
  process.env.SAMPLE_ACCOUNT_PASSWORD ??
  'Aisteriod-2026!'

const doctorSpec = {
  username: 'lin.qinghe',
  legacyUsername: 'demo.doctor',
  displayName: '林清和',
  role: 'DOCTOR',
}

const patients = [
  {
    username: 'chen.yu',
    legacyUsername: 'demo.patient.chenyu',
    displayName: '陈雨',
    profile: {
      age: 7,
      gender: 'FEMALE',
      diagnosis: '语言表达训练观察期',
      caseNotes: '喜欢动物和绘画，可优先使用具象图片引导表达。',
    },
  },
  {
    username: 'zhou.an',
    legacyUsername: 'demo.patient.zhouan',
    displayName: '周安',
    profile: {
      age: 6,
      gender: 'MALE',
      diagnosis: '注意力与任务持续性训练观察',
      caseNotes: '单次训练建议控制在 10 分钟以内。',
    },
  },
  {
    username: 'lin.yu',
    legacyUsername: 'demo.patient.linyu',
    displayName: '林语',
    profile: {
      age: 8,
      gender: 'FEMALE',
      diagnosis: '情绪识别与语言描述训练观察',
      caseNotes: '遇到连续错误时需要更温和的分步提示。',
    },
  },
  {
    username: 'sun.le',
    legacyUsername: 'demo.patient.sunle',
    displayName: '孙乐',
    profile: {
      age: 5,
      gender: 'MALE',
      diagnosis: '颜色与视觉匹配能力训练观察',
      caseNotes: '颜色配对完成度较高，可以逐步增加干扰项。',
    },
  },
  {
    username: 'zhao.wenxin',
    legacyUsername: 'demo.patient.wenxin',
    displayName: '赵文心',
    profile: {
      age: 9,
      gender: 'FEMALE',
      diagnosis: '词汇提取训练随访',
      caseNotes: '历史表现稳定，但已超过两周未训练。',
    },
  },
  {
    username: 'zhang.haoran',
    legacyUsername: 'demo.patient.haoran',
    displayName: '张浩然',
    profile: {
      age: 7,
      gender: 'MALE',
      diagnosis: '初次评估待开始',
      caseNotes: '已建立医患关联，尚无训练和对话数据。',
    },
  },
  {
    username: 'li.xiaoyu',
    legacyUsername: 'demo.patient.xiaoyu',
    displayName: '李晓宇',
    profile: {
      age: 6,
      gender: 'UNDISCLOSED',
      diagnosis: '物品命名与主动表达训练观察',
      caseNotes: '部分题目需要查看答案，可关注自主作答比例。',
    },
  },
  {
    username: 'wang.keke',
    legacyUsername: 'demo.patient.keke',
    displayName: '王可可',
    profile: {
      age: 10,
      gender: 'FEMALE',
      diagnosis: '综合认知训练阶段性观察',
      caseNotes: '最近一次训练较上周有明显进步。',
    },
  },
]

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * MINUTE_MS)
}

function daysAgo(days, hourOffset = 0) {
  return new Date(Date.now() - days * DAY_MS - hourOffset * 60 * MINUTE_MS)
}

function createQuestions(gameCode, attemptsByQuestion, startedAt, endedAt) {
  const questionType = gameCode.replaceAll('-', '_').toUpperCase()

  return attemptsByQuestion.map((outcomes, questionIndex) => {
    const completed = outcomes.some((outcome) =>
      ['CORRECT', 'REVEALED'].includes(outcome),
    )
    const attempts = outcomes.map((outcome, attemptIndex) => ({
      answerJson: JSON.stringify({ value: `answer-${questionIndex + 1}` }),
      outcome,
      responseTimeMs: 1_100 + questionIndex * 240 + attemptIndex * 370,
      createdAt: new Date(
        startedAt.getTime() + (questionIndex * 2 + attemptIndex + 1) * MINUTE_MS,
      ),
    }))

    return {
      position: questionIndex + 1,
      questionType,
      clientPayloadJson: JSON.stringify({ position: questionIndex + 1 }),
      answerJson: JSON.stringify({ value: `answer-${questionIndex + 1}` }),
      completedAt: completed ? endedAt ?? new Date() : null,
      ...(attempts.length ? { attempts: { create: attempts } } : {}),
    }
  })
}

function createGameRun(run, sequence) {
  const endedAt = run.status === 'ACTIVE'
    ? null
    : new Date(run.startedAt.getTime() + (run.durationMinutes ?? 8) * MINUTE_MS)

  return {
    gameCode: run.gameCode,
    sequence,
    status: run.status ?? 'COMPLETED',
    startedAt: run.startedAt,
    endedAt,
    configSnapshotJson: null,
    questions: {
      create: createQuestions(run.gameCode, run.attempts, run.startedAt, endedAt),
    },
  }
}

function createTurns(dialogue, startedAt) {
  return dialogue.map((turn, index) => ({
    sequence: index + 1,
    role: turn.role,
    context: 'CHAT',
    content: turn.content,
    inputMethod: turn.role === 'USER' ? turn.inputMethod ?? 'TEXT' : 'SYSTEM',
    responseLatencyMs: turn.role === 'ASSISTANT' ? 620 + index * 85 : null,
    isUserInitiated: turn.role === 'USER',
    metadataJson: turn.emotion ? JSON.stringify({ emotion: turn.emotion }) : null,
    createdAt: new Date(startedAt.getTime() + (index + 1) * MINUTE_MS),
  }))
}

async function addInteractionAudit(sessionId) {
  const turns = await prisma.conversationTurn.findMany({
    where: { sessionId },
    orderBy: { sequence: 'asc' },
  })

  const interactions = []
  for (let index = 0; index < turns.length - 1; index += 1) {
    const userTurn = turns[index]
    const assistantTurn = turns[index + 1]
    if (userTurn.role !== 'USER' || assistantTurn.role !== 'ASSISTANT') continue
    interactions.push({
      sessionId,
      clientRequestId: `chat-${sessionId}-${userTurn.sequence}`,
      trigger: 'USER_MESSAGE',
      context: 'CHAT',
      requestJson: JSON.stringify({ userText: userTurn.content }),
      provider: 'qwen',
      model: 'qwen-plus',
      promptVersion: 'patient-interaction-v1',
      status: 'READY',
      resultJson: JSON.stringify({ reply: assistantTurn.content }),
      userTurnId: userTurn.id,
      assistantTurnId: assistantTurn.id,
      createdAt: userTurn.createdAt,
      updatedAt: assistantTurn.createdAt,
    })
    index += 1
  }

  if (interactions.length) {
    await prisma.aiInteraction.createMany({ data: interactions })
  }
}

async function createSession(patientId, spec) {
  const endedAt = spec.status === 'ACTIVE'
    ? null
    : new Date(spec.startedAt.getTime() + (spec.durationMinutes ?? 18) * MINUTE_MS)
  const dialogue = spec.dialogue ?? []
  const session = await prisma.trainingSession.create({
    data: {
      userId: patientId,
      status: spec.status ?? 'COMPLETED',
      startedAt: spec.startedAt,
      endedAt,
      metadataJson: JSON.stringify({ source: 'web' }),
      metricsJson: null,
      nextGameRunSequence: spec.runs.length + 1,
      nextConversationSequence: dialogue.length + 1,
      updatedAt: dialogue.length
        ? new Date(spec.startedAt.getTime() + dialogue.length * MINUTE_MS)
        : endedAt ?? spec.startedAt,
      gameRuns: {
        create: spec.runs.map((run, index) => createGameRun(run, index + 1)),
      },
      ...(dialogue.length
        ? { conversationTurns: { create: createTurns(dialogue, spec.startedAt) } }
        : {}),
      summary: {
        create: {
          status: 'READY',
          provider: 'qwen',
          promptVersion: 'session-summary-v1',
          resultJson: JSON.stringify({
            sessionOverview: spec.summary,
            interactionSummary: dialogue.length
              ? `保存了 ${dialogue.length} 条患者与 AI 的对话消息。`
              : '本次训练没有对话消息。',
            comparisonWithinSession: spec.comparison ?? '本次训练表现保持稳定。',
          }),
          generatedAt: endedAt ?? new Date(),
        },
      },
    },
  })

  await addInteractionAudit(session.id)
  return session
}

const sessionFactories = {
  'chen.yu': (patientId) => createSession(patientId, {
    startedAt: minutesAgo(130),
    status: 'COMPLETED',
    summary: '完成物品命名训练，能够主动描述喜欢的动物。',
    runs: [{
      gameCode: 'object-naming',
      startedAt: minutesAgo(130),
      attempts: [['CORRECT'], ['CORRECT'], ['WRONG', 'CORRECT'], ['CORRECT'], ['CORRECT']],
    }],
    dialogue: [
      { role: 'USER', content: '我今天认出了小猫和雨伞。', inputMethod: 'ASR' },
      { role: 'ASSISTANT', content: '真棒！你一下子说出了两个物品，最喜欢哪一个？', emotion: 'encouraging' },
      { role: 'USER', content: '我最喜欢小猫，因为它软软的。', inputMethod: 'ASR' },
      { role: 'ASSISTANT', content: '你还说出了喜欢它的原因，表达得很完整。', emotion: 'warm' },
    ],
  }),
  'zhou.an': (patientId) => createSession(patientId, {
    startedAt: minutesAgo(28),
    status: 'ACTIVE',
    summary: '颜色连线训练正在进行中。',
    runs: [{
      gameCode: 'color-line',
      status: 'ACTIVE',
      startedAt: minutesAgo(28),
      attempts: [['CORRECT'], ['WRONG'], [], [], []],
    }],
    dialogue: [
      { role: 'USER', content: '这个蓝色应该连到哪里？' },
      { role: 'ASSISTANT', content: '先找找另一边颜色最接近蓝色的物品，我们慢慢看。', emotion: 'supportive' },
    ],
  }),
  'lin.yu': (patientId) => createSession(patientId, {
    startedAt: daysAgo(1, 2),
    status: 'COMPLETED',
    summary: '完成表情匹配训练，对惊讶和担心仍需要提示。',
    runs: [{
      gameCode: 'emoji-match',
      startedAt: daysAgo(1, 2),
      attempts: [['WRONG', 'CORRECT'], ['WRONG', 'CORRECT'], ['CORRECT'], ['WRONG', 'CORRECT']],
    }],
    dialogue: [
      { role: 'USER', content: '我分不清担心和惊讶。' },
      { role: 'ASSISTANT', content: '没关系，我们可以看看眉毛和嘴巴有什么不同。', emotion: 'empathetic' },
      { role: 'USER', content: '担心的时候眉毛会皱起来吗？' },
      { role: 'ASSISTANT', content: '这是一个很好的观察。担心时眉毛常常会靠近一些。', emotion: 'encouraging' },
      { role: 'USER', content: '那我想再试一次。' },
      { role: 'ASSISTANT', content: '好呀，我们一题一题来，你可以先说看到的特征。', emotion: 'supportive' },
    ],
  }),
  'sun.le': (patientId) => createSession(patientId, {
    startedAt: daysAgo(3, 1),
    status: 'COMPLETED',
    summary: '顺利完成颜色连线，五组颜色全部一次匹配成功。',
    runs: [{
      gameCode: 'color-line',
      startedAt: daysAgo(3, 1),
      attempts: [['CORRECT'], ['CORRECT'], ['CORRECT'], ['CORRECT'], ['CORRECT']],
    }],
    dialogue: [
      { role: 'USER', content: '我把所有颜色都连好了。' },
      { role: 'ASSISTANT', content: '五组颜色都完成了，而且非常认真，做得很好。', emotion: 'celebratory' },
    ],
  }),
  'zhao.wenxin': (patientId) => createSession(patientId, {
    startedAt: daysAgo(15),
    status: 'COMPLETED',
    summary: '历史物品命名训练表现稳定，但近期没有新的训练。',
    runs: [{
      gameCode: 'object-naming',
      startedAt: daysAgo(15),
      attempts: [['CORRECT'], ['CORRECT'], ['WRONG', 'CORRECT'], ['CORRECT']],
    }],
    dialogue: [
      { role: 'USER', content: '今天的词我大部分都记得。' },
      { role: 'ASSISTANT', content: '你的词汇记忆很稳定，下次可以试着用这些词说句子。', emotion: 'encouraging' },
    ],
  }),
  'li.xiaoyu': (patientId) => createSession(patientId, {
    startedAt: daysAgo(2),
    status: 'COMPLETED',
    summary: '完成物品命名训练，其中一题查看答案后能够复述。',
    runs: [{
      gameCode: 'object-naming',
      startedAt: daysAgo(2),
      attempts: [['CORRECT'], ['REVEALED'], ['WRONG', 'CORRECT'], ['CORRECT']],
    }],
    dialogue: [
      { role: 'USER', content: '有一个东西我想不起来名字。', inputMethod: 'ASR' },
      { role: 'ASSISTANT', content: '想不起来也没关系，可以先说说它是什么颜色、用来做什么。', emotion: 'reassuring' },
      { role: 'USER', content: '看到答案以后我记住了，是雨伞。', inputMethod: 'ASR' },
      { role: 'ASSISTANT', content: '对，是雨伞。你还可以说一句“下雨时我会带雨伞”。', emotion: 'encouraging' },
    ],
  }),
  'wang.keke': async (patientId) => {
    await createSession(patientId, {
      startedAt: daysAgo(6),
      status: 'COMPLETED',
      summary: '上周表情匹配训练正确率偏低。',
      runs: [{
        gameCode: 'emoji-match',
        startedAt: daysAgo(6),
        attempts: [['WRONG', 'CORRECT'], ['WRONG', 'CORRECT'], ['CORRECT']],
      }],
      dialogue: [],
    })
    await createSession(patientId, {
      startedAt: minutesAgo(75),
      status: 'COMPLETED',
      summary: '本次表情匹配全部一次答对，较上周有明显进步。',
      comparison: '本次正确率高于上一次训练，正确作答更加稳定。',
      runs: [{
        gameCode: 'emoji-match',
        startedAt: minutesAgo(75),
        attempts: [['CORRECT'], ['CORRECT'], ['CORRECT'], ['CORRECT']],
      }],
      dialogue: [
        { role: 'USER', content: '这次我觉得表情更容易分辨了。' },
        { role: 'ASSISTANT', content: '你这次观察得更快了，也全部一次答对。能说说你用了什么方法吗？', emotion: 'curious' },
        { role: 'USER', content: '我先看眉毛，再看嘴巴。' },
        { role: 'ASSISTANT', content: '这是很清楚的观察顺序，可以继续保持。', emotion: 'encouraging' },
      ],
    })
  },
}

async function upsertDemoUser(passwordHash, user) {
  return prisma.user.upsert({
    where: { username: user.username },
    update: {
      passwordHash,
      displayName: user.displayName,
      role: user.role,
      status: 'ACTIVE',
    },
    create: {
      username: user.username,
      passwordHash,
      displayName: user.displayName,
      role: user.role,
      status: 'ACTIVE',
    },
  })
}

async function migrateLegacyUsername(user) {
  const legacyUser = await prisma.user.findUnique({
    where: { username: user.legacyUsername },
  })
  if (!legacyUser) return

  const usernameOwner = await prisma.user.findUnique({
    where: { username: user.username },
  })
  if (usernameOwner && usernameOwner.id !== legacyUser.id) {
    throw new Error(`无法将旧样例账号 ${user.legacyUsername} 更新为 ${user.username}：新用户名已存在`)
  }

  await prisma.user.update({
    where: { id: legacyUser.id },
    data: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: 'ACTIVE',
    },
  })
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('演示数据禁止写入生产环境')
  }

  await migrateLegacyUsername(doctorSpec)
  for (const patientSpec of patients) {
    await migrateLegacyUsername({ ...patientSpec, role: 'PATIENT' })
  }

  const passwordHash = await hashPassword(ACCOUNT_PASSWORD)
  const doctor = await upsertDemoUser(passwordHash, {
    ...doctorSpec,
  })

  for (const patientSpec of patients) {
    const patient = await upsertDemoUser(passwordHash, {
      ...patientSpec,
      role: 'PATIENT',
    })
    await prisma.patientProfile.upsert({
      where: { userId: patient.id },
      update: patientSpec.profile,
      create: { userId: patient.id, ...patientSpec.profile },
    })
    await prisma.careAssignment.upsert({
      where: {
        clinicianId_patientId: {
          clinicianId: doctor.id,
          patientId: patient.id,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        clinicianId: doctor.id,
        patientId: patient.id,
        status: 'ACTIVE',
      },
    })
    await prisma.trainingSession.deleteMany({ where: { userId: patient.id } })
    const createPatientSessions = sessionFactories[patient.username]
    if (createPatientSessions) await createPatientSessions(patient.id)
  }

  const counts = await Promise.all([
    prisma.careAssignment.count({
      where: { clinicianId: doctor.id, status: 'ACTIVE' },
    }),
    prisma.trainingSession.count({
      where: { user: { username: { in: patients.map(({ username }) => username) } } },
    }),
    prisma.conversationTurn.count({
      where: {
        session: { user: { username: { in: patients.map(({ username }) => username) } } },
      },
    }),
  ])

  console.log('虚构医生演示数据已写入。')
  console.log(`医生账号: ${doctor.username} / ${ACCOUNT_PASSWORD}`)
  console.log(`关联患者: ${counts[0]}，训练会话: ${counts[1]}，对话消息: ${counts[2]}`)
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
