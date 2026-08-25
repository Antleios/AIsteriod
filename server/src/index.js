import { createApp } from './app.js'

const app = createApp()
const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'

app.listen(port, host, (error) => {
  if (error) {
    console.error(error)
    process.exit(1)
  }

  console.log(`AIsteriod API server listening on http://${host}:${port}`)
})
