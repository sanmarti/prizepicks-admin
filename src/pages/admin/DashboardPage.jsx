import { useState, useCallback } from 'react'
import Chart from 'react-apexcharts'
import { getDashboard } from '../../api/dashboard'
import { useApi } from '../../hooks/useApi'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n)    => n == null ? '—' : Number(n).toLocaleString()
const fmtEur = (n)   => n == null ? '—' : `€${Number(n).toFixed(2)}`
const fmtPct = (n)   => n == null ? '—' : `${Number(n).toFixed(1)}%`

function pct(a, b) {
  if (!b) return null
  const v = ((a - b) / b) * 100
  return v
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, trend, color = 'indigo', loading }) {
  const palette = {
    indigo: { ring: 'ring-indigo-500/20', icon: 'bg-indigo-500/10 text-indigo-400', text: 'text-indigo-400' },
    green:  { ring: 'ring-green-500/20',  icon: 'bg-green-500/10 text-green-400',   text: 'text-green-400'  },
    purple: { ring: 'ring-purple-500/20', icon: 'bg-purple-500/10 text-purple-400', text: 'text-purple-400' },
    amber:  { ring: 'ring-amber-500/20',  icon: 'bg-amber-500/10 text-amber-400',   text: 'text-amber-400'  },
    rose:   { ring: 'ring-rose-500/20',   icon: 'bg-rose-500/10 text-rose-400',     text: 'text-rose-400'   },
  }
  const p = palette[color] || palette.indigo
  const trendUp = trend > 0
  return (
    <div className={`bg-[#111520] border border-white/8 rounded-2xl p-5 ring-1 ${p.ring}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${p.icon}`}>{icon}</div>
        {trend != null && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
            {trendUp ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
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

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-white font-bold text-base">{title}</h2>
      {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Mini sparkline bar chart ──────────────────────────────────────────────────
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

// ── Division badge ────────────────────────────────────────────────────────────
const DIV_COLORS = {
  1: '#f59e0b', 2: '#94a3b8', 3: '#f97316',
  4: '#6366f1', 5: '#22c55e', 6: '#ec4899',
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [range, setRange] = useState('30d')
  const [chartView, setChartView] = useState('revenue') // revenue | users | picks

  const apiFn = useCallback(() => getDashboard(range), [range])
  const { data: d, loading } = useApi(apiFn, [range])

  // Build chart series from API data
  const revenueByDay = d?.revenue?.by_day ?? []
  const userGrowth   = d?.users?.growth_by_day ?? []
  const picksTrend   = d?.engagement?.picks_trend_by_day ?? []

  const buildDaySeries = (rows, key) => {
    const last30 = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - i)
      const label = dt.toISOString().slice(0, 10)
      const row = rows.find(r => r.day?.slice(0, 10) === label)
      last30.push({ x: label, y: row ? Number(row[key]) : 0 })
    }
    return last30
  }

  const revSeries  = buildDaySeries(revenueByDay, 'revenue')
  const userSeries = buildDaySeries(userGrowth, 'new_users')
  const pickSeries = buildDaySeries(picksTrend, 'picks')

  const chartMap = {
    revenue: { series: revSeries,  color: '#f59e0b', label: 'Revenue (€)', formatter: v => `€${v.toFixed(2)}` },
    users:   { series: userSeries, color: '#6366f1', label: 'New users/day', formatter: v => v },
    picks:   { series: pickSeries, color: '#22c55e', label: 'Picks/day', formatter: v => v },
  }
  const activeChart = chartMap[chartView]

  const apexOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent', sparkline: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
    colors: [activeChart.color],
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: '#6b7280', fontSize: '10px' }, datetimeUTC: false },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: '#6b7280', fontSize: '10px' }, formatter: activeChart.formatter },
    },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
    tooltip: {
      theme: 'dark',
      x: { format: 'dd MMM' },
      y: { formatter: activeChart.formatter },
    },
    dataLabels: { enabled: false },
  }
  const apexSeries = [{ name: activeChart.label, data: activeChart.series.map(d => [new Date(d.x).getTime(), d.y]) }]

  // Revenue by month bar
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

  // Derived KPIs
  const payingPct = d ? (d.revenue.paying_users / (d.users.total || 1) * 100).toFixed(1) : null

  // Division distribution
  const divRows = d?.divisions ?? []
  const totalDiv = divRows.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-2xl tracking-tight">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Retention, engagement &amp; revenue — investor view</p>
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

      {/* KPI grid — row 1: Users */}
      <div>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Users &amp; Growth</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard loading={loading} icon="👥" label="Total registered" value={fmt(d?.users?.total)} color="indigo" />
          <KpiCard loading={loading} icon="🆕" label="New this month" value={fmt(d?.users?.new_month)} sub={`+${fmt(d?.users?.new_week)} this week`} color="indigo" />
          <KpiCard loading={loading} icon="🔥" label="Active this week" value={fmt(d?.engagement?.active_this_week)} sub="submitted picks" color="green" />
          <KpiCard loading={loading} icon="🎯" label="Participation rate" value={fmtPct(d?.engagement?.participation_rate)} sub="active / total" color="green" />
        </div>
      </div>

      {/* KPI grid — row 2: Revenue */}
      <div>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Revenue &amp; Monetisation</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard loading={loading} icon="💶" label="Total revenue" value={fmtEur(d?.revenue?.total_revenue)} color="amber" />
          <KpiCard loading={loading} icon="🛒" label="Total purchases" value={fmt(d?.revenue?.total_purchases)} sub="all time" color="amber" />
          <KpiCard loading={loading} icon="💳" label="Paying users" value={fmt(d?.revenue?.paying_users)} sub={`${payingPct}% conversion`} color="amber" />
          <KpiCard loading={loading} icon="⚡" label="Picks this week" value={fmt(d?.engagement?.total_picks_week)} sub="across all users" color="purple" />
        </div>
      </div>

      {/* Main chart */}
      <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Trends" sub="Last 30 days" />
          <div className="flex gap-1 bg-white/4 rounded-xl p-1 border border-white/8">
            {[['revenue','💶 Revenue'],['users','👥 Users'],['picks','🎯 Picks']].map(([v,l]) => (
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
            : (d?.revenue?.pack_breakdown?.length
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
            )
          }
        </div>
      </div>

      {/* Top spenders + Division distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top spenders */}
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <SectionHeader title="Top Spenders" sub="By total revenue, all time" />
          {loading
            ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-white/4 rounded-xl animate-pulse" />)}</div>
            : (d?.top_spenders?.length
              ? (
                <div className="space-y-0 divide-y divide-white/5">
                  {d.top_spenders.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3 py-2.5">
                      <span className={`text-[11px] font-black w-5 text-center flex-shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-gray-700'}`}>
                        {i + 1}
                      </span>
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
            )
          }
        </div>

        {/* Division distribution */}
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <SectionHeader title="Division Distribution" sub="Active players by tier" />
          {loading
            ? <div className="space-y-2">{[1,2,3,4,5,6].map(i => <div key={i} className="h-8 bg-white/4 rounded-xl animate-pulse" />)}</div>
            : (divRows.length
              ? (
                <div className="space-y-2.5">
                  {divRows.map(r => {
                    const pct = totalDiv > 0 ? (r.count / totalDiv) * 100 : 0
                    const color = DIV_COLORS[r.division] || '#6366f1'
                    return (
                      <div key={r.division} className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-500 w-12 flex-shrink-0">DIV {r.division}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-xs font-bold text-gray-300 w-8 text-right flex-shrink-0">{r.count}</span>
                        <span className="text-[10px] text-gray-600 w-10 text-right flex-shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                  <p className="text-gray-700 text-[10px] pt-1">{fmt(totalDiv)} total ranked players</p>
                </div>
              ) : <p className="text-gray-600 text-sm text-center py-8">No division data yet</p>
            )
          }
        </div>
      </div>

      {/* User growth sparkline row */}
      <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="User Acquisition" sub="New registrations — last 30 days" />
          <span className="text-indigo-400 text-sm font-bold">+{fmt(d?.users?.new_month)} this month</span>
        </div>
        {loading
          ? <div className="h-16 bg-white/3 rounded-xl animate-pulse" />
          : <SparkBars data={userSeries} color="#6366f1" height={64} />
        }
        <div className="flex justify-between mt-1">
          <span className="text-gray-700 text-[10px]">30 days ago</span>
          <span className="text-gray-700 text-[10px]">today</span>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-gray-700 text-[10px] text-center pb-4">
        Data refreshes on page load · Revenue tracked from energy pack purchases · Session analytics require client-side SDK integration
      </p>
    </div>
  )
}
