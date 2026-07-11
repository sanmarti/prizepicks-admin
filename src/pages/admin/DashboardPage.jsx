import { useState, useCallback } from 'react'
import Chart from 'react-apexcharts'
import { getDashboard } from '../../api/dashboard'
import { useApi } from '../../hooks/useApi'

const fmt    = (n) => n == null ? '—' : Number(n).toLocaleString()
const fmtEur = (n) => n == null ? '—' : `€${Number(n).toFixed(2)}`
const fmtPct = (n) => n == null ? '—' : `${Number(n).toFixed(1)}%`

function KpiCard({ icon, label, value, sub, color = 'indigo', loading }) {
  const palette = {
    indigo: { ring: 'ring-indigo-500/20',  icon: 'bg-indigo-500/10 text-indigo-400',  text: 'text-indigo-400'  },
    green:  { ring: 'ring-green-500/20',   icon: 'bg-green-500/10 text-green-400',    text: 'text-green-400'   },
    purple: { ring: 'ring-purple-500/20',  icon: 'bg-purple-500/10 text-purple-400',  text: 'text-purple-400'  },
    amber:  { ring: 'ring-amber-500/20',   icon: 'bg-amber-500/10 text-amber-400',    text: 'text-amber-400'   },
    rose:   { ring: 'ring-rose-500/20',    icon: 'bg-rose-500/10 text-rose-400',      text: 'text-rose-400'    },
    sky:    { ring: 'ring-sky-500/20',     icon: 'bg-sky-500/10 text-sky-400',        text: 'text-sky-400'     },
    yellow: { ring: 'ring-yellow-500/20',  icon: 'bg-yellow-500/10 text-yellow-400',  text: 'text-yellow-400'  },
  }
  const p = palette[color] || palette.indigo
  return (
    <div className={`bg-[#111520] border border-white/8 rounded-2xl p-5 ring-1 ${p.ring}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${p.icon}`}>{icon}</div>
      </div>
      {loading
        ? <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse mb-2" />
        : <p className="text-3xl font-black text-white tracking-tight">{value ?? '—'}</p>
      }
      <p className="text-gray-500 text-xs mt-1">{label}</p>
      {sub && <p className={`text-[11px] font-semibold mt-0.5 ${p.text}`}>{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-white font-bold text-base">{title}</h2>
      {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function SparkBars({ data, color = '#6366f1', height = 60 }) {
  if (!data?.length) return <div style={{ height }} className="flex items-center justify-center text-gray-700 text-xs">No data</div>
  const max = Math.max(...data.map(d => d.y), 1)
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.x}: ${d.y}`}
          className="flex-1 rounded-sm transition-all hover:opacity-80"
          style={{ height: `${Math.max((d.y / max) * 100, 2)}%`, background: color, minWidth: 2 }}
        />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [range, setRange]         = useState('30d')
  const [chartView, setChartView] = useState('picks')

  const apiFn = useCallback(() => getDashboard(range), [range])
  const { data: d, loading } = useApi(apiFn, [range])

  const days = d?.days ?? (range === '7d' ? 7 : range === '90d' ? 90 : 30)

  const buildDaySeries = (rows, key) => {
    const result = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - i)
      const label = dt.toISOString().slice(0, 10)
      const row = rows.find(r => r.day?.slice(0, 10) === label)
      result.push({ x: label, y: row ? Number(row[key]) : 0 })
    }
    return result
  }

  const revenueByDay = d?.revenue?.by_day                   ?? []
  const userGrowth   = d?.users?.growth_by_day               ?? []
  const picksTrend   = d?.engagement?.picks_trend_by_day     ?? []
  const dauTrend     = d?.engagement?.dau_by_day             ?? []

  const revSeries  = buildDaySeries(revenueByDay, 'revenue')
  const userSeries = buildDaySeries(userGrowth,   'new_users')
  const pickSeries = buildDaySeries(picksTrend,   'picks')
  const dauSeries  = buildDaySeries(dauTrend,     'dau')

  const chartMap = {
    revenue: { series: revSeries,  color: '#f59e0b', label: 'Revenue (€)',    formatter: v => `€${v.toFixed(2)}` },
    users:   { series: userSeries, color: '#6366f1', label: 'New users/day',  formatter: v => String(v) },
    picks:   { series: pickSeries, color: '#22c55e', label: 'Picks/day',      formatter: v => String(v) },
    dau:     { series: dauSeries,  color: '#38bdf8', label: 'Active users/day', formatter: v => String(v) },
  }
  const activeChart = chartMap[chartView]

  const apexOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
    colors: [activeChart.color],
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: '#6b7280', fontSize: '10px' }, datetimeUTC: false },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#6b7280', fontSize: '10px' }, formatter: activeChart.formatter } },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
    tooltip: { theme: 'dark', x: { format: 'dd MMM' }, y: { formatter: activeChart.formatter } },
    dataLabels: { enabled: false },
  }
  const apexSeries = [{ name: activeChart.label, data: activeChart.series.map(p => [new Date(p.x).getTime(), p.y]) }]

  const monthlyRev = d?.revenue?.by_month ?? []
  const monthOptions = {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    colors: ['#f59e0b'],
    xaxis: { categories: monthlyRev.map(r => r.month?.slice(5)), labels: { style: { colors: '#6b7280', fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: '#6b7280', fontSize: '10px' }, formatter: v => `€${v.toFixed(0)}` } },
    grid: { borderColor: 'rgba(255,255,255,0.05)' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: v => `€${v.toFixed(2)}` } },
  }
  const monthSeries = [{ name: 'Revenue', data: monthlyRev.map(r => Number(r.revenue)) }]

  const payingPct  = d ? ((d.revenue.paying_users / (d.users.total || 1)) * 100).toFixed(1) : null
  const divRows    = d?.divisions ?? []
  const totalDiv   = divRows.reduce((s, r) => s + Number(r.count), 0)
  const sp         = d?.current_sprint ?? null
  const spSettled  = sp ? (Number(sp.sprint_correct) + Number(sp.sprint_incorrect)) : 0
  const spAccuracy = spSettled > 0 ? Math.round((Number(sp.sprint_correct) / spSettled) * 1000) / 10 : null

  const rangeLabel = range === '7d' ? 'last 7 days' : range === '90d' ? 'last 90 days' : 'last 30 days'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-2xl tracking-tight">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Retention, engagement &amp; revenue</p>
        </div>
        <div className="flex gap-1 bg-white/4 rounded-xl p-1 border border-white/8">
          {[['7d','7D'],['30d','30D'],['90d','90D']].map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${range === v ? 'bg-white/12 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Current sprint banner */}
      {(loading || sp) && (
        <div className="bg-[#111520] border border-indigo-500/20 rounded-2xl p-5">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Current Sprint</p>
          {loading
            ? <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
            : sp ? (
              <div className="flex flex-wrap gap-6 items-start">
                <div>
                  <p className="text-white font-black text-lg">{sp.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5 capitalize">{sp.status}</p>
                </div>
                <div className="flex gap-4 flex-wrap">
                  {[
                    { label: 'Active players', value: fmt(sp.active_players), color: 'text-indigo-400' },
                    { label: 'Correct picks',  value: fmt(sp.sprint_correct),  color: 'text-green-400'  },
                    { label: 'Accuracy',       value: spAccuracy != null ? `${spAccuracy}%` : '—', color: 'text-emerald-400' },
                    { label: 'Top LP',         value: fmt(sp.top_lp),          color: 'text-yellow-400' },
                    { label: 'Perfect weeks',  value: fmt(sp.sprint_perfect_weeks), color: 'text-amber-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className={`font-black text-xl ${color}`}>{value}</p>
                      <p className="text-gray-600 text-[10px] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 ml-auto flex-wrap">
                  {[
                    { label: 'Open',     count: sp.gw_open,     color: 'bg-green-500/15 text-green-400 border-green-500/25'   },
                    { label: 'Locked',   count: sp.gw_locked,   color: 'bg-amber-500/15 text-amber-400 border-amber-500/25'   },
                    { label: 'Finished', count: sp.gw_finished, color: 'bg-gray-500/15 text-gray-400 border-gray-500/25'       },
                  ].map(({ label, count, color }) => (
                    <div key={label} className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${color}`}>
                      {label} <span className="font-black">{count}</span>/{sp.gw_total}
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-gray-600 text-sm">No active sprint</p>
          }
        </div>
      )}

      {/* KPI row 1: Users */}
      <div>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Users &amp; Growth</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard loading={loading} icon="👥" label="Total registered" value={fmt(d?.users?.total)} color="indigo" />
          <KpiCard loading={loading} icon="🆕" label={`New (${rangeLabel})`} value={fmt(d?.users?.new_month)} sub={`+${fmt(d?.users?.new_week)} last 7 days`} color="indigo" />
          <KpiCard loading={loading} icon="🔥" label={`Active (${rangeLabel})`} value={fmt(d?.engagement?.active_in_range)} sub="submitted picks" color="green" />
          <KpiCard loading={loading} icon="🎯" label="Participation rate" value={fmtPct(d?.engagement?.participation_rate)} sub={`vs total users`} color="green" />
        </div>
      </div>

      {/* KPI row 2: Game health */}
      <div>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Game Health</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard loading={loading} icon="🎮" label="Total picks ever" value={fmt(d?.game?.total_picks_ever)} sub={`${fmt(d?.engagement?.total_picks_range)} in range`} color="purple" />
          <KpiCard loading={loading} icon="✅" label="Correct picks ever" value={fmt(d?.game?.total_correct_ever)} sub={`${fmtPct(d?.game?.accuracy_pct)} avg accuracy`} color="sky" />
          <KpiCard loading={loading} icon="⭐" label="Perfect weeks ever" value={fmt(d?.game?.total_perfect_weeks)} color="yellow" />
          <KpiCard loading={loading} icon="🏟️" label="Players with picks" value={fmt(d?.game?.total_players_ever)} color="purple" />
        </div>
      </div>

      {/* KPI row 3: Revenue */}
      <div>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Revenue &amp; Monetisation</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard loading={loading} icon="💶" label="Total revenue" value={fmtEur(d?.revenue?.total_revenue)} color="amber" />
          <KpiCard loading={loading} icon="🛒" label="Total purchases" value={fmt(d?.revenue?.total_purchases)} sub="all time" color="amber" />
          <KpiCard loading={loading} icon="💳" label="Paying users" value={fmt(d?.revenue?.paying_users)} sub={`${payingPct}% conversion`} color="amber" />
          <KpiCard loading={loading} icon="⚡" label={`Picks (${rangeLabel})`} value={fmt(d?.engagement?.total_picks_range)} color="purple" />
        </div>
      </div>

      {/* Main chart */}
      <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Trends" sub={`Last ${days} days`} />
          <div className="flex gap-1 bg-white/4 rounded-xl p-1 border border-white/8">
            {[['picks','🎯 Picks'],['users','👥 New users'],['dau','🟢 Daily active'],['revenue','💶 Revenue']].map(([v,l]) => (
              <button key={v} onClick={() => setChartView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${chartView === v ? 'bg-white/12 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {loading
          ? <div className="h-[220px] flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
          : <Chart options={apexOptions} series={apexSeries} type="area" height={220} />
        }
      </div>

      {/* Revenue by month + Pack breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <SectionHeader title="Monthly Revenue" sub="Last 12 months" />
          {loading
            ? <div className="h-[160px] flex items-center justify-center"><div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
            : monthlyRev.length
              ? <Chart options={monthOptions} series={monthSeries} type="bar" height={160} />
              : <p className="text-gray-600 text-sm text-center py-8">No purchase data yet</p>
          }
        </div>

        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <SectionHeader title="Pack Sales" sub="Revenue by product" />
          {loading
            ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-white/4 rounded-xl animate-pulse" />)}</div>
            : d?.revenue?.pack_breakdown?.length
              ? (
                <div className="space-y-2">
                  {d.revenue.pack_breakdown.map((p, i) => {
                    const maxRev = Math.max(...d.revenue.pack_breakdown.map(x => x.revenue), 1)
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-200 text-xs font-semibold truncate">{p.name}</span>
                            <span className="text-amber-400 text-xs font-bold flex-shrink-0 ml-2">{fmtEur(p.revenue)}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                          </div>
                          <p className="text-gray-600 text-[10px] mt-0.5">{p.units_sold} sold · ⚡{p.energy_amount} energy · €{Number(p.price_euros).toFixed(2)} each</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-gray-600 text-sm text-center py-8">No pack purchases yet</p>
          }
        </div>
      </div>

      {/* Top spenders + Division distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <SectionHeader title="Top Spenders" sub="By total revenue, all time" />
          {loading
            ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-white/4 rounded-xl animate-pulse" />)}</div>
            : d?.top_spenders?.length
              ? (
                <div className="divide-y divide-white/5">
                  {d.top_spenders.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3 py-2.5">
                      <span className={`text-[11px] font-black w-5 text-center flex-shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-gray-700'}`}>{i + 1}</span>
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 flex-shrink-0">
                        {(u.display_name || u.email)?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200 text-xs font-semibold truncate">{u.display_name || u.email}</p>
                        <p className="text-gray-600 text-[10px]">{u.purchases} purchase{u.purchases !== 1 ? 's' : ''} · ⚡{fmt(u.energy_bought)}</p>
                      </div>
                      <span className="text-amber-400 font-bold text-sm flex-shrink-0">{fmtEur(u.total_spent)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-600 text-sm text-center py-8">No purchases yet</p>
          }
        </div>

        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <SectionHeader title="Division Distribution" sub="Current players by tier" />
          {loading
            ? <div className="space-y-2">{[1,2,3,4,5,6].map(i => <div key={i} className="h-8 bg-white/4 rounded-xl animate-pulse" />)}</div>
            : divRows.length
              ? (
                <div className="space-y-2.5">
                  {divRows.map(r => {
                    const share = totalDiv > 0 ? (Number(r.count) / totalDiv) * 100 : 0
                    const color = r.color_primary || '#6366f1'
                    return (
                      <div key={r.display_order} className="flex items-center gap-3">
                        <span className="text-base flex-shrink-0 w-6 text-center leading-none">{r.icon}</span>
                        <span className="text-[10px] font-semibold text-gray-500 w-24 flex-shrink-0 truncate">{r.name}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, background: color }} />
                        </div>
                        <span className="text-xs font-bold text-gray-300 w-8 text-right flex-shrink-0">{r.count}</span>
                        <span className="text-[10px] text-gray-600 w-10 text-right flex-shrink-0">{share.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                  <p className="text-gray-700 text-[10px] pt-1">{fmt(totalDiv)} total players</p>
                </div>
              ) : <p className="text-gray-600 text-sm text-center py-8">No division data yet</p>
          }
        </div>
      </div>

      {/* User acquisition sparkline */}
      <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="User Acquisition" sub={`New registrations — ${rangeLabel}`} />
          <span className="text-indigo-400 text-sm font-bold">+{fmt(d?.users?.new_month)} in range</span>
        </div>
        {loading
          ? <div className="h-16 bg-white/3 rounded-xl animate-pulse" />
          : <SparkBars data={userSeries} color="#6366f1" height={64} />
        }
        <div className="flex justify-between mt-1">
          <span className="text-gray-700 text-[10px]">{days} days ago</span>
          <span className="text-gray-700 text-[10px]">today</span>
        </div>
      </div>

      <p className="text-gray-700 text-[10px] text-center pb-4">
        Data refreshes on page load · Range selector applies to growth, picks and revenue trend charts
      </p>
    </div>
  )
}
