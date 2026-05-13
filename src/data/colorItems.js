const colorPalette = [
  { color: '#FF6B6B', name: '红色' },
  { color: '#4A90D9', name: '蓝色' },
  { color: '#2ECC71', name: '绿色' },
  { color: '#F1C40F', name: '黄色' },
  { color: '#9B59B6', name: '紫色' },
]

function generateColorRound() {
  const items = []
  const cols = 5
  const rows = 2
  const areaW = 82
  const areaH = 70

  // assign each color to a column, then shuffle column order
  const colOrder = [...Array(cols).keys()]
  for (let i = colOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[colOrder[i], colOrder[j]] = [colOrder[j], colOrder[i]]
  }

  let id = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ci = colOrder[c]
      const x = (c / cols) * areaW + (areaW / cols) * 0.3 + Math.random() * (areaW / cols) * 0.4
      const y = (r / rows) * areaH + (areaH / rows) * 0.25 + Math.random() * (areaH / rows) * 0.3
      items.push({
        id: id++,
        color: colorPalette[ci].color,
        label: colorPalette[ci].name,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        shape: r === 0 ? 'circle' : 'square',
      })
    }
  }

  return items
}

export { colorPalette, generateColorRound }
