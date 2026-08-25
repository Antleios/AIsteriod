import 'dotenv/config'
import { Prisma } from '@prisma/client'
import prisma from '../src/db/prisma.js'
import { createUser } from '../src/services/authService.js'
import {
  createUserSchema,
  serializeValidationIssues,
} from '../src/validation/authSchemas.js'

function readArgument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function printUsage() {
  console.error(
    '用法: NEW_USER_PASSWORD="安全密码" npm run user:create -- --username <用户名> --display-name <显示名称> [--role PATIENT|DOCTOR|ADMIN]',
  )
}

async function main() {
  const input = {
    username: readArgument('username'),
    displayName: readArgument('display-name'),
    role: readArgument('role') ?? 'PATIENT',
    password: process.env.NEW_USER_PASSWORD,
  }
  const parsed = createUserSchema.safeParse(input)

  if (!parsed.success) {
    printUsage()
    for (const issue of serializeValidationIssues(parsed.error)) {
      console.error(`${issue.field}: ${issue.message}`)
    }
    process.exitCode = 1
    return
  }

  const user = await createUser(parsed.data)
  console.log(
    `已创建用户: ${user.username} (${user.displayName}, ${user.role})`,
  )
}

main()
  .catch((error) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.error('创建失败：用户名已存在')
    } else {
      console.error(error)
    }
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
