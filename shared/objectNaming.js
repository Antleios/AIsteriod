function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\s，。！、,.!；;：:…～“”‘’"'()（）]/gu, '')
}

// Strip only known answer framing, never accept arbitrary substring matches.
// Negations, alternatives and compound nouns remain and therefore cannot pass.
export function matchesObjectAnswer(answer, acceptedAnswers) {
  let candidate = normalize(answer)
  if (!candidate) return false
  const expected = acceptedAnswers.map(normalize).filter(Boolean)
  if (expected.includes(candidate)) return true

  const framing = /^(?:我觉得|我认为|我猜|我想|应该是|可能是|好像是|好像|看起来像是|看起来像|看着像|看上去像是|看上去像|图片上的物品是|图片上的是|图片里的是|图中的是|图上的是|图片上|图片里|图中|图上|这个东西|这个物品|这个|这张图|它|这|那|是|像|有)/u
  let previous
  do {
    previous = candidate
    candidate = candidate.replace(framing, '')
  } while (candidate !== previous)
  candidate = candidate.replace(/^(?:一个|一只|一条|一辆|一把|一本|一杯|一朵|一棵|一部|一台|一双)/u, '')
    .replace(/[呀啊呢哦吧]+$/u, '')
  return expected.includes(candidate)
}
