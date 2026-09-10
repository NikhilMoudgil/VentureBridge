import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Lightbulb, Clock, CheckCircle2, ArrowRight, Rocket, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"

const supabase = createClient()

export function Dashboard() {
  const { user } = useAuth()
  const [role, setRole] = useState<'founder' | 'mentor' | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    connectionsCount: 0,
    ideasCount: 0,
    isVerified: true
  })

  useEffect(() => {
    async function loadRoleAndStats() {
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        const userRole = userData.role
        setRole(userRole)

        if (userRole === 'founder') {
          const { count: ideasCount } = await supabase
            .from('ideas')
            .select('*', { count: 'exact', head: true })
            .or(`id.eq.${user.id},owner_id.eq.${user.id}`)

          const { count: connCount } = await supabase
            .from('connections')
            .select('*', { count: 'exact', head: true })
            .eq('founder_id', user.id)

          setStats({
            connectionsCount: connCount || 0,
            ideasCount: ideasCount || 0,
            isVerified: true
          })
        } else if (userRole === 'mentor') {
          const { data: mentorData } = await supabase
            .from('mentors')
            .select('is_verified')
            .eq('id', user.id)
            .maybeSingle()

          const { count: connCount } = await supabase
            .from('connections')
            .select('*', { count: 'exact', head: true })
            .eq('mentor_id', user.id)

          setStats({
            connectionsCount: connCount || 0,
            ideasCount: 0,
            isVerified: mentorData?.is_verified ?? false
          })
        }
      }
      setLoading(false)
    }

    loadRoleAndStats()
  }, [user])

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading role-specific dashboard...</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {role === 'founder' ? "Founder Command Center" : "Mentor Workspace"}
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {role === 'founder'
            ? "Build your venture, pitch to experts, and scale your startup."
            : "Review incoming founder pitches and guide early-stage teams."}
        </p>
      </div>

      {/* FOUNDER DASHBOARD VIEW */}
      {role === 'founder' && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saved Ventures</CardTitle>
              <Rocket className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ideasCount} Draft(s)</div>
              <p className="text-xs text-zinc-500 mt-1">Manage your active startup hypotheses.</p>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-2">
                <Link to="/dashboard/my-ventures">View Ventures <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Network Connections</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.connectionsCount} Active</div>
              <p className="text-xs text-zinc-500 mt-1">Track requests sent to technical mentors.</p>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-2">
                <Link to="/dashboard/network">Find Mentors <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">IdeaLab Pitch Studio</CardTitle>
              <Lightbulb className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">AI Validator</div>
              <p className="text-xs text-zinc-500 mt-1">Run diagnostics on problem-solution fit.</p>
              <Button asChild size="sm" className="mt-4 w-full gap-2">
                <Link to="/dashboard/idealab">Open IdeaLab <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MENTOR DASHBOARD VIEW */}
      {role === 'mentor' && (
        <div className="space-y-6">
          {!stats.isVerified && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/20 flex items-center gap-4">
              <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/50">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-200">Verification Pending</h4>
                <p className="text-sm text-amber-700 dark:text-amber-400">Your profile is under review by an administrator.</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Incoming Requests</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.connectionsCount} Total</div>
                <p className="text-xs text-zinc-500 mt-1">Review startup pitches and accept or decline connections.</p>
                <Button asChild className="mt-4 w-full gap-2">
                  <Link to="/dashboard/network">Review Founder Pitches <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Professional Profile</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Expertise & Skills</div>
                <p className="text-xs text-zinc-500 mt-1">Update your experience years, industry focus, and tech stack.</p>
                <Button asChild variant="outline" className="mt-4 w-full gap-2">
                  <Link to="/dashboard/profile">Edit Profile <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}