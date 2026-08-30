import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_USERNAMES = [
  'lin.qinghe',
  'chen.yu',
  'zhou.an',
  'lin.yu',
  'sun.le',
  'zhao.wenxin',
  'zhang.haoran',
  'li.xiaoyu',
  'wang.keke',
  'demo.doctor',
  'demo.patient.chenyu',
  'demo.patient.zhouan',
  'demo.patient.linyu',
  'demo.patient.sunle',
  'demo.patient.wenxin',
  'demo.patient.haoran',
  'demo.patient.xiaoyu',
  'demo.patient.keke',
]

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('演示数据清理命令禁止在生产环境执行')
  }

  const existingUsers = await prisma.user.findMany({
    where: { username: { in: DEMO_USERNAMES } },
    select: { username: true },
    orderBy: { username: 'asc' },
  })

  if (!existingUsers.length) {
    console.log('未发现需要清理的演示账号。')
    return
  }

  const result = await prisma.user.deleteMany({
    where: { username: { in: DEMO_USERNAMES } },
  })

  console.log(`已删除 ${result.count} 个演示账号及其关联数据。`)
  console.log(`账号: ${existingUsers.map(({ username }) => username).join(', ')}`)
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
