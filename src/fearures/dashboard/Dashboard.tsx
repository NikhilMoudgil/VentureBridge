import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowUpRight, Activity, Users, Lightbulb, Target, Sparkles } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const supabase = createClient()

// Placeholder data for the chart to make it look active
const chartData = [
  { name: "Mon", views: 4 },
  { name: "Tue", views: 12 },
  { name: "Wed", views: 8 },
  { name: "Thu", views: 24 },
  { name: "Fri", views: 18 },
  { name: "Sat", views: 32 },
  { name: "Sun", views: 28 },
]

export function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserData() {
      if (!user) return
      const { data } = await supabase.from('users').select('full_name, role').eq('id', user.id).maybeSingle()
      if (data) setProfile(data as { full_name: string; role: string })
      setLoading(false)
    }
    fetchUserData()
  }, [user])

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
    )
  }

  const isFounder = profile?.role === 'founder'
  const firstName = profile?.full_name?.split(' ')[0] || "there"

  return (
    <div className="flex flex-col gap-8 pb-8">
      
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">
            System Active • /dashboard
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Here is the current telemetry for your venture.
          </p>
        </div>
        <div className="mt-4 flex gap-3 md:mt-0">
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" /> AI Diagnostics
          </Button>
          <Link to="/dashboard/idealab">
            <Button className="gap-2">
              <Lightbulb className="h-4 w-4" /> Update IdeaLab
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Metric 1: Health Score */}
        <Card className="relative overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-zinc-500">Venture Health</CardDescription>
            <CardTitle className="text-3xl font-bold">78%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={78} className="h-2" />
            <p className="mt-3 font-mono text-xs text-zinc-400">Ready for seed validation.</p>
          </CardContent>
        </Card>

        {/* Metric 2: Profile Views */}
        <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="font-medium text-zinc-500">Profile Views</CardDescription>
            <Activity className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-bold">126</CardTitle>
            <div className="mt-3 flex items-center gap-1 font-mono text-xs text-emerald-600 dark:text-emerald-500">
              <ArrowUpRight className="h-3 w-3" /> +14% from last week
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Mentors */}
        <Card className="border-zinc-900 bg-zinc-900 text-zinc-50 shadow-md dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="font-medium text-zinc-400 dark:text-zinc-500">Matched Mentors</CardDescription>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-bold">3</CardTitle>
            <Link to="/dashboard/network">
              <Button variant="link" className="mt-1 h-auto p-0 font-mono text-xs text-zinc-300 dark:text-zinc-600">
                View Recommendations →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid gap-4 md:grid-cols-7">
        
        {/* Chart Section (Spans 4 columns) */}
        <Card className="md:col-span-4 border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg">Network Engagement</CardTitle>
            <CardDescription>Mentors and Investors viewing your profile.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3f3f46" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3f3f46" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                    itemStyle={{ color: '#f4f4f5' }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#52525b" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Action Items (Spans 3 columns) */}
        <Card className="md:col-span-3 border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" /> Action Items
            </CardTitle>
            <CardDescription>Tasks required to reach MVP stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="flex items-start gap-4 rounded-lg border border-zinc-100 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400">1</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold">Refine Elevator Pitch</h4>
                <p className="text-xs text-zinc-500">Your current pitch is missing a clear target audience.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-lg border border-zinc-100 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400">2</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold">Connect with a Technical Mentor</h4>
                <p className="text-xs text-zinc-500">You have 3 new 90%+ matches in the Network feed.</p>
              </div>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  )
}