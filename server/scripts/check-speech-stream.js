import 'dotenv/config'
import { openSpeechStream } from '../src/services/speechStreamService.js'
try {
  for (let run = 0; run < 2; run++) {
    const start = performance.now()
    const result = await openSpeechStream('请说出图片上的物品名称')
    let firstMs, bytes = 0, chunks = 0
    for await (const chunk of result.chunks) {
      firstMs ??= Math.round(performance.now() - start)
      bytes += chunk.length; chunks++
    }
    console.log(JSON.stringify({ run: run + 1, cache: result.cache, firstMs, totalMs: Math.round(performance.now() - start), bytes, chunks }))
  }
} catch (error) { console.error(error.cause?.code || error.code || error.name); process.exitCode = 1 }
