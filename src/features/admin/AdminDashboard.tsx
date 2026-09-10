import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Shield, ShieldAlert, CheckCircle2, UserX, X, Crown, Users } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type SystemUser = {
  id: string
  full_name: string
  role: string
  industry: string | null
  is_verified: boolean
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetchSystemData()
  }, [user])

  async function fetchSystemData() {
    if (!user) return
    setLoading(true)

    // Verify current user is an admin
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    setCurrentUserRole(me?.role || null)

    if (me?.role === 'admin') {
      // Fetch all platform users
      const { data: allUsers, error } = await supabase.from('users').select('*').order('role')
      if (allUsers) setUsers(allUsers)
      if (error) toast.error("Failed to fetch system data.")
    }
    setLoading(false)
  }

  // --- ADMIN ACTIONS ---
  const handleVerify = async (targetId: string, name: string) => {
    try {
      const { error } = await supabase.from('users').update({ is_verified: true }).eq('id', targetId)
      if (error) throw error
      toast.success(`${name} has been verified!`)
      setUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_verified: true } : u))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRevoke = async (targetId: string, name: string) => {
    try {
      const { error } = await supabase.from('users').update({ is_verified: false }).eq('id', targetId)
      if (error) throw error
      toast.success(`${name}'s verification was revoked.`)
      setUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_verified: false } : u))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handlePromoteToAdmin = async (targetId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to make ${name} a Sub-Admin? They will have full platform control.`)) return
    
    try {
      const { error } = await supabase.from('users').update({ role: 'admin', is_verified: true }).eq('id', targetId)
      if (error) throw error
      toast.success(`${name} is now an Admin.`)
      setUsers(prev => prev.map(u => u.id === targetId ? { ...u, role: 'admin', is_verified: true } : u))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Authenticating admin clearance...</div>

  // STRICT GATE: Kick out non-admins
  if (currentUserRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold">Unauthorized Access</h2>
        <p className="text-zinc-500 mt-2">You do not have administrative clearance to view this node.</p>
      </div>
    )
  }

  // Filter users into logical buckets
  const pendingMentors = users.filter(u => u.role === 'mentor' && !u.is_verified)
  const activeUsers = users.filter(u => (u.role === 'founder' || u.role === 'mentor') && u.is_verified)
  const subAdmins = users.filter(u => u.role === 'admin')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      
      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit font-mono text-xs uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400">
          Superuser Access • /admin
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl flex items-center gap-3">
          <Shield className="h-8 w-8 text-zinc-900 dark:text-zinc-50" /> System Operations
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Manage platform verification, investigate users, and provision sub-admins.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* PENDING QUEUE */}
        <Card className="md:col-span-2 border-amber-200 shadow-sm dark:border-amber-900/50 dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> Action Required: Pending Mentors
            </CardTitle>
            <CardDescription>Mentors awaiting background verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingMentors.length === 0 ? (
              <p className="text-sm text-zinc-500">No pending verifications. The queue is clear.</p>
            ) : (
              pendingMentors.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-amber-100 p-3 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-900/10">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-amber-200 dark:border-amber-800">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${u.full_name}`} />
                      <AvatarFallback>{(u.full_name || "?").substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-sm font-semibold">{u.full_name}</h4>
                      <p className="text-xs text-amber-600 dark:text-amber-500">{u.industry || "Industry Not Set"}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleVerify(u.id, u.full_name)} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Approve Mentor
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ADMINS */}
        <Card className="border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-zinc-900 dark:text-zinc-50" /> Active Admins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subAdmins.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {(u.full_name || "AD").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-sm font-semibold">{u.full_name}</h4>
                  <Badge variant="secondary" className="text-[10px] mt-1">SUPERUSER</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ACTIVE DIRECTORY */}
        <Card className="md:col-span-3 border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Platform Directory
            </CardTitle>
            <CardDescription>Manage actively verified Mentors and Founders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activeUsers.map(u => (
                <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">{u.full_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="uppercase text-[10px]">{u.role}</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    {u.role === 'mentor' && (
                      <Button variant="outline" size="sm" onClick={() => handleRevoke(u.id, u.full_name)} className="w-1/2 text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <X className="h-3 w-3 mr-1" /> Revoke
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handlePromoteToAdmin(u.id, u.full_name)} className="flex-1 text-xs h-8">
                      <Crown className="h-3 w-3 mr-1" /> Make Admin
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}