// app/page.tsx — World Map
// DEV-02: passes all years to the WorldMap so the year selector has full data
import { getAllSummariesAllYears } from '@/lib/data/repository'
import WorldMap from '@/components/map/WorldMap'

export const revalidate = 3600

export default async function MapPage() {
  // All years, not deduped — WorldMap derives available years and filters client-side
  const allSummaries = await getAllSummariesAllYears()
  return <WorldMap allSummaries={allSummaries} />
}
