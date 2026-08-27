import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${signal ?? `code ${code}`}`,
        ),
      )
    })
  })
}

const testDirectory = await mkdtemp(join(tmpdir(), 'aisteriod-auth-test-'))
const databasePath = join(testDirectory, 'test.db')
const env = {
  ...process.env,
  DATABASE_URL: `file:${databasePath}`,
  NODE_ENV: 'test',
  AUTH_LOGIN_MAX_ATTEMPTS: '100',
  AUTH_REGISTER_MAX_ATTEMPTS: '100',
}
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

try {
  await run(npx, ['prisma', 'generate'], env)
  await run(npx, ['prisma', 'migrate', 'deploy'], env)
  await run(process.execPath, ['prisma/seed.js'], env)
  // API tests share one temporary SQLite database, so test files must not
  // truncate the user table concurrently.
  await run(process.execPath, ['--test', '--test-concurrency=1'], env)
} finally {
  await rm(testDirectory, { recursive: true, force: true })
}
