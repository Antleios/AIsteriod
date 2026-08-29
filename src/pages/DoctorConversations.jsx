import { useState } from 'react'
import DoctorHeader from '../components/DoctorHeader.jsx'

// 对话数据 —— 患者与 AI 的对话记录与情感分析
// 当前为前端 mock 数据，后端接入后替换为真实接口。
// 隐私控制：完整对话仅限该患者的主治医生查看（后端将基于 CareAssignment 鉴权 + 审计留痕）。
const records = [
  {
    id: 1,
    patient: '张小明',
    time: '今天 09:20',
    topic: '物品命名练习',
    turns: 14,
    duration: '12 分钟',
    sentiment: '积极',
    summary: '主动描述常见物品，命名正确率高，语言回应流畅',
    transcript: [
      { role: 'ai', content: '小明你好呀，今天我们来看一些东西，你能告诉我是它们是什么吗？' },
      { role: 'user', content: '好！' },
      { role: 'ai', content: '看这个圆圆的、甜甜的水果，是什么呀？' },
      { role: 'user', content: '苹果！' },
      { role: 'ai', content: '太棒了！这个黄色的、弯弯的水果呢？' },
      { role: 'user', content: '香蕉……我昨天也吃了香蕉。' },
      { role: 'ai', content: '真不错，香蕉很有营养。那你最喜欢什么水果呀？' },
      { role: 'user', content: '西瓜，夏天凉凉的。' },
      { role: 'ai', content: '说得真好！我们再看看这个小动物，它有长长的耳朵，是什么呀？' },
      { role: 'user', content: '兔子，会跳跳。' },
      { role: 'ai', content: '哇，你都知道，太厉害了！' },
      { role: 'user', content: '嘿嘿，我还想玩。' },
    ],
  },
  {
    id: 2,
    patient: '王小雅',
    time: '今天 10:05',
    topic: '情绪表达',
    turns: 9,
    duration: '8 分钟',
    sentiment: '平稳',
    summary: '能表达基本情绪，对图片情绪识别较准确，偶有停顿',
    transcript: [
      { role: 'ai', content: '小雅，今天我们一起看一些表情，看看它们是谁的心情，好吗？' },
      { role: 'user', content: '嗯。' },
      { role: 'ai', content: '这个笑笑的、眼睛弯弯的，是什么心情呀？' },
      { role: 'user', content: '开心……' },
      { role: 'ai', content: '对，开心！这个皱眉头、嘴巴向下的呢？' },
      { role: 'user', content: '不开心……生气？' },
      { role: 'ai', content: '说得很好。那你今天的心情是开心的还是不开心的呀？' },
      { role: 'user', content: '……开心，和妈妈玩了积木。' },
      { role: 'ai', content: '听起来好棒，和妈妈玩积木很开心呢。' },
    ],
  },
  {
    id: 3,
    patient: '陈一诺',
    time: '昨天 16:40',
    topic: '生活习惯',
    turns: 18,
    duration: '15 分钟',
    sentiment: '需要关注',
    summary: '提到午睡困难，情绪稍显低落，建议家长关注作息',
    transcript: [
      { role: 'ai', content: '一诺，今天过得怎么样呀？' },
      { role: 'user', content: '不好。' },
      { role: 'ai', content: '怎么了？愿意和我说说吗？' },
      { role: 'user', content: '……中午睡不着，一直翻来翻去。' },
      { role: 'ai', content: '睡不着的时候确实很难受。你是每天都睡不着，还是今天呢？' },
      { role: 'user', content: '好几天了。妈妈说我乱动。' },
      { role: 'ai', content: '听上去你有点难过。下午的时候你会困吗？' },
      { role: 'user', content: '会，可是睡不着就更难过。' },
      { role: 'ai', content: '谢谢你告诉我这些，一诺。我们明天可以试试先安静躺一会儿，再数数小羊，好吗？' },
      { role: 'user', content: '数小羊……我试试。' },
      { role: 'ai', content: '嗯，我会一直陪着你的。下次我们也可以和妈妈说这件事，让她帮你。' },
    ],
  },
  {
    id: 4,
    patient: '刘子涵',
    time: '昨天 14:12',
    topic: '颜色认知',
    turns: 11,
    duration: '10 分钟',
    sentiment: '积极',
    summary: '乐于回答颜色问题，主动发起话题，互动意愿明显增强',
    transcript: [
      { role: 'ai', content: '子涵，今天我们来认颜色！这个草地的颜色是什么呀？' },
      { role: 'user', content: '绿色！' },
      { role: 'ai', content: '答对啦！天空是什么颜色呢？' },
      { role: 'user', content: '蓝色，还有白色的云。' },
      { role: 'ai', content: '哇，你连白云都注意到了。太阳是什么颜色呀？' },
      { role: 'user', content: '黄色……老师，我今天穿了红色的衣服。' },
      { role: 'ai', content: '真的吗？红色很好看！你最喜欢什么颜色呀？' },
      { role: 'user', content: '我最喜欢蓝色，像大海。' },
      { role: 'ai', content: '大海的蓝色真的很漂亮。那我们来连一连，把一样颜色的东西连起来吧！' },
      { role: 'user', content: '好！这个我肯定会。' },
    ],
  },
  {
    id: 5,
    patient: '李浩浩',
    time: '前天 11:30',
    topic: '情绪表达',
    turns: 7,
    duration: '9 分钟',
    sentiment: '平稳',
    summary: '对话较短，回应以单字为主，建议多进行开放性问题引导',
    transcript: [
      { role: 'ai', content: '浩浩，我们来玩心情小游戏，这个表情是什么呀？' },
      { role: 'user', content: '笑。' },
      { role: 'ai', content: '对，是开心。这个呢，扁扁嘴的？' },
      { role: 'user', content: '哭。' },
      { role: 'ai', content: '嗯，难过的时候会想哭。你难过的时候想做什么呀？' },
      { role: 'user', content: '……' },
      { role: 'ai', content: '没关系，我们可以慢慢说。喜欢做什么都可以告诉我。' },
      { role: 'user', content: '玩车。' },
    ],
  },
  {
    id: 6,
    patient: '赵天佑',
    time: '前天 09:55',
    topic: '物品命名练习',
    turns: 16,
    duration: '13 分钟',
    sentiment: '积极',
    summary: '命名准确率较上周提升，主动纠错，专注度良好',
    transcript: [
      { role: 'ai', content: '天佑，今天我们挑战一些难一点的东西，准备好了吗？' },
      { role: 'user', content: '准备好了！' },
      { role: 'ai', content: '这个厨房里用的、会切菜的刀，叫什么呀？' },
      { role: 'user', content: '刀……不对，是菜刀。' },
      { role: 'ai', content: '对，是菜刀！你改过来了，很棒！这个戴在手上、可以看时间的是什么呢？' },
      { role: 'user', content: '手表。' },
      { role: 'ai', content: '真厉害！这个下雨天撑在头上的呢？' },
      { role: 'user', content: '雨伞，可以挡雨。' },
      { role: 'ai', content: '说得真完整。上次我们学过的、放在书包里写字的那个呢？' },
      { role: 'user', content: '铅笔，写字的铅笔。' },
      { role: 'ai', content: '答对啦，你记得好清楚！今天全对，太棒了！' },
      { role: 'user', content: '耶！我下次还要玩难的！' },
    ],
  },
]

