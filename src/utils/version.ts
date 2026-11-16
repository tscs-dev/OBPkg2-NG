export function compareVersionsDesc(a: string, b: string): number {
  const partsA = a.split('.').map((n) => Number.parseInt(n, 10))
  const partsB = b.split('.').map((n) => Number.parseInt(n, 10))
  const len = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < len; i++) {
    const numA = Number.isFinite(partsA[i]) ? partsA[i]! : 0
    const numB = Number.isFinite(partsB[i]) ? partsB[i]! : 0
    if (numA !== numB) {
      return numB - numA
    }
  }
  return b.localeCompare(a)
}
