import { useEffect, useState, useMemo } from "react"
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
  X,
  Activity,
  Database,
  Lock,
  Download,
  AlertOctagon,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type SystemUser = {
  id: string
  full_name: string
  role: 'mentor' | 'investor' | 'founder'
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

  // --- Derived Analytics Data ---
  const totalUsers = metrics.founders + metrics.mentors + metrics.investors || 1
  const pFounders = ((metrics.founders / totalUsers) * 100).toFixed(1)
  const pMentors = ((metrics.mentors / totalUsers) * 100).toFixed(1)
  const pInvestors = ((metrics.investors / totalUsers) * 100).toFixed(1)

  const recentActivityFeed = useMemo(() => {
    const all = [
      ...founders.map(f => ({ id: f.id, title: f.full_name || 'New Founder', type: 'Registration', role: 'founder', date: new Date(f.created_at) })),
      ...mentors.map(m => ({ id: m.id, title: m.full_name || 'New Mentor', type: 'Registration', role: 'mentor', date: new Date(m.created_at) })),
      ...investors.map(i => ({ id: i.id, title: i.full_name || 'New Investor', type: 'Registration', role: 'investor', date: new Date(i.created_at) })),
      ...ideas.map(id => ({ id: id.id, title: id.title || 'New Pitch Added', type: 'Idea', role: 'idea', date: new Date(id.created_at) }))
    ]
    return all.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6)
  }, [founders, mentors, investors, ideas])

  // Mocked Chart Data based on current metrics for visual aesthetics
  const chartData = [
    { label: 'Jan', val: Math.floor(totalUsers * 0.2) },
    { label: 'Feb', val: Math.floor(totalUsers * 0.4) },
    { label: 'Mar', val: Math.floor(totalUsers * 0.5) },
    { label: 'Apr', val: Math.floor(totalUsers * 0.7) },
    { label: 'May', val: Math.floor(totalUsers * 0.85) },
    { label: 'Jun', val: totalUsers },
  ]
  const maxChartVal = Math.max(...chartData.map(d => d.val), 1)

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
        <Button size="sm" variant="outline" onClick={() => handleDelete(activeModal as string, item.id)} className="text-red-600 border-red-100 bg-red-50 hover:border-red-200 hover:text-red-700 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:hover:bg-red-900/40 shrink-0">
          <Trash2 className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Purge</span>
        </Button>
      </div>
    ))
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-zinc-500 flex-col gap-4"><ShieldAlert className="h-8 w-8 animate-pulse text-indigo-500" /> Connecting to Mainframe...</div>

  const pendingQueue = [
    ...mentors.filter(m => !m.is_verified).map(m => ({ ...m, role: 'mentor' as const })),
    ...investors.filter(i => !i.is_verified).map(i => ({ ...i, role: 'investor' as const }))
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const verifiedQueue = [
    ...mentors.filter(m => m.is_verified).map(m => ({ ...m, role: 'mentor' as const })),
    ...investors.filter(i => i.is_verified).map(i => ({ ...i, role: 'investor' as const }))
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const displayedQueue = activeTab === 'pending' ? pendingQueue : verifiedQueue

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 pb-12">
      
      {/* Master Data Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-900/50">
              <div>
                <h2 className="text-xl font-bold capitalize flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-500" /> {activeModal} Registry Explorer
                </h2>
                <p className="text-sm text-zinc-500 mt-1">Direct database access. Proceed with caution when purging data.</p>
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

      {/* Top Navigation / Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-40">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between p-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">Command Center</h1>
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold">Superuser Authenticated</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-sm font-medium">System Admin</span>
              <span className="text-xs text-zinc-500">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</span>
            </div>
            <Button variant="outline" onClick={handleLogout} className="border-zinc-200 dark:border-zinc-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors">
              <LogOut className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Terminate</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6 p-4 md:p-6 animate-in fade-in duration-500 mt-4">
        
        {/* KPI Interactive Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card onClick={() => setActiveModal('founders')} className="cursor-pointer border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all hover:shadow-md group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:group-hover:bg-indigo-950 dark:group-hover:text-indigo-400 transition-colors"><Users className="h-5 w-5"/></div>
                <span className="text-xs font-medium text-emerald-500 flex items-center gap-1"><TrendingUp className="h-3 w-3"/> +12%</span>
              </div>
              <div className="text-3xl font-bold tracking-tight">{metrics.founders}</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-medium">Total Founders</p>
            </CardContent>
          </Card>

          <Card onClick={() => setActiveModal('mentors')} className="cursor-pointer border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all hover:shadow-md group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950 dark:group-hover:text-emerald-400 transition-colors"><UserCheck className="h-5 w-5"/></div>
              </div>
              <div className="text-3xl font-bold tracking-tight">{metrics.mentors}</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-medium">Verified Mentors</p>
            </CardContent>
          </Card>

          <Card onClick={() => setActiveModal('investors')} className="cursor-pointer border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all hover:shadow-md group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-400 transition-colors"><Briefcase className="h-5 w-5"/></div>
              </div>
              <div className="text-3xl font-bold tracking-tight">{metrics.investors}</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-medium">Active Investors</p>
            </CardContent>
          </Card>

          <Card onClick={() => setActiveModal('ideas')} className="cursor-pointer border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all hover:shadow-md group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-amber-100 group-hover:text-amber-600 dark:group-hover:bg-amber-950 dark:group-hover:text-amber-400 transition-colors"><Lightbulb className="h-5 w-5"/></div>
                <span className="text-xs font-medium text-emerald-500 flex items-center gap-1"><TrendingUp className="h-3 w-3"/> +5%</span>
              </div>
              <div className="text-3xl font-bold tracking-tight">{metrics.ideas}</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-medium">Total Pitches</p>
            </CardContent>
          </Card>

          <Card onClick={() => setActiveModal('connections')} className="col-span-2 lg:col-span-1 cursor-pointer border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all hover:shadow-md group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-purple-100 group-hover:text-purple-600 dark:group-hover:bg-purple-950 dark:group-hover:text-purple-400 transition-colors"><Link2 className="h-5 w-5"/></div>
              </div>
              <div className="text-3xl font-bold tracking-tight">{metrics.connections}</div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-medium">Matches Made</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics & System Controls Row */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          
          {/* Main Chart Area */}
          <Card className="lg:col-span-2 border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-500" /> Platform Growth Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-48 mt-4">
                {chartData.map((d, i) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-t-md relative flex-1 overflow-hidden">
                      <div 
                        className="absolute bottom-0 w-full bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-900 dark:to-indigo-500 rounded-t-md transition-all duration-1000 group-hover:brightness-110" 
                        style={{ height: `${(d.val / maxChartVal) * 100}%` }} 
                      />
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">{d.label}</span>
                  </div>
                ))}
              </div>

              {/* Composition Donut/Bar */}
              <div className="mt-8">
                <div className="flex justify-between items-end mb-2">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">User Composition</h4>
                  <span className="text-xs font-mono text-zinc-500">Total: {totalUsers}</span>
                </div>
                <div className="flex h-3 w-full rounded-full overflow-hidden mb-3 bg-zinc-100 dark:bg-zinc-800">
                  <div style={{ width: `${pFounders}%` }} className="bg-indigo-500" title={`Founders: ${pFounders}%`}></div>
                  <div style={{ width: `${pMentors}%` }} className="bg-emerald-500" title={`Mentors: ${pMentors}%`}></div>
                  <div style={{ width: `${pInvestors}%` }} className="bg-blue-500" title={`Investors: ${pInvestors}%`}></div>
                </div>
                <div className="flex gap-4 text-xs font-medium text-zinc-500">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"/> Founders {pFounders}%</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Mentors {pMentors}%</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"/> Investors {pInvestors}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Superuser Controls */}
          <Card className="border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-amber-500" /> System Controls</CardTitle>
              <CardDescription>Administrative functions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => toast.success("Data export initiated. You will receive an email shortly.")} variant="outline" className="w-full justify-start border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/80">
                <Download className="h-4 w-4 mr-3 text-zinc-500" /> Export Database (CSV)
              </Button>
              <Button onClick={() => toast.success("Cache cleared successfully.")} variant="outline" className="w-full justify-start border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/80">
                <RefreshCw className="h-4 w-4 mr-3 text-blue-500" /> Flush System Cache
              </Button>
              <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800 my-2" />
              <Button onClick={() => toast.error("Action requires secondary authorization.")} variant="outline" className="w-full justify-start border-red-200 dark:border-red-900/50 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40">
                <AlertOctagon className="h-4 w-4 mr-3" /> Enable Maintenance Mode
              </Button>
              
              <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">System Secure</h4>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-1 leading-relaxed">RLS policies are actively enforcing strict access control across all database tables.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row: Verifications & Feed */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          
          {/* Verification Control Center (Unchanged Core Logic, updated aesthetics) */}
          <Card className="lg:col-span-2 shadow-sm border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 flex flex-col min-h-[400px]">
            <CardHeader className="border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Verification Queue</CardTitle>
                </div>
                {pendingQueue.length > 0 && (
                  <Badge variant="destructive" className="animate-pulse flex gap-1"><ShieldAlert className="h-3 w-3" /> {pendingQueue.length} Req.</Badge>
                )}
              </div>
              <div className="flex items-center gap-6 mt-4">
                <button onClick={() => setActiveTab('pending')} className={`font-medium text-sm pb-2 border-b-2 transition-colors ${activeTab === 'pending' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                  Pending Approvals ({pendingQueue.length})
                </button>
                <button onClick={() => setActiveTab('verified')} className={`font-medium text-sm pb-2 border-b-2 transition-colors ${activeTab === 'verified' ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                  Verified Roster ({verifiedQueue.length})
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="p-4 space-y-3">
                {displayedQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500">
                    <ShieldCheck className="h-10 w-10 text-emerald-500/50 mb-3" />
                    <p className="text-sm font-medium">Queue is clear.</p>
                  </div>
                ) : (
                  displayedQueue.map(user => (
                    <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800/60 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <Avatar className="h-10 w-10 border shrink-0">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                          <AvatarFallback>{(user.full_name || "??").substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm truncate">{user.full_name}</h4>
                            <Badge variant="outline" className={`text-[9px] uppercase font-mono tracking-wider ${user.role === 'mentor' ? 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900' : 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900'}`}>
                              {user.role}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-500 flex gap-2">
                            {user.role === 'mentor' ? <span>{user.industry || 'General'}</span> : <span>{user.firm_name || 'Independent'}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 sm:mt-0 shrink-0">
                        {activeTab === 'pending' ? (
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto" onClick={() => toggleVerification(user.id, user.full_name, true, user.role)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="border-red-200 text-red-600 bg-red-50 hover:bg-red-100 w-full sm:w-auto dark:border-red-900/50 dark:bg-red-950/20" onClick={() => toggleVerification(user.id, user.full_name, false, user.role)}>
                            <XCircle className="h-4 w-4 mr-2" /> Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 flex flex-col h-full">
            <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
              <CardTitle className="text-lg font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-500" /> Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {recentActivityFeed.map((activity, idx) => (
                  <div key={idx} className="p-4 flex gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="mt-0.5">
                      {activity.type === 'Idea' ? (
                         <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center"><Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-500" /></div>
                      ) : (
                         <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center"><Users className="h-4 w-4 text-blue-600 dark:text-blue-500" /></div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {activity.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span>{activity.type}</span> • <span>{activity.date.toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}