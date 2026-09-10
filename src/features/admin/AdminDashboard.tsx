import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"

import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Shield, ShieldAlert, CheckCircle2, Crown, Users, Lightbulb, Link2, UserCheck, LogOut } from "lucide-react"
import { toast } from "sonner"

// Initialize the client exactly as your setup requires
const supabase = createClient()

export function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [users, setUsers] = useState<any[]>([])
  const [mentors, setMentors] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ founders: 0, mentors: 0, ideas: 0, connections: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSystemData() {
      if (!user) return
      
      const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
      
      if (me?.role === 'admin') {
        const { data: allUsers } = await supabase.from('users').select('*').order('role')
        const { data: mentorsData } = await supabase.from('mentors').select('*')
        
        if (allUsers) setUsers(allUsers)
        if (mentorsData) setMentors(mentorsData)

        // Live Counts
        const [{ count: fCount }, { count: mCount }, { count: iCount }, { count: cCount }] = await Promise.all([
          supabase.from('founders').select('*', { count: 'exact', head: true }),
          supabase.from('mentors').select('*', { count: 'exact', head: true }),
          supabase.from('ideas').select('*', { count: 'exact', head: true }),
          supabase.from('connections').select('*', { count: 'exact', head: true })
        ])

        setMetrics({
          founders: fCount || 0,
          mentors: mCount || 0,
          ideas: iCount || 0,
          connections: cCount || 0,
        })
      }
      setLoading(false)
    }
    fetchSystemData()
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate("/admin-login")
  }

  // This relies on the Admin Override Policy you added to Supabase
  const toggleVerification = async (id: string, name: string, status: boolean) => {
    const { error } = await supabase.from('mentors').update({ is_verified: status }).eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${name} verified successfully.`)
      setMentors(prev => prev.map(m => m.id === id ? { ...m, is_verified: status } : m))
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Authenticating clearance...</div>

  const pendingMentors = mentors.filter(m => !m.is_verified)
  const activeAdmins = users.filter(u => u.role === 'admin')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit font-mono text-xs uppercase text-emerald-600 bg-emerald-50">
            Superuser Access • /admin
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-zinc-900 dark:text-zinc-50" /> System Operations
          </h1>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" /> Terminate Session
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><Users className="h-4 w-4 mb-2 text-zinc-500"/><div className="text-2xl font-bold">{metrics.founders}</div><p className="text-xs text-zinc-500">Founders</p></CardContent></Card>
        <Card><CardContent className="p-6"><UserCheck className="h-4 w-4 mb-2 text-emerald-500"/><div className="text-2xl font-bold">{metrics.mentors}</div><p className="text-xs text-zinc-500">Mentors</p></CardContent></Card>
        <Card><CardContent className="p-6"><Lightbulb className="h-4 w-4 mb-2 text-amber-500"/><div className="text-2xl font-bold">{metrics.ideas}</div><p className="text-xs text-zinc-500">Pitches</p></CardContent></Card>
        <Card><CardContent className="p-6"><Link2 className="h-4 w-4 mb-2 text-blue-500"/><div className="text-2xl font-bold">{metrics.connections}</div><p className="text-xs text-zinc-500">Connections</p></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* PENDING QUEUE */}
        <Card className="md:col-span-2 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600"><ShieldAlert className="h-5 w-5" /> Pending Mentors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingMentors.length === 0 ? <p className="text-sm text-zinc-500">Queue is clear.</p> : pendingMentors.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback>{(m.full_name || "M").substring(0,2)}</AvatarFallback></Avatar>
                  <div><h4 className="text-sm font-semibold">{m.full_name}</h4><p className="text-xs text-zinc-500">{m.industry}</p></div>
                </div>
                <Button size="sm" onClick={() => toggleVerification(m.id, m.full_name, true)} className="bg-amber-600 hover:bg-amber-700 text-white"><CheckCircle2 className="h-4 w-4 mr-2" /> Approve</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ACTIVE ADMINS */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5" /> Admins</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {activeAdmins.map(u => (
              <div key={u.id} className="flex items-center gap-3 border-b pb-2 last:border-0"><h4 className="text-sm font-semibold">{u.full_name || "Admin"}</h4></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}