const sentimentStyle = {
  积极: 'bg-emerald-50 text-emerald-500',
  平稳: 'bg-[#EAF4FF] text-[#3B82F6]',
  需要关注: 'bg-orange-50 text-orange-500',
}

function ConversationModal({ record, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 animate-fade-in bg-[#1E3A5F]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl animate-modal-pop flex-col rounded-3xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#1E3A5F]">
              {record.patient} · 对话记录
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {record.topic} · {record.time} · 共 {record.turns} 条消息
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 对话气泡 */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#F7FAFF] px-8 py-6">
          {record.transcript.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <span className={`mb-1 px-1 text-xs ${isUser ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
                  {isUser ? '患者' : 'AI 助手'}
                </span>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-tr-sm bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] text-white shadow-md shadow-[#3B82F6]/20'
                      : 'rounded-tl-sm border border-gray-100 bg-white text-[#1E3A5F] shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            )
          })}
        </div>

        {/* 底部提示 */}
        <div className="border-t border-gray-100 px-8 py-3 text-center text-xs text-gray-400">
          对话内容仅限该患者的主治医生查看，查看行为将记录审计日志
        </div>
      </div>
    </div>
  )
}

function DoctorConversations() {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(null) // 当前打开的对话记录
  const filtered = records.filter(
    (r) =>
      r.patient.includes(keyword.trim()) ||
      r.topic.includes(keyword.trim()) ||
      r.summary.includes(keyword.trim()),
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">对话数据</h1>
        <p className="mt-1 text-sm text-gray-400">
          共 {filtered.length} 条对话记录（前端 mock 数据，后端待接入）
        </p>

        {/* 搜索 */}
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/80 px-4 py-2.5 shadow-sm focus-within:border-[#3B82F6]/40 focus-within:ring-2 focus-within:ring-[#3B82F6]/15">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索患者、话题或分析摘要…"
            className="flex-1 bg-transparent text-sm text-[#1E3A5F] outline-none placeholder:text-gray-400"
          />
        </div>

        {/* 对话记录表格 */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white/80 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F7FAFF] text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">患者</th>
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">对话主题</th>
                <th className="px-5 py-3 font-medium">消息数</th>
                <th className="px-5 py-3 font-medium">时长</th>
                <th className="px-5 py-3 font-medium">情绪倾向</th>
                <th className="px-5 py-3 font-medium">分析摘要</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 transition-colors last:border-0 hover:bg-[#F7FAFF]/70"
                >
                  <td className="px-5 py-3 font-medium text-[#1E3A5F]">{r.patient}</td>
                  <td className="px-5 py-3 text-gray-500">{r.time}</td>
                  <td className="px-5 py-3 text-gray-500">{r.topic}</td>
                  <td className="px-5 py-3 text-gray-500">{r.turns}</td>
                  <td className="px-5 py-3 text-gray-500">{r.duration}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${sentimentStyle[r.sentiment]}`}>
                      {r.sentiment}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-5 py-3">
                    <p className="truncate text-gray-500" title={r.summary}>
                      {r.summary}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpen(r)}
                      className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#dbeafe]"
                    >
                      查看对话
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    没有找到匹配的对话记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* 对话详情弹窗 */}
      {open && <ConversationModal record={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

export default DoctorConversations
