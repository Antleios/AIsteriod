import { useEffect, useRef } from 'react'

/**
 * AiMascot —— 一个简单的黄色圆脸。
 *
 * 造型：
 *   · 黄色圆脸 + 细描边，没有嘴巴
 *   · 两种状态（expression）：calm 平静 / loving 喜欢（头顶冒小爱心）
 *   · 眼睛跟随鼠标：pointermove 计算指针相对脸部中心的偏移，
 *     在 rAF 循环里直接写眼睛组的 SVG transform（不触发 React 重渲染）
 *   · 聆听时（listening）下巴附近三个小点闪烁
 */

// 喜欢状态下从头顶冒出来的小爱心（位置 / 大小 / 动画延迟）
const FLOAT_HEARTS = [
  { left: '8%', top: '30%', size: 20, delay: '0s' },
  { left: '28%', top: '10%', size: 15, delay: '0.6s' },
  { left: '50%', top: '22%', size: 18, delay: '1.1s' },
  { left: '68%', top: '6%', size: 14, delay: '1.6s' },
  { left: '84%', top: '28%', size: 20, delay: '2.1s' },
  { left: '42%', top: '-4%', size: 22, delay: '0.3s' },
]

function AiMascot({
  expression = 'calm', // calm | loving
  listening = false,
  size = 180,
}) {
  const faceRef = useRef(null)
  const eyeLeftRef = useRef(null)
  const eyeRightRef = useRef(null)

  // 眼睛跟随鼠标
  useEffect(() => {
    const mouse = { x: 0, y: 0 }
    let moved = false // 指针没动过时，眼睛保持正中
    let raf = 0

    const onPointerMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      moved = true
    }

    const loop = () => {
      const el = faceRef.current
      const left = eyeLeftRef.current
      const right = eyeRightRef.current
      if (el && left && right) {
        const rect = el.getBoundingClientRect()
        const scale = rect.width / 200 // CSS 像素 → SVG 单位
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        let dx = moved ? (mouse.x - cx) / scale : 0
        let dy = moved ? (mouse.y - cy) / scale : 0
        const dist = Math.hypot(dx, dy)
        const max = 4 // 眼睛最大移动距离（SVG 单位）
        if (dist > max) {
          dx = (dx / dist) * max
          dy = (dy / dist) * max
        }
        const t = `translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`
        left.setAttribute('transform', t)
        right.setAttribute('transform', t)
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onPointerMove)
    raf = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={faceRef}
      className="relative select-none"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        role="img"
        aria-label="小星助手"
      >
        {/* 黄色圆脸 */}
        <circle cx="100" cy="100" r="86" fill="#FFD94A" stroke="#F0B400" strokeWidth="4" />

        {/* 左眼（跟随鼠标）：外层定位组 + 内层跟随组，避免覆盖基础位置 */}
        <g transform="translate(74, 88)">
          <g ref={eyeLeftRef}>
            <circle r="8.5" fill="#333333" />
          </g>
        </g>
        {/* 右眼（跟随鼠标）：外层定位组 + 内层跟随组 */}
        <g transform="translate(126, 88)">
          <g ref={eyeRightRef}>
            <circle r="8.5" fill="#333333" />
          </g>
        </g>

        {/* 聆听中：下巴附近三个小点闪烁 */}
        {listening && (
          <g>
            <circle cx="82" cy="172" r="4.5" fill="#F0A800" className="mascot-dot" />
            <circle
              cx="100"
              cy="172"
              r="4.5"
              fill="#F0A800"
              className="mascot-dot"
              style={{ animationDelay: '0.18s' }}
            />
            <circle
              cx="118"
              cy="172"
              r="4.5"
              fill="#F0A800"
              className="mascot-dot"
              style={{ animationDelay: '0.36s' }}
            />
          </g>
        )}
      </svg>

      {/* 喜欢：头顶冒出的小爱心 */}
      {expression === 'loving' && (
        <div className="mascot-hearts pointer-events-none" aria-hidden>
          {FLOAT_HEARTS.map((h, i) => (
            <span
              key={i}
              className="mascot-heart"
              style={{ left: h.left, top: h.top, width: h.size, height: h.size, animationDelay: h.delay }}
            >
              <svg viewBox="0 0 24 24" className="h-full w-full">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#FF6B81" />
              </svg>
            </span>
          ))}
        </div>
      )}

      <style>{`
        /* 喜欢：小爱心从头顶冒出来，上浮 + 轻微摇摆 + 淡出 */
        .mascot-hearts {
          position: absolute;
          inset: 0;
        }
        .mascot-heart {
          position: absolute;
          opacity: 0;
          animation: heartFloat 2.8s ease-in-out infinite;
        }
        @keyframes heartFloat {
          0%   { opacity: 0; transform: translateY(6px) scale(0.5); }
          15%  { opacity: 1; }
          60%  { opacity: 0.95; }
          100% { opacity: 0; transform: translateY(-64px) translateX(4px) scale(1.15); }
        }

        /* 聆听小点闪烁 */
        @keyframes mascotDot {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
        .mascot-dot {
          animation: mascotDot 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default AiMascot
