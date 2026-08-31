import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

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
  DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`,
  NODE_ENV: 'test',
  AUTH_LOGIN_MAX_ATTEMPTS: '100',
  AUTH_REGISTER_MAX_ATTEMPTS: '100',
  AI_INTERACTION_PROVIDER: 'deterministic',
  AI_DOCTOR_PROVIDER: 'deterministic',
  AI_MEMORY_PROVIDER: 'deterministic',
}
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')

try {
  // On Windows the schema engine may fail to create a missing absolute SQLite file.
  await writeFile(databasePath, '')
  // Opt in only when the schema is unchanged and a running Windows server holds the DLL.
  if (!process.argv.includes('--skip-generate')) await run(process.execPath, [prismaCli, 'generate'], env)
  await run(process.execPath, [prismaCli, 'migrate', 'deploy'], env)
  await run(process.execPath, ['prisma/seed.js'], env)
  // API tests share one temporary SQLite database, so test files must not
  // truncate the user table concurrently.
  await run(process.execPath, ['--test', '--test-concurrency=1'], env)
} finally {
  await rm(testDirectory, { recursive: true, force: true })
}
