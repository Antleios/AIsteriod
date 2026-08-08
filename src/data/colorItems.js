const colorPalette = [
  { color: '#FF6B6B', name: '红色' },
  { color: '#4A90D9', name: '蓝色' },
  { color: '#2ECC71', name: '绿色' },
  { color: '#F1C40F', name: '黄色' },
  { color: '#9B59B6', name: '紫色' },
]

function shuffle(items) {
  const shuffled = [...items]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

function generateOppositeOrder(firstOrder) {
  if (firstOrder.length < 2) return [...firstOrder]

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = shuffle(firstOrder)
    const hasAlignedColor = candidate.some(
      (colorIndex, columnIndex) => colorIndex === firstOrder[columnIndex],
    )

    if (!hasAlignedColor) return candidate
  }

  return [...firstOrder.slice(1), firstOrder[0]]
}

function generateColorRound(palette = colorPalette) {
  const activePalette = palette.length ? palette : colorPalette
  const items = []
  const cols = activePalette.length
  const rows = 2
  const areaW = 82
  const areaH = 70

  const firstOrder = shuffle([...Array(cols).keys()])
  const rowOrders = [firstOrder, generateOppositeOrder(firstOrder)]

  let id = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ci = rowOrders[r][c]
      const x = (c / cols) * areaW + (areaW / cols) * 0.3 + Math.random() * (areaW / cols) * 0.4
      const y = (r / rows) * areaH + (areaH / rows) * 0.25 + Math.random() * (areaH / rows) * 0.3
      items.push({
        id: id++,
        color: activePalette[ci].color,
        label: activePalette[ci].name,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        shape: r === 0 ? 'circle' : 'square',
      })
    }
  }

  return items
}

export { colorPalette, generateColorRound }
