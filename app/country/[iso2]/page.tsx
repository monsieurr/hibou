// app/country/[iso2]/page.tsx — Country Profile
// Next.js 16: params is a Promise — must await props.params
import { notFound } from 'next/navigation'
import {
  getCountryContext,
  getCountryInfo,
  getCountryStatsAsOf,
  getSummariesByIso2,
  getScoresByCountryYear,
} from '@/lib/data/repository'
import CountryProfile from '@/components/profile/CountryProfile'

export const revalidate = 3600

interface Props {
  params: Promise<{ iso2: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: Props) {
  const { iso2 } = await props.params
  return { title: `${iso2.toUpperCase()} ESG Profile — Hibou` }
}

export default async function CountryPage(props: Props) {
  const { iso2 } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const result = await getSummariesByIso2(iso2)
  if (!result) notFound()

  const { country, summaries } = result
  const availableYears = summaries.map((s) => s.year).sort((a, b) => b - a)
  const requestedYear = Array.isArray(searchParams?.year)
    ? searchParams?.year[0]
    : searchParams?.year
  const yearNumber = requestedYear ? Number(requestedYear) : null
  const selectedYear = yearNumber && availableYears.includes(yearNumber)
    ? yearNumber
    : availableYears[0]
  const summary = summaries.find((s) => s.year === selectedYear) ?? summaries[0]
  const latestNarrativeSummary = summaries.find((s) => s.narrative) ?? summaries[0]
  const narrative = latestNarrativeSummary?.narrative ?? null
  const narrativeYear = latestNarrativeSummary?.year ?? null
  const scores = await getScoresByCountryYear(country.id, summary.year)
  const context = await getCountryContext(country.id)
  const info = await getCountryInfo(country.id)
  const stats = await getCountryStatsAsOf(country.id, summary.year)

  return (
    <CountryProfile
      country={country}
      summary={summary}
      scores={scores}
      context={context}
      info={info}
      stats={stats}
      narrative={narrative}
      narrativeYear={narrativeYear}
      availableYears={availableYears}
      selectedYear={summary.year}
    />
  )
}
