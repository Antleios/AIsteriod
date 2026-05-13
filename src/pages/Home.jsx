import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import aiLogo from '../assets/logo.jpg'
import patientIcon from '../assets/patient.jpg'
import doctorIcon from '../assets/doctor.jpg'

function Home() {
  const navigate = useNavigate()
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-[#EAF4FF]/40 to-[#EAF4FF]/80">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 animate-gradient bg-[length:400%_400%] bg-[rad-gradient(circle_at_30%_20%,rgba(59,130,246,0.06)_0%,transparent_50%,rgba(94,162,255,0.04)_80%)] pointer-events-none" />

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-16">
        {/* Hero Section */}
        <div className="flex items-center gap-10">
          {/* AI Avatar Logo */}
          <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-full border-4 border-white shadow-xl">
            <img
              src={aiLogo}
              alt="AI Logo"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-6xl font-extrabold tracking-tight text-[#1E3A5F]">
              Alsteroid
            </h1>
          </div>
        </div>

        {/* Slogan */}
        <p className="mt-8 text-lg tracking-[0.25em] text-[#6B8BAE]">
          —— 用算法的精准，读懂星星的语言 ——
        </p>

        {/* Cards Section */}
        <div className="mt-20 flex flex-col gap-8 md:flex-row md:gap-12">
          {/* Patient Card */}
          <div className="group h-[220px] w-[340px] rounded-3xl border border-white/40 bg-white/60 p-8 shadow-lg backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
            {/* Title */}
            <h2 className="text-2xl font-bold text-[#3B82F6]">患者端</h2>
            <p className="mt-2 text-sm text-gray-500">
              为患者提供健康咨询与指导
            </p>

            {/* Spacer */}
            <div className="mt-8" />

            {/* Button */}
            <button
              onClick={() => navigate('/object-game')}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white/80 px-4 py-3 text-left shadow-sm transition-all duration-300 hover:border-[#3B82F6]/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]"
            >
              <img
                src={patientIcon}
                alt="患者端"
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="flex-1 text-sm font-medium text-gray-700">
                患者端
              </span>
              <svg
                className="h-5 w-5 text-[#3B82F6] transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Doctor Card */}
          <div className="group h-[220px] w-[340px] rounded-3xl border border-white/40 bg-white/60 p-8 shadow-lg backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
            {/* Title */}
            <h2 className="text-2xl font-bold text-[#3B82F6]">医生端</h2>
            <p className="mt-2 text-sm text-gray-500">
              为医生助力临床诊断和治疗
            </p>

            {/* Spacer */}
            <div className="mt-8" />

            {/* Button */}
            <button className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white/80 px-4 py-3 text-left shadow-sm transition-all duration-300 hover:border-[#3B82F6]/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]">
              <img
                src={doctorIcon}
                alt="医生端"
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="flex-1 text-sm font-medium text-gray-700">
                医生端
              </span>
              <svg
                className="h-5 w-5 text-[#3B82F6] transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Wave Decoration */}
      <div className="relative mt-auto h-48 w-full overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 h-48 w-full"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.08" />
              <stop offset="50%" stopColor="#5EA2FF" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            className="animate-wave-slow"
            fill="url(#waveGrad)"
            d="M0,128 C320,180 480,80 720,128 C960,176 1120,96 1440,128 L1440,200 L0,200 Z"
          />
          <path
            className="animate-wave-medium"
            fill="url(#waveGrad)"
            fillOpacity="0.6"
            d="M0,160 C240,120 540,200 720,160 C900,120 1200,200 1440,160 L1440,200 L0,200 Z"
          />
        </svg>
      </div>

      {/* Global keyframes for animations */}
      <style>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradientMove 12s ease infinite;
        }

        @keyframes waveSlow {
          0% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(-40px) translateY(-6px); }
          100% { transform: translateX(0) translateY(0); }
        }
        .animate-wave-slow {
          animation: waveSlow 8s ease-in-out infinite;
        }

        @keyframes waveMedium {
          0% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(30px) translateY(4px); }
          100% { transform: translateX(0) translateY(0); }
        }
        .animate-wave-medium {
          animation: waveMedium 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default Home
