// app/compare/page.tsx — Country Comparison
import { getAllSummariesAllYears } from '@/lib/data/repository'
import CompareView from '@/components/compare/CompareView'

export const revalidate = 3600
export const metadata = { title: 'Compare Countries — Hibou ESG' }

export default async function ComparePage() {
  const summaries = await getAllSummariesAllYears()
  return <CompareView allSummaries={summaries} />
}
