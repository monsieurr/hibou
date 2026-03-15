// app/rankings/page.tsx : Global Rankings
import { getAllSummariesAllYears } from '@/lib/data/repository'
import RankingsTable from '@/components/rankings/RankingsTable'

export const revalidate = 3600
export const metadata = { title: 'Global Rankings : Hibou ESG' }

export default async function RankingsPage() {
  const summaries = await getAllSummariesAllYears()
  return <RankingsTable summaries={summaries} />
}
