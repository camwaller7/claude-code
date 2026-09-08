'use client'

import { useMemo, useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Minus, DollarSign, MessageCircle, Users, Send, Inbox, Star, Zap } from 'lucide-react'
import type { Platform } from '@/types'

interface Props {
  paidDeals: { deal_value: number | null; created_at: string }[]
  pipelineDeals: { deal_value: number | null; status: string }[]
  allDeals: { status: string; deal_value: number | null; created_at: string }[]
  allConversations: { platform: string; category: string; status: string; last_message_at: string; created_at: string }[]
  allClients: { status: string; created_at: string }[]
  allPosts: { status: string; created_at: string; scheduled_at: string | null }[]
  recentMessages: { created_at: string; direction: string; platform: string | null }[]
  linkedPlatforms: Platform[]
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  tiktok: 'TikTok',
  gmail: 'Gmail',
  telegram: 'Telegram',
}

// Every messaging-capable platform a creator can link — always offered as a
// dashboard filter (Threads/TikTok are excluded as they have no inbox/DM API).
const FILTERABLE_PLATFORMS: Platform[] = ['instagram', 'facebook', 'x', 'gmail', 'telegram']

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n}`
}

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function getShortDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short' })
}

const CATEGORY_COLORS: Record<string, string> = {
  brand_deal: '#a78bfa',
  client: '#34d399',
  fan: '#60a5fa',
  personal: '#fbbf24',
  spam: '#f87171',
  uncategorized: '#94a3b8',
}

const DEAL_COLORS: Record<string, string> = {
  inquiry: '#60a5fa',
  negotiating: '#a78bfa',
  contracted: '#f59e0b',
  delivered: '#34d399',
  paid: '#10b981',
  lost: '#f87171',
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
  trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className={`ring-hairline card-elevated rounded-2xl p-4 flex flex-col gap-3 ${color}`}>
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-white/20 p-2">
          <Icon className="h-4 w-4 text-white" />
        </div>
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-white/80" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-white/80" />}
        {trend === 'flat' && <Minus className="h-4 w-4 text-white/80" />}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs font-medium text-white/80 mt-0.5">{label}</p>
      </div>
      <p className="text-xs text-white/60">{sub}</p>
    </div>
  )
}

export function DashboardClient({ paidDeals, pipelineDeals, allDeals, allConversations, allClients, allPosts, recentMessages, linkedPlatforms }: Props) {
  // Platform filter — scopes the inbox/message widgets to a single linked
  // account. Only linked platforms are offered (plus "All"). Financial widgets
  // (revenue, pipeline, clients, posts) are not platform-specific and stay global.
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const conversations = useMemo(
    () => (platform === 'all' ? allConversations : allConversations.filter(c => c.platform === platform)),
    [allConversations, platform]
  )
  const messages = useMemo(
    () => (platform === 'all' ? recentMessages : recentMessages.filter(m => m.platform === platform)),
    [recentMessages, platform]
  )

  const totalRevenue = paidDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const pipelineValue = pipelineDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const wonDeals = allDeals.filter(d => d.status === 'paid').length
  const closedDeals = allDeals.filter(d => ['paid', 'lost'].includes(d.status)).length
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0
  const needsReply = conversations.filter(c => c.status === 'needs_reply').length
  const activeClients = allClients.filter(c => c.status === 'active').length
  const publishedPosts = allPosts.filter(p => p.status === 'published').length
  const scheduledPosts = allPosts.filter(p => p.status === 'scheduled').length
  const brandDeals = conversations.filter(c => c.category === 'brand_deal').length

  // Messages per day for last 7 days
  const days = getLast7Days()
  const messagesByDay = useMemo(() => days.map(day => ({
    day: getShortDay(day),
    inbound: messages.filter(m => m.created_at.startsWith(day) && m.direction === 'inbound').length,
    outbound: messages.filter(m => m.created_at.startsWith(day) && m.direction === 'outbound').length,
  })), [messages])

  // Revenue trend (deals paid per day)
  const revByDay = useMemo(() => days.map(day => ({
    day: getShortDay(day),
    revenue: paidDeals.filter(d => d.created_at.startsWith(day)).reduce((s, d) => s + (d.deal_value ?? 0), 0),
  })), [paidDeals])

  // Inbox category breakdown
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {}
    conversations.forEach(c => { counts[c.category] = (counts[c.category] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [conversations])

  // Deal pipeline breakdown
  const dealPipelineData = useMemo(() => {
    const counts: Record<string, number> = {}
    allDeals.forEach(d => { counts[d.status] = (counts[d.status] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [allDeals])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting} ✨</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s how your creator business is doing today</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5">
          <Zap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Live data</span>
        </div>
      </div>

      {/* Platform filter — all linkable messaging platforms, plus any others the
          user has actually connected. Scopes the inbox and message widgets. */}
      {(() => {
        const options = Array.from(new Set<Platform>([...FILTERABLE_PLATFORMS, ...linkedPlatforms]))
        return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1">Platform:</span>
          {(['all', ...options] as const).map(value => (
            <button
              key={value}
              onClick={() => setPlatform(value as Platform | 'all')}
              className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${
                platform === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:bg-accent'
              }`}
            >
              {value === 'all' ? 'All' : PLATFORM_LABELS[value] ?? value}
            </button>
          ))}
        </div>
        )
      })()}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={DollarSign} label="Total Revenue" value={fmt(totalRevenue)} sub="from paid deals" color="bg-gradient-to-br from-violet-500 to-purple-600" trend="up" />
        <StatCard icon={TrendingUp} label="Pipeline" value={fmt(pipelineValue)} sub="deals in progress" color="bg-gradient-to-br from-blue-500 to-cyan-500" trend="up" />
        <StatCard icon={Star} label="Win Rate" value={`${winRate}%`} sub={`${wonDeals} won · ${closedDeals - wonDeals} lost`} color="bg-gradient-to-br from-amber-400 to-orange-500" trend={winRate >= 50 ? 'up' : 'down'} />
        <StatCard icon={Users} label="Active Clients" value={String(activeClients)} sub="course & coaching" color="bg-gradient-to-br from-emerald-400 to-teal-500" trend="flat" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Inbox} label="Needs Reply" value={String(needsReply)} sub={`${conversations.length} total threads`} color="bg-gradient-to-br from-pink-500 to-rose-500" trend={needsReply > 5 ? 'up' : 'flat'} />
        <StatCard icon={MessageCircle} label="Brand Deals" value={String(brandDeals)} sub="in your inbox" color="bg-gradient-to-br from-indigo-500 to-violet-500" trend="up" />
        <StatCard icon={Send} label="Posts Published" value={String(publishedPosts)} sub={`${scheduledPosts} scheduled`} color="bg-gradient-to-br from-sky-400 to-blue-500" trend="flat" />
        <StatCard icon={Zap} label="Total Threads" value={fmtNum(conversations.length)} sub={platform === 'all' ? 'across all platforms' : `on ${PLATFORM_LABELS[platform] ?? platform}`} color="bg-gradient-to-br from-fuchsia-500 to-pink-500" trend="up" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Message activity */}
        <div className="rounded-2xl border bg-card card-elevated p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold">Message Activity</p>
            <p className="text-xs text-muted-foreground">Inbound vs replies — last 7 days</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={messagesByDay}>
              <defs>
                <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Area type="monotone" dataKey="inbound" stroke="#a78bfa" strokeWidth={2} fill="url(#inboundGrad)" name="Received" />
              <Area type="monotone" dataKey="outbound" stroke="#34d399" strokeWidth={2} fill="url(#outboundGrad)" name="Replied" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-violet-400" /><span className="text-xs text-muted-foreground">Received</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-xs text-muted-foreground">Replied</span></div>
          </div>
        </div>

        {/* Revenue chart */}
        <div className="rounded-2xl border bg-card card-elevated p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold">Revenue Activity</p>
            <p className="text-xs text-muted-foreground">Deals paid — last 7 days</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revByDay}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#a78bfa" radius={[6, 6, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: pie charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Inbox breakdown */}
        <div className="rounded-2xl border bg-card card-elevated p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold">Inbox Breakdown</p>
            <p className="text-xs text-muted-foreground">Messages by category</p>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={0}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {categoryData.map(entry => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[entry.name] ?? '#94a3b8' }} />
                  <span className="text-xs capitalize text-muted-foreground">{entry.name.replace('_', ' ')}</span>
                  <span className="text-xs font-semibold ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deal pipeline */}
        <div className="rounded-2xl border bg-card card-elevated p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold">Deal Pipeline</p>
            <p className="text-xs text-muted-foreground">Deals by stage</p>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={dealPipelineData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={0}>
                  {dealPipelineData.map((entry) => (
                    <Cell key={entry.name} fill={DEAL_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {dealPipelineData.map(entry => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: DEAL_COLORS[entry.name] ?? '#94a3b8' }} />
                  <span className="text-xs capitalize text-muted-foreground">{entry.name}</span>
                  <span className="text-xs font-semibold ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
