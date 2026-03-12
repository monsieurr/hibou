// hooks/useYearSelection.ts
// Shared helper for year selection across views.

import { useEffect, useMemo, useState } from 'react'
import type { SummaryWithCountry } from '@/types/hibou'

export function useYearSelection(summaries: SummaryWithCountry[]) {
  const availableYears = useMemo(() => {
    const years = [...new Set(summaries.map((s) => s.year))].sort((a, b) => b - a)
    return years
  }, [summaries])

  const mostCompleteYear = useMemo(() => {
    const counts = new Map<number, number>()
    for (const s of summaries) {
      counts.set(s.year, (counts.get(s.year) ?? 0) + 1)
    }
    let bestYear = availableYears[0] ?? 0
    let bestCount = -1
    for (const year of availableYears) {
      const count = counts.get(year) ?? 0
      if (count > bestCount) {
        bestCount = count
        bestYear = year
      }
    }
    return bestYear
  }, [summaries, availableYears])

  const [selectedYear, setSelectedYear] = useState<number>(() => mostCompleteYear ?? 0)

  useEffect(() => {
    if (!selectedYear || !availableYears.includes(selectedYear)) {
      const next = mostCompleteYear ?? availableYears[0] ?? 0
      if (next) setSelectedYear(next)
    }
  }, [availableYears, mostCompleteYear, selectedYear])

  const yearSummaries = useMemo(
    () => summaries.filter((s) => s.year === selectedYear),
    [summaries, selectedYear]
  )

  return { availableYears, mostCompleteYear, selectedYear, setSelectedYear, yearSummaries }
}
