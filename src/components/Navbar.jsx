function Navbar() {
  return (
    <nav className="flex items-center justify-between px-12 py-6">
      {/* Left: Brand Name */}
      <span className="text-2xl font-bold text-[#3B82F6]">Alsteroid</span>

      {/* Right: Nav Links */}
      <div className="flex items-center gap-8">
        <button className="rounded-full bg-[#EAF4FF] px-5 py-2 text-sm font-medium text-[#3B82F6] transition-all hover:bg-[#3B82F6] hover:text-white hover:shadow-lg">
          获取手机App
        </button>
        <button className="text-sm font-medium text-gray-600 transition-colors hover:text-[#3B82F6]">
          English
        </button>
      </div>
    </nav>
  )
}

export default Navbar
