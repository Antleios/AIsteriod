import { useEffect, useState } from 'react'

const particles = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (360 / 12) * i,
  delay: i * 0.05,
}))

function RewardPopup({ show, onComplete }) {
  const [visible, setVisible] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (!show) {
      setVisible(false)
      return
    }
    setVisible(true)
    setScore((s) => s + 1)

    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 1500)

    return () => clearTimeout(timer)
  }, [show, onComplete])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {/* Big Star */}
      <div className="animate-reward-star text-7xl">⭐</div>

      {/* Orbiting particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute h-4 w-4 animate-reward-particle"
          style={{
            animationDelay: `${p.delay}s`,
            '--angle': `${p.angle}deg`,
          }}
        >
          {['🌟', '✨', '💫', '⭐'][p.id % 4]}
        </div>
      ))}

      {/* Score counter */}
      <div className="absolute top-1/2 mt-14 animate-reward-score text-lg font-bold text-yellow-500">
        +1
      </div>

      <style>{`
        @keyframes rewardStar {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          40% { transform: scale(1.4) rotate(10deg); opacity: 1; }
          70% { transform: scale(0.95) rotate(-5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes rewardParticle {
          0% { transform: rotate(var(--angle)) translateY(0); opacity: 1; }
          100% { transform: rotate(var(--angle)) translateY(-120px); opacity: 0; }
        }
        @keyframes rewardScore {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          30% { opacity: 1; transform: translateY(-10px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-40px) scale(1); }
        }
        .animate-reward-star {
          animation: rewardStar 0.6s ease-out forwards;
        }
        .animate-reward-particle {
          animation: rewardParticle 0.8s ease-out forwards;
        }
        .animate-reward-score {
          animation: rewardScore 1.2s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default RewardPopup
