import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, Briefcase, GraduationCap, Clock, CheckCircle2, FileText, X, ShieldAlert, Sparkles } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type NetworkProfile = {
  id: string
  full_name: string
  role: 'founder' | 'mentor'
  industry?: string
  startup_stage?: string
  funding_goal?: string
  experience_years?: number
  skills?: string
  is_verified?: boolean
  idea?: any 
}

export function NetworkDiscovery() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<'founder' | 'mentor' | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<NetworkProfile | null>(null)
  const [isVerified, setIsVerified] = useState<boolean>(true)
  const [profiles, setProfiles] = useState<NetworkProfile[]>([])
  const [connections, setConnections] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [selectedProfileModal, setSelectedProfileModal] = useState<NetworkProfile | null>(null)

  useEffect(() => {
    async function fetchNetwork() {
      if (!user) return

      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      
      if (userData) {
        const role = userData.role
        setCurrentUserRole(role)

        if (role === 'founder') {
          const { data: founderData } = await supabase.from('founders').select('*').eq('id', user.id).maybeSingle()
          if (founderData) setCurrentUserProfile({ ...founderData, role: 'founder' })

          const { data: mentorsData } = await supabase
            .from('mentors')
            .select('*')
            .eq('is_verified', true)

          if (mentorsData) {
            setProfiles(mentorsData.map(m => ({ ...m, role: 'mentor' })))
          }
        } else if (role === 'mentor') {
          const { data: mentorData } = await supabase.from('mentors').select('*').eq('id', user.id).maybeSingle()
          if (mentorData) {
            setCurrentUserProfile({ ...mentorData, role: 'mentor' })
            setIsVerified(mentorData.is_verified ?? false)
          }

          const { data: foundersData } = await supabase.from('founders').select('*')

          if (foundersData) {
            const founderIds = foundersData.map(f => f.id)
            const { data: ideasData } = await supabase.from('ideas').select('*').in('id', founderIds)

            setProfiles(foundersData.map(f => ({
              ...f,
              role: 'founder',
              idea: ideasData?.find(i => i.id === f.id)
            })))
          }
        }

        const { data: connData } = await supabase
          .from('connections')
          .select('*')
          .or(`founder_id.eq.${user.id},mentor_id.eq.${user.id}`)
        
        if (connData) setConnections(connData)
      }
      setLoading(false)
    }

    fetchNetwork()
  }, [user])

  const calculateMatchScore = (targetProfile: NetworkProfile) => {
    if (!currentUserProfile) return 50
    let score = 40

    if (
      currentUserProfile.industry &&
      targetProfile.industry &&
      currentUserProfile.industry.trim().toLowerCase() === targetProfile.industry.trim().toLowerCase()
    ) {
      score += 30
    }

    if (currentUserProfile.skills && targetProfile.skills) {
      const userSkills = currentUserProfile.skills.toLowerCase().split(',').map(s => s.trim())
      const targetSkills = targetProfile.skills.toLowerCase().split(',').map(s => s.trim())
      const sharedSkills = userSkills.filter(skill => targetSkills.includes(skill))
      
      if (sharedSkills.length > 0) {
        score += Math.min(30, sharedSkills.length * 15)
      }
    }

    return Math.min(100, Math.max(35, score))
  }

  // UPDATED: Integrates the robust upsert logic and local state update
  const handleConnect = async (targetId: string, targetName: string) => {
    if (!user || currentUserRole !== 'founder') return

    try {
      const { error } = await supabase
        .from('connections')
        .upsert(
          { 
            founder_id: user.id, 
            mentor_id: targetId, 
            status: 'pending' 
          }, 
          { onConflict: 'founder_id,mentor_id' }
        )

      if (error) throw error

      toast.success(`Connection request sent to ${targetName}`)
      
      // Update local state so the UI instantly switches to the "Pending" button
      setConnections(prev => [
        ...prev.filter(c => !(c.founder_id === user.id && c.mentor_id === targetId)),
        { founder_id: user.id, mentor_id: targetId, status: 'pending' }
      ])
    } catch (err: any) {
      console.error('Connection failed:', err.message)
      toast.error(err.message || "Failed to send connection request.")
    }
  }

  const handleUpdateStatus = async (founderId: string, newStatus: 'accepted' | 'declined', founderName: string) => {
    if (!user || currentUserRole !== 'mentor') return

    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: newStatus })
        .match({ founder_id: founderId, mentor_id: user.id })

      if (error) throw error

      toast.success(`Request from ${founderName} has been ${newStatus}!`)
      setConnections(prev => prev.map(c => 
        c.founder_id === founderId && c.mentor_id === user.id ? { ...c, status: newStatus } : c
      ))
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.")
    }
  }

  const handleDisconnect = async (targetId: string, targetName: string) => {
    if (!user || !currentUserRole) return

    const f_id = currentUserRole === 'founder' ? user.id : targetId
    const m_id = currentUserRole === 'mentor' ? user.id : targetId

    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .match({ founder_id: f_id, mentor_id: m_id })

      if (error) throw error

      toast.success(`Removed connection with ${targetName}`)
      setConnections(prev => prev.filter(c => !(c.founder_id === f_id && c.mentor_id === m_id)))
    } catch (err: any) {
      toast.error(err.message || "Failed to remove connection.")
    }
  }

  const getConnectionStatus = (profileId: string) => {
    const f_id = currentUserRole === 'founder' ? user?.id : profileId
    const m_id = currentUserRole === 'mentor' ? user?.id : profileId

    const conn = connections.find(c => c.founder_id === f_id && c.mentor_id === m_id)
    return conn ? conn.status : null
  }

  const searchLower = searchTerm.toLowerCase()
  const filteredProfiles = profiles.filter(p => 
    (p.full_name || "").toLowerCase().includes(searchLower) ||
    (p.industry || "").toLowerCase().includes(searchLower) ||
    (p.skills || "").toLowerCase().includes(searchLower)
  )

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading network discovery...</div>

  if (currentUserRole === 'mentor' && !isVerified) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-amber-100 p-4 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mb-4">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Account Under Review</h2>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Your mentor profile is currently pending verification by an administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8 relative">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Network Discovery & Matching</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {currentUserRole === 'founder' ? "Connect with mentors tailored to your industry and tech stack." : "Review incoming startup connection requests."}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search network..." 
              className="pl-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProfiles.map((profile) => {
          const status = getConnectionStatus(profile.id)
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
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase mt-1 w-fit">
                        {profile.role}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="h-3 w-3" />
                    <span>{matchScore}% Match</span>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate">Industry: {profile.industry || "General Strategy"}</span>
                  </div>
                  {profile.role === 'mentor' && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span>{profile.experience_years ? `${profile.experience_years}+ Years Experience` : "Experience unlisted"}</span>
                    </div>
                  )}
                  {profile.role === 'founder' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded text-zinc-500">
                        Stage: {profile.startup_stage || "Early Idea"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </div>

              <CardFooter className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex gap-2">
                <Button 
                  variant="outline" 
                  className="w-1/2 gap-1 bg-white dark:bg-zinc-950 text-xs"
                  onClick={() => setSelectedProfileModal(profile)}
                >
                  <FileText className="h-3.5 w-3.5" /> 
                  {currentUserRole === 'founder' ? 'View Profile' : 'View Pitch'}
                </Button>

                {currentUserRole === 'founder' && !status && (
                  <Button onClick={() => handleConnect(profile.id, profile.full_name)} className="w-1/2 gap-1 text-xs">
                    <UserPlus className="h-3.5 w-3.5" /> Connect
                  </Button>
                )}
                {currentUserRole === 'founder' && status === 'pending' && (
                  <Button variant="secondary" onClick={() => handleDisconnect(profile.id, profile.full_name)} className="w-1/2 hover:bg-red-50 hover:text-red-600 text-xs px-1">
                    <Clock className="h-3.5 w-3.5 mr-1" /> Pending
                  </Button>
                )}
                {currentUserRole === 'founder' && status === 'accepted' && (
                  <Button variant="outline" onClick={() => handleDisconnect(profile.id, profile.full_name)} className="w-1/2 border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-red-50 hover:text-red-600 text-xs px-1">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Connected
                  </Button>
                )}

                {currentUserRole === 'mentor' && !status && (
                  <div className="w-1/2 text-xs text-zinc-400 flex items-center justify-center">No request</div>
                )}
                {currentUserRole === 'mentor' && status === 'pending' && (
                  <div className="flex gap-1 w-1/2">
                    <Button size="sm" className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-1" onClick={() => handleUpdateStatus(profile.id, 'accepted', profile.full_name)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" className="w-1/2 text-red-600 hover:bg-red-50 text-[10px] px-1" onClick={() => handleUpdateStatus(profile.id, 'declined', profile.full_name)}>
                      Decline
                    </Button>
                  </div>
                )}
                {currentUserRole === 'mentor' && status === 'accepted' && (
                  <Button variant="outline" onClick={() => handleDisconnect(profile.id, profile.full_name)} className="w-1/2 border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-red-50 hover:text-red-600 text-xs px-1">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Connected
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {selectedProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-6 relative">
            
            <div className="flex items-start justify-between border-b pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-indigo-500/20">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedProfileModal.full_name}`} />
                  <AvatarFallback>{(selectedProfileModal.full_name || "??").substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">{selectedProfileModal.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                      {selectedProfileModal.role}
                    </Badge>
                    <span className="text-xs text-zinc-500">Match Compatibility: {calculateMatchScore(selectedProfileModal)}%</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedProfileModal(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
              
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

              {selectedProfileModal.role === 'founder' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 space-y-1">
                    <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Elevator Pitch / Solution</span>
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