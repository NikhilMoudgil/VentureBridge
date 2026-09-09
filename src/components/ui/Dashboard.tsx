import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/components/ui/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, UserCircle, Users, Activity } from "lucide-react"

const supabase = createClient()

export function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserData() {
      if (!user) return
      
      const { data } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()
      
      if (data) {
        setProfile(data as { full_name: string; role: string })
      }
      setLoading(false)
    }
    fetchUserData()
  }, [user])

  if (loading) {
    return <div className="animate-pulse p-8 text-zinc-500">Loading your dashboard...</div>
  }

  // Determine role-based content
  const isFounder = profile?.role === 'founder'
  const firstName = profile?.full_name?.split(' ')[0] || "there"

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-2 text-zinc-500">
          Here is what is happening in your VentureBridge network today.
        </p>
      </div>
      
      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Primary Action Card (Changes based on role) */}
        <Card className="border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Discover {isFounder ? "Mentors" : "Founders"}
            </CardTitle>
            <CardDescription className="text-zinc-400 dark:text-zinc-500">
              {isFounder 
                ? "Find experienced industry professionals to guide your startup."
                : "Browse promising startups looking for your expertise."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/network">
              <Button variant="secondary" className="w-full justify-between">
                Browse Network <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Your Profile
            </CardTitle>
            <CardDescription>
              Keep your details up to date to attract the best connections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/profile">
              <Button variant="outline" className="w-full justify-between">
                Edit Profile <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Placeholder Stat Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Profile Views
            </CardTitle>
            <CardDescription>Over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}