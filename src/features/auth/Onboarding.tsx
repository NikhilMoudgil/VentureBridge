import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const supabase = createClient()

export function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleRoleSelection = async (role: 'founder' | 'mentor' | 'investor') => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // Extract the full name once to ensure it populates correctly across all tables
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Anonymous Member"

      // 1. Upsert the base user record
      const { error: userError } = await supabase
        .from('users')
        .upsert({ 
          id: user.id, 
          full_name: fullName,
          role 
        })
      if (userError) throw userError

      // 2. Upsert the specific profile row safely including the full_name to satisfy NOT NULL constraints
      if (role === 'founder') {
        const { error: founderError } = await supabase
          .from('founders')
          .upsert({ id: user.id, full_name: fullName })
        if (founderError) throw founderError
      } else if (role === 'mentor') {
        const { error: mentorError } = await supabase
          .from('mentors')
          .upsert({ id: user.id, full_name: fullName })
        if (mentorError) throw mentorError
      } else if (role === 'investor') {
        const { error: investorError } = await supabase
          .from('investors')
          .upsert({ id: user.id, full_name: fullName })
        if (investorError) throw investorError
      }

      // 3. Send them to the dashboard
      navigate("/dashboard")
      
    } catch (err: any) {
      console.error("Supabase Error:", err)
      setErrorMsg(err.message || "Failed to save profile. Check console for details.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to VentureBridge</h1>
          <p className="mt-2 text-zinc-500">How do you want to use the platform?</p>
        </div>

        {errorMsg && (
          <div className="rounded-md bg-red-100 p-4 text-center text-sm font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* FOUNDER CARD */}
          <Card className="flex flex-col justify-between hover:border-zinc-400 transition-colors shadow-sm">
            <CardHeader>
              <CardTitle>I am a Founder</CardTitle>
              <CardDescription>
                I am building a startup and looking for guidance, feedback, and mentorship from experienced industry professionals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                disabled={loading} 
                onClick={() => handleRoleSelection('founder')}
              >
                {loading ? "Saving..." : "Join as Founder"}
              </Button>
            </CardContent>
          </Card>

          {/* MENTOR CARD */}
          <Card className="flex flex-col justify-between hover:border-zinc-400 transition-colors shadow-sm">
            <CardHeader>
              <CardTitle>I am a Mentor</CardTitle>
              <CardDescription>
                I have industry experience and want to give back by advising and supporting early-stage startup founders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full" 
                disabled={loading} 
                onClick={() => handleRoleSelection('mentor')}
              >
                {loading ? "Saving..." : "Join as Mentor"}
              </Button>
            </CardContent>
          </Card>

          {/* INVESTOR CARD */}
          <Card className="flex flex-col justify-between hover:border-zinc-400 transition-colors shadow-sm border-indigo-100 dark:border-indigo-900/50">
            <CardHeader>
              <CardTitle className="text-indigo-600 dark:text-indigo-400">I am an Investor</CardTitle>
              <CardDescription>
                I want to scout vetted startups, review deal flow pipelines, and connect with high-signal founders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary"
                className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50" 
                disabled={loading} 
                onClick={() => handleRoleSelection('investor')}
              >
                {loading ? "Saving..." : "Join as Investor"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}