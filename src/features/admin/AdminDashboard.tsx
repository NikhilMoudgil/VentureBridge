import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"

import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  Crown, 
  Users, 
  Lightbulb, 
  Link2, 
  UserCheck, 
  LogOut,
  TrendingUp,
  XCircle,
  ShieldCheck,
  Building,
  Briefcase,
  Trash2,
  X
} from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type SystemUser = {
  id: string
  full_name: string
  role: 'mentor' | 'investor'
  is_verified: boolean
  industry?: string
  skills?: string
  experience_years?: number
  investment_stage?: string
  firm_name?: string
  created_at: string
}

export function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [users, setUsers] = useState<any[]>([])
  const [mentors, setMentors] = useState<SystemUser[]>([])
  const [investors, setInvestors] = useState<SystemUser[]>([])
  const [founders, setFounders] = useState<any[]>([])
  const [ideas, setIdeas] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  
  const [metrics, setMetrics] = useState({ founders: 0, mentors: 0, investors: 0, ideas: 0, connections: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'verified'>('pending')
  const [activeModal, setActiveModal] = useState<'founders' | 'mentors' | 'investors' | 'ideas' | 'connections' | null>(null)

  useEffect(() => {
    async function fetchSystemData() {
      if (!user) return
      
      const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
      
      if (me?.role === 'admin') {
        const { data: allUsers } = await supabase.from('users').select('*').order('role')
        if (allUsers) setUsers(allUsers)

        // Fetch Full Data + Counts for Lists & Metrics
        const [
          { data: fData, count: fCount }, 
          { data: mData, count: mCount }, 
          { data: invData, count: invCount },
          { data: iData, count: iCount }, 
          { data: cData, count: cCount }
        ] = await Promise.all([
          supabase.from('founders').select('*', { count: 'exact' }),
          supabase.from('mentors').select('*', { count: 'exact' }),
          supabase.from('investors').select('*', { count: 'exact' }),
          supabase.from('ideas').select('*', { count: 'exact' }),
          supabase.from('connections').select('*', { count: 'exact' })
        ])

        if (fData) setFounders(fData)
        if (mData) setMentors(mData as SystemUser[])
        if (invData) setInvestors(invData as SystemUser[])
        if (iData) setIdeas(iData)
        if (cData) setConnections(cData)

        setMetrics({
          founders: fCount || 0,
          mentors: mCount || 0,
          investors: invCount || 0,
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

  const toggleVerification = async (id: string, name: string, status: boolean, role: 'mentor' | 'investor') => {
    const table = role === 'mentor' ? 'mentors' : 'investors'
    const { error } = await supabase.from(table).update({ is_verified: status }).eq('id', id)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${name} has been ${status ? 'verified' : 'unverified'}.`)
      if (role === 'mentor') {
        setMentors(prev => prev.map(m => m.id === id ? { ...m, is_verified: status } : m))
      } else {
        setInvestors(prev => prev.map(i => i.id === id ? { ...i, is_verified: status } : i))
      }
    }
  }

  const handleDelete = async (tableName: string, id: string) => {
    const confirmDelete = window.confirm(`CRITICAL ACTION: Are you sure you want to permanently delete this record from ${tableName}?`)
    if (!confirmDelete) return

    const { error } = await supabase.from(tableName).delete().eq('id', id)
    
    if (error) {
      toast.error(`Deletion failed: ${error.message}`)
    } else {
      toast.success(`Record successfully purged from ${tableName}.`)
      
      // Update local state dynamically without re-fetching
      if (tableName === 'founders') {
        setFounders(prev => prev.filter(item => item.id !== id))
        setMetrics(prev => ({ ...prev, founders: Math.max(0, prev.founders - 1) }))
      } else if (tableName === 'mentors') {
        setMentors(prev => prev.filter(item => item.id !== id))
        setMetrics(prev => ({ ...prev, mentors: Math.max(0, prev.mentors - 1) }))
      } else if (tableName === 'investors') {
        setInvestors(prev => prev.filter(item => item.id !== id))
        setMetrics(prev => ({ ...prev, investors: Math.max(0, prev.investors - 1) }))
      } else if (tableName === 'ideas') {
        setIdeas(prev => prev.filter(item => item.id !== id))
        setMetrics(prev => ({ ...prev, ideas: Math.max(0, prev.ideas - 1) }))
      } else if (tableName === 'connections') {
        setConnections(prev => prev.filter(item => item.id !== id))
        setMetrics(prev => ({ ...prev, connections: Math.max(0, prev.connections - 1) }))
      }
    }
  }

  const renderModalContent = () => {
    let data: any[] = []
    if (activeModal === 'founders') data = founders
    if (activeModal === 'mentors') data = mentors
    if (activeModal === 'investors') data = investors
    if (activeModal === 'ideas') data = ideas
    if (activeModal === 'connections') data = connections

    if (!data || data.length === 0) {
      return (
        <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
          <ShieldAlert className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm">No records found for {activeModal}.</p>
        </div>
      )
    }

    return data.map((item) => (
      <div key={item.id} className="flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-800/60 rounded-lg bg-white dark:bg-zinc-900 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
        <div className="flex flex-col min-w-0 pr-4">
          <span className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
            {item.full_name || item.title || item.name || `System ID: ${item.id.substring(0, 12)}`}
          </span>
          <span className="text-xs text-zinc-500 truncate mt-0.5">
            {item.email || item.industry || item.firm_name || item.description || `Created: ${new Date(item.created_at).toLocaleDateString()}`}
            {item.is_verified !== undefined && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${item.is_verified ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                {item.is_verified ? 'Verified' : 'Pending'}
              </span>
            )}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDelete(activeModal as string, item.id)}
          className="text-red-600 border-red-100 bg-red-50 hover:border-red-200 hover:text-red-700 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:hover:bg-red-900/40 shrink-0"
        >
          <Trash2 className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Purge</span>
        </Button>
      </div>
    ))
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-zinc-500 flex-col gap-4"><ShieldAlert className="h-8 w-8 animate-pulse text-red-500" /> Authenticating clearance...</div>

  // Consolidate queues
  const pendingQueue = [
    ...mentors.filter(m => !m.is_verified).map(m => ({ ...m, role: 'mentor' as const })),
    ...investors.filter(i => !i.is_verified).map(i => ({ ...i, role: 'investor' as const }))
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const verifiedQueue = [
    ...mentors.filter(m => m.is_verified).map(m => ({ ...m, role: 'mentor' as const })),
    ...investors.filter(i => i.is_verified).map(i => ({ ...i, role: 'investor' as const }))
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const activeAdmins = users.filter(u => u.role === 'admin')
  const displayedQueue = activeTab === 'pending' ? pendingQueue : verifiedQueue

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-8 p-4 md:p-6 animate-in fade-in duration-500">
      
      {/* Dynamic Master Control Modal overlay */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-900/50">
              <div>
                <h2 className="text-xl font-bold capitalize text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-500" /> {activeModal} Registry
                </h2>
                <p className="text-sm text-zinc-500 mt-1">Reviewing {activeModal} table. Proceed with caution when deleting data.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActiveModal(null)} className="h-8 w-8 rounded-full bg-zinc-200/50 hover:bg-zinc-300/50 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto flex-1 flex flex-col gap-3 bg-zinc-50/30 dark:bg-zinc-950/20">
              {renderModalContent()}
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit font-mono text-[10px] uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
            Superuser Access • /admin
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-500" /> System Operations
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage platform security, verifications, and global metrics.</p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-500 dark:hover:bg-red-950/50">
          <LogOut className="h-4 w-4" /> Terminate Session
        </Button>
      </div>

      {/* Metrics Grid (Now Clickable as interactive cards) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card onClick={() => setActiveModal('founders')} className="shadow-sm border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition-all group">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <Users className="h-5 w-5 mb-2 text-zinc-400 group-hover:scale-110 transition-transform duration-300"/>
            <div className="text-3xl font-bold">{metrics.founders}</div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1 group-hover:text-zinc-800 dark:group-hover:text-zinc-300 transition-colors">Founders</p>
          </CardContent>
        </Card>

        <Card onClick={() => setActiveModal('mentors')} className="shadow-sm border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all group">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <UserCheck className="h-5 w-5 mb-2 text-emerald-500 group-hover:scale-110 transition-transform duration-300"/>
            <div className="text-3xl font-bold">{metrics.mentors}</div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">Mentors</p>
          </CardContent>
        </Card>

        <Card onClick={() => setActiveModal('investors')} className="shadow-sm border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all group">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <TrendingUp className="h-5 w-5 mb-2 text-blue-500 group-hover:scale-110 transition-transform duration-300"/>
            <div className="text-3xl font-bold">{metrics.investors}</div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">Investors</p>
          </CardContent>
        </Card>

        <Card onClick={() => setActiveModal('ideas')} className="shadow-sm border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition-all group">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <Lightbulb className="h-5 w-5 mb-2 text-amber-500 group-hover:scale-110 transition-transform duration-300"/>
            <div className="text-3xl font-bold">{metrics.ideas}</div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">Pitches</p>
          </CardContent>
        </Card>

        <Card onClick={() => setActiveModal('connections')} className="shadow-sm border-zinc-200 dark:border-zinc-800 col-span-2 md:col-span-1 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all group">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <Link2 className="h-5 w-5 mb-2 text-indigo-500 group-hover:scale-110 transition-transform duration-300"/>
            <div className="text-3xl font-bold">{metrics.connections}</div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Connections</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        
        {/* VERIFICATION CONTROL CENTER (Untouched core logic) */}
        <Card className="md:col-span-2 shadow-md border-zinc-200 dark:border-zinc-800 flex flex-col h-full min-h-[500px]">
          <CardHeader className="border-b bg-zinc-50/50 dark:bg-zinc-900/20 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">Verification Control</CardTitle>
                <CardDescription className="mt-1">Review and manage platform access for Mentors and Investors.</CardDescription>
              </div>
              {pendingQueue.length > 0 && (
                <Badge variant="destructive" className="animate-pulse flex gap-1"><ShieldAlert className="h-3 w-3" /> {pendingQueue.length} Action Req.</Badge>
              )}
            </div>
            
            {/* Custom Tab Navigation */}
            <div className="flex items-center gap-6 mt-6">
              <button 
                onClick={() => setActiveTab('pending')} 
                className={`font-semibold text-sm pb-2 border-b-2 transition-colors ${activeTab === 'pending' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Pending Approvals ({pendingQueue.length})
              </button>
              <button 
                onClick={() => setActiveTab('verified')} 
                className={`font-semibold text-sm pb-2 border-b-2 transition-colors ${activeTab === 'verified' ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Verified Roster ({verifiedQueue.length})
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-zinc-950/20">
            <div className="p-4 space-y-3">
              {displayedQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950">
                  {activeTab === 'pending' ? (
                    <>
                      <ShieldCheck className="h-12 w-12 text-emerald-500/50 mb-3" />
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Queue is clear</p>
                      <p className="text-sm text-zinc-500 max-w-[250px] mt-1">All mentor and investor accounts have been reviewed.</p>
                    </>
                  ) : (
                    <>
                      <Users className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">No verified users</p>
                      <p className="text-sm text-zinc-500 mt-1">Approved accounts will appear here.</p>
                    </>
                  )}
                </div>
              ) : (
                displayedQueue.map(user => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border shrink-0">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                        <AvatarFallback>{(user.full_name || "??").substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm sm:text-base truncate">{user.full_name}</h4>
                          <Badge variant="outline" className={`text-[10px] uppercase font-mono tracking-wider ${user.role === 'mentor' ? 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400' : 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900 dark:text-purple-400'}`}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          {user.role === 'mentor' ? (
                            <>
                              <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {user.industry || 'General'}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>{user.experience_years ? `${user.experience_years} YOE` : 'Exp Unlisted'}</span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1"><Building className="h-3 w-3" /> {user.firm_name || 'Independent'}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>{user.investment_stage || 'Stage Unlisted'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 sm:mt-0 flex items-center gap-2 shrink-0">
                      {activeTab === 'pending' ? (
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm w-full sm:w-auto" onClick={() => toggleVerification(user.id, user.full_name, true, user.role)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:bg-red-900/40 w-full sm:w-auto" onClick={() => toggleVerification(user.id, user.full_name, false, user.role)}>
                          <XCircle className="h-4 w-4 mr-2" /> Revoke Access
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* SIDEBAR: SYSTEM HEALTH & ADMINS */}
        <div className="space-y-6">
          <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle className="flex items-center gap-2 text-base"><Crown className="h-5 w-5 text-amber-500" /> Active System Admins</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {activeAdmins.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-4">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate">{u.full_name || "Admin"}</h4>
                      <p className="text-xs text-zinc-500 truncate">{u.id.substring(0,12)}...</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <CardContent className="p-4 flex gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold">System Secure</h4>
                <p className="text-xs text-zinc-500 mt-1">All database RLS policies are enforcing strict role-based access control. Unverified users remain restricted in discovery layers.</p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}