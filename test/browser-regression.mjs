// Run against an isolated Chrome (--remote-debugging-port=9224) and Vite preview :5175.
// All API requests are mocked; no patient records or provider quota are used.
import assert from 'node:assert/strict'
const page = await (await fetch('http://127.0.0.1:9224/json/new?about:blank', { method: 'PUT' })).json()
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result) }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + message.params.exceptionDetails.exception?.description)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '))
})
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async (expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description)
  return result.result.value
}
const waitFor = async (expression) => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'))
}
await call('Runtime.enable')
await call('Page.enable')
await call('Page.addScriptToEvaluateOnNewDocument', { source: `
window.__boot = Math.random(); window.__attempts = 0; window.__ended = 0; window.__speech = 0;
const realFetch = window.fetch.bind(window);
const NativeAudio = window.Audio;
window.Audio = class extends NativeAudio { constructor(...args) { super(...args); this.addEventListener('ended', () => window.__ended++); } };
const originalCreateSource = AudioContext.prototype.createBufferSource;
AudioContext.prototype.createBufferSource = function() { const source = originalCreateSource.call(this); source.addEventListener('ended', () => window.__ended++); return source; };
window.SpeechRecognition = class { start(){setTimeout(()=>this.onstart?.(),0)} stop(){this.onend?.()} abort(){} };
function wav() {
 const n=2400, b=new ArrayBuffer(44+n*2), v=new DataView(b);
 const s=(p,t)=>[...t].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
 s(0,'RIFF');v.setUint32(4,36+n*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,n*2,true);
 for(let i=0;i<n;i++)v.setInt16(44+i*2, Math.sin(i*2*Math.PI*440/8000)*3000,true);
 return b;
}
window.fetch=async (url,opts={})=>{
 const p=new URL(url,location.href).pathname;
 if(!p.startsWith('/api/'))return realFetch(url,opts);
 const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
 const body=opts.body?JSON.parse(opts.body):{};
 if(p==='/api/auth/me')return json({user:{id:1,role:'PATIENT',displayName:'模拟患者'}});
 if(p==='/api/ai/speech'){
   window.__speech++;
   if(body.stream){
     const pcm=new Uint8Array(wav().slice(44));
     let timer;
     return new Response(new ReadableStream({start(c){c.enqueue(pcm.slice(0,2400));timer=setTimeout(()=>{c.enqueue(pcm.slice(2400));c.close()},100)},cancel(){clearTimeout(timer)}}),{headers:{'Content-Type':'audio/pcm;rate=24000;channels=1'}})
   }
   return new Response(wav(),{headers:{'Content-Type':'audio/wav'}})
 }
 if(p.endsWith('/interactions'))return json({interaction:{reply:'我们可以一起看看提示。',provider:'qwen',emotion:'calm'}});
 if(p.endsWith('/game-runs')){
  let questions;
  if(body.gameCode==='object-naming')questions=[{id:'object1',assetValue:'🍎',hint:'水果'},{id:'object2',assetValue:'🚗',hint:'交通工具'}];
  if(body.gameCode==='emoji-match')questions=['开心','难过'].map((prompt,i)=>({id:'emoji'+i,prompt,options:[{id:'a',displayValue:'😊',label:'开心'},{id:'b',displayValue:'😢',label:'难过'}]}));
  if(body.gameCode==='color-line')questions=[{id:'red',color:'#FF6B6B',label:'红色'},{id:'blue',color:'#4A90D9',label:'蓝色'},{id:'green',color:'#2ECC71',label:'绿色'}];
  return json({gameRun:{id:'run-test',questions,config:{totalPairs:3}}});
 }
 if(p.endsWith('/attempts')){window.__attempts++;return json({attempt:{isCorrect:true,gameRun:{id:'run-test',status:'ACTIVE'}}})}
 if(p.endsWith('/events'))return json({accepted:1});
 if(p==='/api/training/sessions')return json({sessions:[{id:'session-test',status:'ACTIVE'}]});
 if(p==='/api/training/sessions/session-test')return json({session:{id:'session-test',status:'ACTIVE'}});
 return json({});
};
` })
const navigate = async (path) => {
  const old = await evaluate('window.__boot ?? null')
  await call('Page.navigate', { url: 'http://127.0.0.1:5175' + path })
  await waitFor('window.__boot && window.__boot !== ' + JSON.stringify(old))
}
try {
  await navigate('/emoji-game')
  await waitFor(`document.querySelector('button.group:not(:disabled)') && window.__ended >= 1`)
  const target = await evaluate(`document.querySelector('main .text-2xl').textContent`)
  await evaluate(`document.querySelector('button.group:not(:disabled)').click()`)
  await waitFor(`window.__attempts === 1 && document.querySelector('button.group:not(:disabled)') && document.querySelector('main .text-2xl').textContent !== ${JSON.stringify(target)}`)
  assert.equal(await evaluate(`document.querySelector('section[aria-label="游戏对话记录"]').querySelector('input, textarea, form, button')`), null)
  console.log('PASS: emoji audio ended, advanced to next question, no duplicate microphone')

  await navigate('/object-game')
  await waitFor(`document.querySelector('input[placeholder*="输入答案"]') && window.__ended >= 1`)
  const object = await evaluate(`[...document.querySelectorAll('span')].find(x=>x.className.includes('text-[8rem]')).textContent`)
  await evaluate(`(()=>{const input=document.querySelector('input[placeholder*="输入答案"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'这是苹果');input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await evaluate(`document.querySelector('input[placeholder*="输入答案"]').closest('form').requestSubmit()`)
  await waitFor(`window.__attempts === 1 && [...document.querySelectorAll('span')].find(x=>x.className.includes('text-[8rem]')).textContent !== ${JSON.stringify(object)}`)
  console.log('PASS: object audio ended and advanced to next question')

  await navigate('/color-game')
  await waitFor(`document.querySelectorAll('[data-item-id]').length===6 && window.__ended>=1`)
  await new Promise((resolve) => setTimeout(resolve, 2200))
  for (let pair = 0; pair < 2; pair++) {
    const points = await evaluate(`(()=>{const els=[...document.querySelectorAll('[data-item-id]')].filter(e=>e.getBoundingClientRect().width>0 && !e.disabled);const groups={};for(const e of els){const c=e.firstElementChild.style.backgroundColor;(groups[c]??=[]).push(e)}const group=Object.values(groups).find(g=>g.length===2 && !g[0].className.includes('opacity-0'));if(!group)return null;return group.map(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})})()`)
    assert.ok(points)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...points[0], button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...points[1], button: 'left', buttons: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points[1], button: 'left', clickCount: 1 })
    await waitFor(`window.__attempts===${pair+1}`)
    await new Promise((resolve) => setTimeout(resolve, 2600))
  }
  console.log('PASS: color game accepts a second pair after success audio')
  assert.deepEqual(errors, [])
} catch (error) { console.error('Browser exceptions:', errors); throw error } finally { socket.close() }
