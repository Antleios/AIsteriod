import { useEffect, useRef } from 'react'

/**
 * AiMascot —— 一个简单的黄色圆脸，用最少的线条表达表情。
 *
 * 造型：
 *   · 黄色圆脸 + 细描边，只有眼睛和嘴巴几根线
 *   · 三种表情（expression）：平静 / 开心 / 喜欢
 *   · 眼睛跟随鼠标：pointermove 计算指针相对脸部中心的偏移，
 *     在 rAF 循环里直接写眼睛组的 SVG transform（不触发 React 重渲染）
 *   · 说话时（speaking）嘴巴开合
 */
function AiMascot({
  expression = 'calm', // calm | happy | loving
  speaking = false,
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

        {/* 腮红：开心 / 喜欢时出现 */}
        {(expression === 'happy' || expression === 'loving') && (
          <>
            <ellipse cx="52" cy="122" rx="12" ry="7" fill="#FF9E80" opacity="0.55" />
            <ellipse cx="148" cy="122" rx="12" ry="7" fill="#FF9E80" opacity="0.55" />
          </>
        )}

        {/* 左眼（跟随鼠标）：外层定位组 + 内层跟随组，避免覆盖基础位置 */}
        <g transform="translate(74, 88)">
          <g ref={eyeLeftRef}>
            {expression === 'loving' ? (
              /* 喜欢：♥ 眼睛 */
              <path
                d="M0 4 C-5 -2 -12 -1 -10 4 C-8 9 0 13 0 13 C0 13 8 9 10 4 C12 -1 5 -2 0 4 Z"
                fill="#E5484D"
              />
            ) : (
              <circle r="8.5" fill="#333333" />
            )}
          </g>
        </g>
        {/* 右眼（跟随鼠标）：外层定位组 + 内层跟随组 */}
        <g transform="translate(126, 88)">
          <g ref={eyeRightRef}>
            {expression === 'loving' ? (
              <path
                d="M0 4 C-5 -2 -12 -1 -10 4 C-8 9 0 13 0 13 C0 13 8 9 10 4 C12 -1 5 -2 0 4 Z"
                fill="#E5484D"
              />
            ) : (
              <circle r="8.5" fill="#333333" />
            )}
          </g>
        </g>

        {/* 嘴巴（按表情）——平时循环开合，说话时更快更夸张 */}
        <g className={`mascot-mouth ${speaking ? 'mascot-mouth-fast' : ''}`}>
          {expression === 'calm' && (
            /* 平静：一条平缓的线 */
            <path
              d="M78 132 Q100 142 122 132"
              fill="none"
              stroke="#333333"
              strokeWidth="5"
              strokeLinecap="round"
            />
          )}
          {expression === 'happy' && (
            /* 开心：张开大笑（带舌头） */
            <>
              <path
                d="M68 124 Q100 160 132 124 Q100 148 68 124 Z"
                fill="#333333"
              />
              <path
                d="M86 140 Q100 152 114 140 Q100 148 86 140 Z"
                fill="#FF6B6B"
              />
            </>
          )}
          {expression === 'loving' && (
            /* 喜欢：微笑 + 上弯眼睛情绪，简单弧线 */
            <path
              d="M72 128 Q100 146 128 128"
              fill="none"
              stroke="#333333"
              strokeWidth="5"
              strokeLinecap="round"
            />
          )}
        </g>

        {/* 喜欢：飘出的小爱心 */}
        {expression === 'loving' && (
          <>
            <path
              d="M60 52 C56 47 49 48 49 53 C49 58 60 64 60 64 C60 64 71 58 71 53 C71 48 64 47 60 52 Z"
              fill="#FF6B81"
            />
            <path
              d="M136 42 C132 37 125 38 125 43 C125 48 136 54 136 54 C136 54 147 48 147 43 C147 38 140 37 136 42 Z"
              fill="#FF9E9E"
            />
          </>
        )}

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

      <style>{`
        /* 嘴巴：一直循环开合（说话感），播报语音时更快更夸张 */
        .mascot-mouth {
          transform-box: fill-box;
          transform-origin: center;
          animation: mouthLoop 1.5s ease-in-out infinite;
        }
        @keyframes mouthLoop {
          0%, 100% { transform: scaleY(0.55); }
          25%      { transform: scaleY(1.1); }
          50%      { transform: scaleY(0.7); }
          75%      { transform: scaleY(1.02); }
        }
        .mascot-mouth-fast {
          animation-duration: 0.4s;
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
