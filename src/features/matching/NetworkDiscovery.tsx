import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, Briefcase, Clock, CheckCircle2, FileText, X, Sparkles, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { Link } from "react-router-dom"

const supabase = createClient()

type NetworkProfile = {
  id: string
  full_name: string
  role: 'founder' | 'mentor' | 'investor'
  industry?: string
  startup_stage?: string
  experience_years?: number
  skills?: string
  idea?: any 
  investment_stage?: string
}

export function NetworkDiscovery() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<'founder' | 'mentor' | 'investor' | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<NetworkProfile | null>(null)
  const [founderIdeaId, setFounderIdeaId] = useState<string | null>(null)
  
  const [profiles, setProfiles] = useState<NetworkProfile[]>([])
  const [connections, setConnections] = useState<any[]>([]) 
  const [dealFlows, setDealFlows] = useState<any[]>([]) 
  
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProfileModal, setSelectedProfileModal] = useState<NetworkProfile | null>(null)

  useEffect(() => {
    async function fetchNetwork() {
      if (!user) return

      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      
      if (userData) {
        const role = userData.role as 'founder' | 'mentor' | 'investor'
        setCurrentUserRole(role)

        if (role === 'founder') {
          const { data: founderData } = await supabase.from('founders').select('*').eq('id', user.id).maybeSingle()
          if (founderData) setCurrentUserProfile({ ...founderData, role: 'founder' })

          const { data: ideaData } = await supabase.from('ideas').select('id').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (ideaData) setFounderIdeaId(ideaData.id)

          const { data: mentorsData } = await supabase.from('mentors').select('*')
          const { data: investorsData } = await supabase.from('investors').select('*')

          setProfiles([
            ...(mentorsData?.map(m => ({ ...m, role: 'mentor' as const })) || []),
            ...(investorsData?.map(i => ({ ...i, role: 'investor' as const })) || [])
          ])
          
        } else if (role === 'mentor' || role === 'investor') {
          const table = role === 'mentor' ? 'mentors' : 'investors'
          const { data: profileData } = await supabase.from(table).select('*').eq('id', user.id).maybeSingle()
          if (profileData) setCurrentUserProfile({ ...profileData, role })

          const { data: foundersData } = await supabase.from('founders').select('*')
          if (foundersData) {
            const founderIds = foundersData.map(f => f.id)
            const { data: ideasData } = await supabase.from('ideas').select('*').in('owner_id', founderIds)
            setProfiles(foundersData.map(f => ({ ...f, role: 'founder', idea: ideasData?.find(i => i.owner_id === f.id) })))
          }
        }

        const { data: connData } = await supabase.from('connections').select('*').or(`founder_id.eq.${user.id},mentor_id.eq.${user.id}`)
        if (connData) setConnections(connData)

        const { data: dealData } = await supabase.from('deal_flow').select('*').or(`founder_id.eq.${user.id},investor_id.eq.${user.id}`)
        if (dealData) setDealFlows(dealData)
      }
      setLoading(false)
    }

    fetchNetwork()

    // NEW: Real-time listener for Founders to see Investor status changes instantly
    if (!user) return
    const channel = supabase.channel('network_discovery_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_flow' }, () => {
        fetchNetwork()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
        fetchNetwork()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const calculateMatchScore = (targetProfile: NetworkProfile) => {
    if (!currentUserProfile) return 50
    let score = 40
    if (currentUserProfile.industry && targetProfile.industry && currentUserProfile.industry.trim().toLowerCase() === targetProfile.industry.trim().toLowerCase()) score += 30
    if (currentUserProfile.skills && targetProfile.skills) {
      const userSkills = currentUserProfile.skills.toLowerCase().split(',').map(s => s.trim())
      const targetSkills = targetProfile.skills.toLowerCase().split(',').map(s => s.trim())
      const sharedSkills = userSkills.filter(skill => targetSkills.includes(skill))
      if (sharedSkills.length > 0) score += Math.min(30, sharedSkills.length * 15)
    }
    return Math.min(100, Math.max(35, score))
  }

  const handleConnectMentor = async (targetId: string, targetName: string) => {
    if (!user || currentUserRole !== 'founder') return
    try {
      const { error } = await supabase.from('connections').insert({ founder_id: user.id, mentor_id: targetId, status: 'pending' })
      if (error) throw error
      toast.success(`Connection request sent to ${targetName}`)
    } catch (err: any) { toast.error("Failed to send request.") }
  }

  const handlePitchInvestor = async (targetId: string, targetName: string) => {
    if (!user || currentUserRole !== 'founder') return
    if (!founderIdeaId) {
      toast.error("You need to create a venture in IdeaLab before pitching an investor!")
      return
    }
    try {
      const { error } = await supabase.from('deal_flow').insert({ founder_id: user.id, investor_id: targetId, idea_id: founderIdeaId, status: 'submitted' })
      if (error) throw error
      toast.success(`Pitch submitted to ${targetName}!`)
    } catch (err: any) { toast.error("Failed to submit pitch.") }
  }

  const handleUpdateMentorStatus = async (founderId: string, newStatus: 'accepted' | 'declined') => {
    if (!user || currentUserRole !== 'mentor') return
    try {
      const { error } = await supabase.from('connections').update({ status: newStatus }).match({ founder_id: founderId, mentor_id: user.id })
      if (error) throw error
      toast.success(`Request ${newStatus}!`)
    } catch (err: any) { toast.error("Failed to update.") }
  }

  const getStatus = (profileId: string, targetRole: string) => {
    if (targetRole === 'mentor' || currentUserRole === 'mentor') {
      const conn = connections.find(c => (c.founder_id === user?.id && c.mentor_id === profileId) || (c.founder_id === profileId && c.mentor_id === user?.id))
      return conn ? conn.status : null
    } else if (targetRole === 'investor' || currentUserRole === 'investor') {
      const deal = dealFlows.find(d => (d.founder_id === user?.id && d.investor_id === profileId) || (d.founder_id === profileId && d.investor_id === user?.id))
      return deal ? deal.status : null
    }
    return null
  }

  const searchLower = searchTerm.toLowerCase()
  const filteredProfiles = profiles.filter(p => (p.full_name || "").toLowerCase().includes(searchLower) || (p.industry || "").toLowerCase().includes(searchLower))

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading network discovery...</div>

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8 relative">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Network Discovery</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {currentUserRole === 'founder' ? "Connect with Mentors or pitch to Investors." : "Scout the ecosystem for high-signal founders."}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input placeholder="Search network..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      {!founderIdeaId && currentUserRole === 'founder' && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl flex items-center justify-between dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-300">
          <p className="text-sm font-medium">You need an active venture profile to pitch investors.</p>
          <Button asChild size="sm" variant="secondary" className="bg-white hover:bg-zinc-100 text-indigo-700">
            <Link to="/dashboard/idealab">Create in IdeaLab</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProfiles.map((profile) => {
          const status = getStatus(profile.id, profile.role)
          const matchScore = calculateMatchScore(profile)

          return (
            <Card key={profile.id} className="group overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <CardHeader className="flex flex-row items-start justify-between pb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}`} />
                      <AvatarFallback>{(profile.full_name || "??").substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <CardTitle className="text-lg truncate max-w-[140px]">{profile.full_name || "Anonymous"}</CardTitle>
                      <Badge variant={profile.role === 'investor' ? 'default' : 'secondary'} className="font-mono text-[10px] uppercase mt-1 w-fit">
                        {profile.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="h-3 w-3" /><span>{matchScore}%</span>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate">Industry: {profile.industry || "General Strategy"}</span>
                  </div>
                </CardContent>
              </div>

              <CardFooter className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex gap-2">
                <Button variant="outline" className="w-1/2 gap-1 bg-white dark:bg-zinc-950 text-xs" onClick={() => setSelectedProfileModal(profile)}>
                  <FileText className="h-3.5 w-3.5" /> Profile
                </Button>

                {/* Founder -> Mentor Flow */}
                {currentUserRole === 'founder' && profile.role === 'mentor' && !status && (
                  <Button onClick={() => handleConnectMentor(profile.id, profile.full_name)} className="w-1/2 gap-1 text-xs"><UserPlus className="h-3.5 w-3.5" /> Connect</Button>
                )}
                
                {/* Founder -> Investor Flow */}
                {currentUserRole === 'founder' && profile.role === 'investor' && !status && (
                  <Button onClick={() => handlePitchInvestor(profile.id, profile.full_name)} disabled={!founderIdeaId} className="w-1/2 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"><TrendingUp className="h-3.5 w-3.5" /> Pitch</Button>
                )}

                {/* Status Indicators */}
                {currentUserRole === 'founder' && (status === 'pending' || status === 'submitted' || status === 'reviewing') && (
                  <Button variant="secondary" className="w-1/2 hover:bg-red-50 hover:text-red-600 text-xs px-1" disabled><Clock className="h-3.5 w-3.5 mr-1" /> {status === 'pending' ? 'Pending' : 'In Review'}</Button>
                )}
                {currentUserRole === 'founder' && (status === 'accepted' || status === 'interested') && (
                  <Button variant="outline" className="w-1/2 border-emerald-500 text-emerald-600 bg-emerald-50 text-xs px-1" disabled><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Connected</Button>
                )}
                {currentUserRole === 'founder' && status === 'passed' && (
                  <Button variant="outline" className="w-1/2 border-red-200 text-red-500 bg-red-50 text-xs px-1" disabled><X className="h-3.5 w-3.5 mr-1" /> Passed</Button>
                )}

                {/* Mentor Receiving Flow */}
                {currentUserRole === 'mentor' && status === 'pending' && (
                  <div className="flex gap-1 w-1/2">
                    <Button size="sm" className="w-1/2 bg-emerald-600 text-white text-[10px] px-1" onClick={() => handleUpdateMentorStatus(profile.id, 'accepted')}>Accept</Button>
                    <Button size="sm" variant="outline" className="w-1/2 text-red-600 text-[10px] px-1" onClick={() => handleUpdateMentorStatus(profile.id, 'declined')}>Decline</Button>
                  </div>
                )}
                {(currentUserRole === 'mentor' || currentUserRole === 'investor') && !status && (
                  <div className="w-1/2 text-xs text-zinc-400 flex items-center justify-center">Scouting Mode</div>
                )}
                {(currentUserRole === 'mentor' || currentUserRole === 'investor') && (status === 'accepted' || status === 'interested') && (
                  <Button variant="outline" className="w-1/2 border-emerald-500 text-emerald-600 bg-emerald-50 text-xs px-1" disabled><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Connected</Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {selectedProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-6 relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between border-b pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-indigo-500/20">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedProfileModal.full_name}`} />
                  <AvatarFallback>{(selectedProfileModal.full_name || "??").substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">{selectedProfileModal.full_name}</h3>
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider mt-1">
                    {selectedProfileModal.role}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedProfileModal(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 text-sm">
              {selectedProfileModal.role === 'founder' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-1">
                    <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Elevator Pitch</span>
                    <p className="text-zinc-800 dark:text-zinc-200 font-medium">
                      {selectedProfileModal.idea?.elevator_pitch || selectedProfileModal.idea?.solution || "No pitch details provided yet."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-1">
                    <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Problem Being Solved</span>
                    <p className="text-zinc-700 dark:text-zinc-300">
                      {selectedProfileModal.idea?.problem || "Not specified."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Target Market</span>
                      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{selectedProfileModal.idea?.target_market || selectedProfileModal.idea?.market || "General"}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Tech Stack</span>
                      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{selectedProfileModal.idea?.tech_stack || selectedProfileModal.skills || "Unspecified"}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedProfileModal.role === 'mentor' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Industry</span>
                      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{selectedProfileModal.industry || "General Strategy"}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Experience</span>
                      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{selectedProfileModal.experience_years ? `${selectedProfileModal.experience_years}+ Years` : "Unlisted"}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-2">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Core Skills & Expertise</span>
                    <p className="text-zinc-700 dark:text-zinc-300">{selectedProfileModal.skills || "No specific skills highlighted yet."}</p>
                  </div>
                </>
              )}

              {selectedProfileModal.role === 'investor' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Target Stage</span>
                      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{selectedProfileModal.investment_stage || "All Stages"}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Industry Focus</span>
                      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{selectedProfileModal.industry || "General Strategy"}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-2">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Investment Thesis</span>
                    <p className="text-zinc-700 dark:text-zinc-300">{selectedProfileModal.skills || "No specific investment thesis provided yet."}</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t dark:border-zinc-800">
              <Button onClick={() => setSelectedProfileModal(null)} className="w-full sm:w-auto">Close Modal</Button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  )
}