import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowUpRight, Activity, Users, Lightbulb, Target, Sparkles, Inbox, Calendar, MessageSquare, Check, X, Clock, CheckCircle2 } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

const supabase = createClient()

const chartData = [
  { name: "Mon", views: 4 },
  { name: "Tue", views: 12 },
  { name: "Wed", views: 8 },
  { name: "Thu", views: 24 },
  { name: "Fri", views: 18 },
  { name: "Sat", views: 32 },
  { name: "Sun", views: 28 },
]

type DashboardProfile = {
  full_name: string
  role: string
  industry?: string
  is_verified?: boolean
}

type ConnectionRequest = {
  id: string
  target_id: string
  target_name: string
  status: string
}

export function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [requests, setRequests] = useState<ConnectionRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return

      // 1. Fetch User Data
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, role, industry, is_verified')
        .eq('id', user.id)
        .maybeSingle()
      
      if (userData) {
        setProfile(userData as DashboardProfile)

        // 2A. MENTOR VIEW: Fetch inbound pending requests
        if (userData.role === 'mentor' && userData.is_verified) {
          const { data: connData } = await supabase
            .from('connections')
            .select('*')
            .eq('mentor_id', user.id)
            .eq('status', 'pending')

          if (connData && connData.length > 0) {
            const founderIds = connData.map(c => c.founder_id)
            const { data: foundersData } = await supabase.from('users').select('id, full_name').in('id', founderIds)

            setRequests(connData.map(c => ({
              id: c.id,
              target_id: c.founder_id,
              status: c.status,
              target_name: foundersData?.find(f => f.id === c.founder_id)?.full_name || 'Unknown Founder'
            })))
          }
        } 
        
        // 2B. FOUNDER VIEW: Fetch outbound pending AND accepted requests
        else if (userData.role === 'founder') {
          const { data: connData } = await supabase
            .from('connections')
            .select('*')
            .eq('founder_id', user.id)
            .in('status', ['pending', 'accepted'])

          if (connData && connData.length > 0) {
            const mentorIds = connData.map(c => c.mentor_id)
            const { data: mentorsData } = await supabase.from('users').select('id, full_name').in('id', mentorIds)

            setRequests(connData.map(c => ({
              id: c.id,
              target_id: c.mentor_id,
              status: c.status,
              target_name: mentorsData?.find(m => m.id === c.mentor_id)?.full_name || 'Unknown Mentor'
            })))
          }
        }
      }
      setLoading(false)
    }
    fetchDashboardData()
  }, [user])

  // Handles Mentors updating connection statuses
  const handleRequestAction = async (connectionId: string, newStatus: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: newStatus })
        .eq('id', connectionId)

      if (error) throw error

      toast.success(`Request ${newStatus}!`)
      setRequests(prev => prev.filter(req => req.id !== connectionId))
    } catch (err: any) {
      toast.error(err.message || `Failed to update request.`)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
    )
  }

  const role = profile?.role
  const firstName = profile?.full_name?.split(' ')[0] || "there"

  // ----------------------------------------------------------------------
  // MENTOR DASHBOARD UI
  // ----------------------------------------------------------------------
  if (role === 'mentor') {
    if (!profile?.industry) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Activity className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Complete Your Profile</h2>
          <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
            Before you can access the network and receive venture matches, you must define your expertise and industry experience.
          </p>
          <Link to="/dashboard/profile" className="mt-6">
            <Button className="gap-2">Set Up Qualifications →</Button>
          </Link>
        </div>
      )
    }

    if (!profile?.is_verified) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Profile Under Review</h2>
          <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
            Your mentor profile is currently being reviewed by our team. We will notify you once your account is verified and active in the network.
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-8 pb-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">
              Mentor Node • /dashboard
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              {requests.length > 0 
                ? `You have ${requests.length} pending match request(s) awaiting your review.` 
                : "You are all caught up on match requests."}
            </p>
          </div>
          <div className="mt-4 flex gap-3 md:mt-0">
            <Link to="/dashboard/network">
              <Button className="gap-2">
                <Users className="h-4 w-4" /> Discover Founders
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="font-medium text-zinc-500">Pending Requests</CardDescription>
              <Inbox className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl font-bold">{requests.length}</CardTitle>
            </CardContent>
          </Card>
          {/* ... other mentor cards left unchanged for brevity ... */}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* DYNAMIC MATCH REQUESTS INBOX (MENTOR) */}
          <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-lg">Recent Match Requests</CardTitle>
              <CardDescription>Founders seeking your expertise.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-8 text-center dark:border-zinc-800">
                  <Inbox className="mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm text-zinc-500">No pending requests right now.</p>
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <div>
                      <h4 className="text-sm font-semibold">{req.target_name}</h4>
                      <p className="text-xs text-zinc-500">Pending Review</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-500 dark:hover:bg-red-900/20"
                        onClick={() => handleRequestAction(req.id, 'declined')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-500 dark:hover:bg-emerald-900/20"
                        onClick={() => handleRequestAction(req.id, 'accepted')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------------
  // FOUNDER DASHBOARD UI 
  // ----------------------------------------------------------------------
  
  const acceptedMentors = requests.filter(r => r.status === 'accepted')
  
  return (
    <div className="flex flex-col gap-8 pb-8">
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

      <div className="grid gap-4 md:grid-cols-3">
        {/* ... original founder cards ... */}
        <Card className="relative overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-zinc-500">Venture Health</CardDescription>
            <CardTitle className="text-3xl font-bold">78%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={78} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="font-medium text-zinc-500">Profile Views</CardDescription>
            <Activity className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-bold">126</CardTitle>
          </CardContent>
        </Card>

        <Card className="border-zinc-900 bg-zinc-900 text-zinc-50 shadow-md dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="font-medium text-zinc-400 dark:text-zinc-500">Active Mentors</CardDescription>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-bold">{acceptedMentors.length}</CardTitle>
            <Link to="/dashboard/network">
              <Button variant="link" className="mt-1 h-auto p-0 font-mono text-xs text-zinc-300 dark:text-zinc-600">
                Find more mentors →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        
        {/* NEW: MENTOR CONNECTIONS INBOX (FOUNDER) */}
        <Card className="md:col-span-4 border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg">Mentor Network</CardTitle>
            <CardDescription>Status of your outreach and active advisors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-8 text-center dark:border-zinc-800">
                <Users className="mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm text-zinc-500">You haven't requested any mentors yet.</p>
                <Link to="/dashboard/network" className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-500 hover:underline">
                  Browse the network
                </Link>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-zinc-200 dark:border-zinc-800">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${req.target_name}`} />
                      <AvatarFallback>{req.target_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-sm font-semibold">{req.target_name}</h4>
                      <p className="text-xs text-zinc-500">Mentor</p>
                    </div>
                  </div>
                  <div>
                    {req.status === 'accepted' ? (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-zinc-500">
                        <Clock className="mr-1 h-3 w-3" /> Pending Review
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ... original Action Items card ... */}
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}