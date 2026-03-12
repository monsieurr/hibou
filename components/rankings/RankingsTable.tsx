'use client'
// components/rankings/RankingsTable.tsx

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ScoreMode, SummaryWithCountry } from '@/types/hibou'
import { formatScore, getSummaryScore, getSummaryRank } from '@/lib/utils/scores'
import { PILLAR_CSS, CSS, FONT } from '@/lib/tokens'
import { DisclaimerBar, IncompleteBadge, Tag, ConfidenceBadge, ScoreModeToggle } from '@/components/ui/primitives'
import { useYearSelection } from '@/hooks/useYearSelection'

interface Props {
  summaries: SummaryWithCountry[]
}

type SortKey = 'esg_score' | 'e_score' | 's_score' | 'g_score' | 'esg_rank'

export default function RankingsTable({ summaries }: Props) {
  const router = useRouter()
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('esg_rank')
  const [sortAsc,      setSortAsc]      = useState(true)
  const [filterRegion, setFilterRegion] = useState('All')
  const [filterIncome, setFilterIncome] = useState('All')
  const [scoreMode,    setScoreMode]    = useState<ScoreMode>('global')

  const { availableYears, selectedYear, setSelectedYear, yearSummaries } = useYearSelection(summaries)

  const regions = useMemo(
    () => ['All', ...new Set(yearSummaries.map((s) => s.countries?.region ?? '').filter(Boolean))],
    [yearSummaries]
  )
  const incomes = useMemo(
    () => ['All', ...new Set(yearSummaries.map((s) => s.countries?.income_group ?? '').filter(Boolean))],
    [yearSummaries]
  )

  const filtered = useMemo(() => {
    let list = yearSummaries.filter((s) => {
      const name = s.countries?.name ?? ''
      const iso2 = s.countries?.iso2 ?? ''
      if (search && !name.toLowerCase().includes(search.toLowerCase()) && !iso2.toLowerCase().includes(search.toLowerCase())) return false
      if (filterRegion !== 'All' && s.countries?.region !== filterRegion) return false
      if (filterIncome !== 'All' && s.countries?.income_group !== filterIncome) return false
      return true
    })

    list = list.sort((a, b) => {
      const getValue = (summary: SummaryWithCountry) => {
        if (sortKey === 'esg_rank') {
          return getSummaryRank(summary, 'ESG', scoreMode)
        }
        if (sortKey === 'e_score') return getSummaryScore(summary, 'E', scoreMode)
        if (sortKey === 's_score') return getSummaryScore(summary, 'S', scoreMode)
        if (sortKey === 'g_score') return getSummaryScore(summary, 'G', scoreMode)
        return getSummaryScore(summary, 'ESG', scoreMode)
      }
      const va = getValue(a) ?? (sortAsc ? Infinity : -Infinity)
      const vb = getValue(b) ?? (sortAsc ? Infinity : -Infinity)
      return sortAsc ? va - vb : vb - va
    })

    return list
  }, [yearSummaries, search, sortKey, sortAsc, filterRegion, filterIncome, scoreMode])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(key === 'esg_rank') }
  }

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th className={sortKey === col ? 'sorted' : ''} onClick={() => handleSort(col)}>
      {label} {sortKey === col ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Global ESG Rankings</h1>
        {selectedYear ? <Tag>DATA YEAR {selectedYear}</Tag> : null}
      </div>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>
        Searchable · sortable · filterable by region and income group
      </p>

      <DisclaimerBar />

      <div className="rankings-controls">
        <input
          className="search-input"
          placeholder="Search countries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {availableYears.length > 1 && (
          <select className="select-filter" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        )}
        <ScoreModeToggle mode={scoreMode} onChange={setScoreMode} />
        <select className="select-filter" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
          {regions.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select className="select-filter" value={filterIncome} onChange={(e) => setFilterIncome(e.target.value)}>
          {incomes.map((i) => <option key={i}>{i}</option>)}
        </select>
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: CSS.textDim, marginLeft: 'auto' }}>
          {filtered.length} countries
        </span>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="rankings-table">
          <thead>
            <tr>
              <SortTh col="esg_rank"  label="RANK" />
              <th>COUNTRY</th>
              <th>REGION</th>
              <th>INCOME</th>
              <SortTh col="esg_score" label="ESG" />
              <SortTh col="e_score"   label="ENV" />
              <SortTh col="s_score"   label="SOC" />
              <SortTh col="g_score"   label="GOV" />
              <th>DATA</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.country_id}
                onClick={() => router.push(`/country/${s.countries?.iso2}?year=${selectedYear}`)}
              >
                <td className="rank-num">#{getSummaryRank(s, 'ESG', scoreMode) ?? '–'}</td>
                <td>
                  <div style={{ fontWeight: 500, color: CSS.accent }}>{s.countries?.name}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim }}>{s.countries?.iso3}</div>
                </td>
                <td style={{ fontSize: 12, color: CSS.textDim }}>{s.countries?.region}</td>
                <td style={{ fontSize: 12, color: CSS.textDim }}>{s.countries?.income_group}</td>
                <td><span style={{ fontFamily: FONT.mono, fontWeight: 600, color: CSS.accent }}>{formatScore(getSummaryScore(s, 'ESG', scoreMode), 1)}</span></td>
                <td><span style={{ fontFamily: FONT.mono, fontSize: 12, color: PILLAR_CSS.E }}>{formatScore(getSummaryScore(s, 'E', scoreMode), 1)}</span></td>
                <td><span style={{ fontFamily: FONT.mono, fontSize: 12, color: PILLAR_CSS.S }}>{formatScore(getSummaryScore(s, 'S', scoreMode), 1)}</span></td>
                <td><span style={{ fontFamily: FONT.mono, fontSize: 12, color: PILLAR_CSS.G }}>{formatScore(getSummaryScore(s, 'G', scoreMode), 1)}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {!s.data_complete && <IncompleteBadge />}
                    <ConfidenceBadge coverage={s.esg_coverage} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
