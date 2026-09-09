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

  const handleRoleSelection = async (role: 'founder' | 'mentor') => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Upsert the base user record with ONLY columns guaranteed to exist in schema
      const { error: userError } = await supabase
        .from('users')
        .upsert({ 
          id: user.id, 
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          role 
        })
      if (userError) throw userError

      // 2. Upsert the specific profile row safely to prevent schema/constraint conflicts
      if (role === 'founder') {
        const { error: founderError } = await supabase
          .from('founders')
          .upsert({ id: user.id })
        if (founderError) throw founderError
      } else {
        const { error: mentorError } = await supabase
          .from('mentors')
          .upsert({ id: user.id })
        if (mentorError) throw mentorError
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
    <div className="flex h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to VentureBridge</h1>
          <p className="mt-2 text-zinc-500">How do you want to use the platform?</p>
        </div>

        {errorMsg && (
          <div className="rounded-md bg-red-100 p-4 text-center text-sm font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col justify-between hover:border-zinc-400 transition-colors">
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

          <Card className="flex flex-col justify-between hover:border-zinc-400 transition-colors">
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
        </div>
      </div>
    </div>
  )
}