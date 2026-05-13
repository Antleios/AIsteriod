function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <span className="whitespace-nowrap text-sm font-medium text-gray-500">
        今日训练
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#5EA2FF] to-[#3B82F6] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="min-w-[4rem] text-right text-sm font-semibold text-[#3B82F6]">
        {current}/{total}
      </span>
    </div>
  )
}

export default ProgressBar
