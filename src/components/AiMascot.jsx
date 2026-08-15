import { useEffect, useRef } from 'react'

/**
 * AiMascot —— 页面吉祥物「小星」：圆润整体造型（头身一体无缝）。
 *
 * 特征锚点（参照吉祥物图片，比例圆润不显长）：
 *   · 头 + 身体 = 一条连续轮廓（不画分界线），
 *     用白色→淡蓝的上下渐变让脸和身体自然过渡
 *   · 扁款蓝色针织帽（针线纹理 + 深蓝帽沿 + 毛球）
 *   · 眼睛（脸上部）+ 微笑（居中），眉毛/腮红让线条更丰富
 *
 * 眼睛跟随指针：pointermove 计算指针相对吉祥物中心的偏移，
 * 限制最大偏移后，在 rAF 循环里直接写瞳孔组的 SVG transform（不触发 React 重渲染）。
 * 说话/聆听/连接状态通过包装元素的 CSS 类切换动画（见底部 <style>）。
 */
function AiMascot({
  speaking = false,
  listening = false,
  connecting = false,
  size = 250,
}) {
  const stateClass = connecting
    ? 'mascot-connecting'
    : listening
      ? 'mascot-listening'
      : speaking
        ? 'mascot-speaking'
        : 'mascot-idle'

  const mascotRef = useRef(null)
  const pupilLeftRef = useRef(null)
  const pupilRightRef = useRef(null)

  useEffect(() => {
    const mouse = { x: 0, y: 0 }
    let moved = false // 指针还没动过时，眼睛保持正中
    let raf = 0

    const onPointerMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      moved = true
    }

    const loop = () => {
      const el = mascotRef.current
      const left = pupilLeftRef.current
      const right = pupilRightRef.current
      if (el && left && right) {
        const rect = el.getBoundingClientRect()
        const scale = rect.width / 200 // CSS 像素 → SVG 单位
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        let dx = moved ? (mouse.x - cx) / scale : 0
        let dy = moved ? (mouse.y - cy) / scale : 0
        const dist = Math.hypot(dx, dy)
        const max = 3.2 // 瞳孔最大移动距离（SVG 单位）
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
      ref={mascotRef}
      className={`relative ${stateClass}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        role="img"
        aria-label="小星助手"
      >
        <defs>
          {/* 头→身体 上下渐变：白色脸 → 淡蓝身体，无缝过渡 */}
          <linearGradient id="mascotBodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="42%" stopColor="#F3F9FF" />
            <stop offset="100%" stopColor="#8FC2FF" />
          </linearGradient>
          <linearGradient id="mascotHatGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6AA8FF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>

        {/* 头 + 身体 = 一条连续轮廓（无分界线），整体轻微起伏动画 */}
        <g className="mascot-head">
          <path
            d="M64 150
               C64 186 76 194 100 194
               C124 194 136 186 136 150
               C156 130 164 106 152 80
               C144 60 124 48 100 48
               C76 48 56 60 48 80
               C36 106 44 130 64 150 Z"
            fill="url(#mascotBodyGrad)"
          />

          {/* 扁款冬天针织帽 */}
          <g className="mascot-hat">
            {/* 帽身（扁） */}
            <path
              d="M52 58 C52 44 74 36 100 36 C126 36 148 44 148 58 Z"
              fill="url(#mascotHatGrad)"
            />
            {/* 针线纹理：横向收针线 */}
            <path d="M55 51 Q100 42 145 51" fill="none" stroke="#2F6EE8" strokeWidth="2" strokeLinecap="round" />
            <path d="M56 43 Q100 34 144 43" fill="none" stroke="#2F6EE8" strokeWidth="2" strokeLinecap="round" />
            {/* 帽沿（深蓝，竖条纹 = 罗纹） */}
            <path
              d="M50 56 L150 56 C150 64 138 68 100 68 C62 68 50 64 50 56 Z"
              fill="#1E3A5F"
            />
            {[60, 70, 80, 90, 100, 110, 120, 130, 140].map((x) => (
              <line
                key={x}
                x1={x}
                y1="58"
                x2={x}
                y2="65"
                stroke="#6FA4FF"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ))}
            {/* 毛球 */}
            <circle cx="100" cy="34" r="5.5" fill="#A5D4FF" />
            <circle cx="98" cy="32" r="1.8" fill="#FFFFFF" opacity="0.8" />
          </g>

          {/* 腮红 */}
          <ellipse cx="70" cy="112" rx="8" ry="4.5" fill="#F9A8D4" opacity="0.5" />
          <ellipse cx="130" cy="112" rx="8" ry="4.5" fill="#F9A8D4" opacity="0.5" />

          {/* 眉毛 */}
          <path d="M78 88 Q86 84 94 88" fill="none" stroke="#1E3A5F" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M106 88 Q114 84 122 88" fill="none" stroke="#1E3A5F" strokeWidth="2.5" strokeLinecap="round" />

          {/* 左眼：外圈定位置 → 中层眨眼 → 内层瞳孔跟鼠标 */}
          <g transform="translate(86, 98)">
            <g className="mascot-eye-left">
              <g ref={pupilLeftRef} className="mascot-pupil-left">
                <circle r="6.5" fill="#1E3A5F" />
                <circle cx="1.5" cy="-2" r="2" fill="#FFFFFF" />
              </g>
            </g>
          </g>
          {/* 右眼 */}
          <g transform="translate(114, 98)">
            <g className="mascot-eye-right">
              <g ref={pupilRightRef} className="mascot-pupil-right">
                <circle r="6.5" fill="#1E3A5F" />
                <circle cx="-1.5" cy="-2" r="2" fill="#FFFFFF" />
              </g>
            </g>
          </g>

          {/* 嘴巴：空闲微笑线 / 说话时张开 */}
          <path
            className="mascot-smile"
            d="M88 122 Q100 132 112 122"
            fill="none"
            stroke="#1E3A5F"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g className="mascot-talkmouth">
            <ellipse cx="100" cy="124" rx="10" ry="7" fill="#1E3A5F" />
            <ellipse cx="100" cy="128" rx="4.5" ry="3" fill="#A78BFA" />
          </g>
        </g>
      </svg>

      <style>{`
        /* 让 CSS 变换以元素自身包围盒为中心，避免相对视口原点缩放 */
        .mascot-head,
        .mascot-eye-left,
        .mascot-eye-right,
        .mascot-talkmouth {
          transform-box: fill-box;
          transform-origin: center;
        }

        /* 整体轻微起伏 */
        @keyframes mascotIdle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30%      { transform: translateY(-3px) rotate(-1.5deg); }
          65%      { transform: translateY(1px) rotate(1.5deg); }
        }
        .mascot-idle .mascot-head,
        .mascot-listening .mascot-head,
        .mascot-speaking .mascot-head {
          animation: mascotIdle 3.6s ease-in-out infinite;
        }
        .mascot-connecting .mascot-head {
          animation: mascotIdle 1.6s ease-in-out infinite;
        }

        /* 眨眼：绝大部分时间睁眼，短暂压扁成线 */
        @keyframes mascotBlink {
          0%, 90%, 100% { transform: scaleY(1); }
          94%, 97%      { transform: scaleY(0.08); }
        }
        .mascot-eye-left,
        .mascot-eye-right {
          animation: mascotBlink 3.6s ease-in-out infinite;
        }
        .mascot-eye-right { animation-delay: 0.18s; }

        /* 嘴巴：空闲显示微笑线，说话时张开并开合 */
        .mascot-smile {
          opacity: 1;
          transition: opacity 0.15s ease;
        }
        .mascot-talkmouth {
          opacity: 0;
        }
        .mascot-speaking .mascot-smile {
          opacity: 0;
        }
        .mascot-speaking .mascot-talkmouth {
          opacity: 1;
        }
        @keyframes mascotTalk {
          0%, 100% { transform: scaleY(0.35); }
          30%      { transform: scaleY(1.1); }
          55%      { transform: scaleY(0.6); }
          80%      { transform: scaleY(0.95); }
        }
        .mascot-speaking .mascot-talkmouth {
          animation: mascotTalk 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default AiMascot
