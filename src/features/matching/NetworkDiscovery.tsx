import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, UserPlus, Briefcase, GraduationCap, Clock, CheckCircle2, FileText, X, Target } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type NetworkProfile = {
  id: string
  full_name: string
  role: string
  industry?: string
  experience_years?: number
  skills?: string
  is_verified?: boolean
  idea?: any 
  matchScore?: number 
}

// --- THE MATCHING ALGORITHM ---
function calculateMatchScore(currentUserContext: any, targetProfile: NetworkProfile): number {
  let score = 45 

  if (!currentUserContext) return score

  try {
    const myIndustry = (currentUserContext.industry || "").toLowerCase()
    const mySkills = (currentUserContext.skills || "").toLowerCase()
    
    const targetIndustry = (targetProfile.industry || "").toLowerCase()
    const targetSkills = (targetProfile.skills || "").toLowerCase()

    if (myIndustry && targetIndustry && (myIndustry.includes(targetIndustry) || targetIndustry.includes(myIndustry))) {
      score += 30
    }

    if (mySkills && targetSkills) {
      const mySkillsArray = mySkills.split(',').map((s: string) => s.trim())
      const hasSkillMatch = mySkillsArray.some((skill: string) => skill.length > 2 && targetSkills.includes(skill))
      if (hasSkillMatch) score += 15
    }

    if (currentUserContext.role === 'mentor' && targetProfile.idea) {
      const ideaMarket = (targetProfile.idea.target_market || "").toLowerCase()
      if (ideaMarket && myIndustry && ideaMarket.includes(myIndustry)) score += 10
    } else if (currentUserContext.role === 'founder' && currentUserContext.idea) {
      const ideaMarket = (targetProfile.idea.target_market || "").toLowerCase()
      if (ideaMarket && targetIndustry && ideaMarket.includes(targetIndustry)) score += 10
    }

    if (targetProfile.experience_years) {
      if (targetProfile.experience_years >= 10) score += 10
      else if (targetProfile.experience_years >= 5) score += 5
    }

  } catch (e) {
    console.error("Match calculation error:", e)
  }

  return Math.min(score, 99)
}

export function NetworkDiscovery() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<'founder' | 'mentor' | null>(null)
  const [profiles, setProfiles] = useState<NetworkProfile[]>([])
  const [connections, setConnections] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [selectedProfile, setSelectedProfile] = useState<NetworkProfile | null>(null)

  useEffect(() => {
    async function fetchNetwork() {
      if (!user) return

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
      
      if (userData) {
        const role = userData.role
        setCurrentUserRole(role)
        const targetRole = role === 'founder' ? 'mentor' : 'founder'

        let currentUserContext = { ...userData, idea: null }

        if (role === 'founder') {
          const { data: myIdea } = await supabase.from('ideas').select('*').eq('id', user.id).maybeSingle()
          currentUserContext.idea = myIdea
        }

        let query = supabase
          .from('users')
          .select('id, full_name, role, industry, experience_years, skills, is_verified')
          .eq('role', targetRole)
          .neq('id', user.id)

        if (targetRole === 'mentor') {
          query = query.not('industry', 'is', null).eq('is_verified', true)
        }

        const { data: networkData } = await query

        if (networkData) {
          let enrichedProfiles = [...networkData]

          if (targetRole === 'founder') {
            const founderIds = networkData.map(p => p.id)
            const { data: ideasData } = await supabase.from('ideas').select('*').in('id', founderIds)
            
            enrichedProfiles = networkData.map(p => ({
              ...p,
              idea: ideasData?.find(i => i.id === p.id) 
            }))
          }

          const scoredProfiles = enrichedProfiles.map(p => ({
            ...p,
            matchScore: calculateMatchScore(currentUserContext, p)
          })).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))

          setProfiles(scoredProfiles)
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

  // FIXED: Bidirectional Upsert to prevent unique constraint crashes on re-connect
  const handleConnect = async (targetId: string, targetName: string) => {
    if (!user || !currentUserRole) return

    const f_id = currentUserRole === 'founder' ? user.id : targetId
    const m_id = currentUserRole === 'mentor' ? user.id : targetId

    try {
      const { error } = await supabase
        .from('connections')
        .upsert({ 
          founder_id: f_id, 
          mentor_id: m_id, 
          status: 'pending' 
        }, { onConflict: 'founder_id,mentor_id' })

      if (error) throw error

      toast.success(`Connection request sent to ${targetName}`)
      
      setConnections(prev => [
        ...prev.filter(c => !(c.founder_id === f_id && c.mentor_id === m_id)),
        { founder_id: f_id, mentor_id: m_id, status: 'pending' }
      ])
    } catch (err: any) {
      toast.error(err.message || "Failed to send connection request.")
    }
  }

  // FIXED: Bidirectional Delete to completely wipe connection rows from either side
  const handleDisconnect = async (targetId: string, targetName: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .or(`and(founder_id.eq.${user.id},mentor_id.eq.${targetId}),and(founder_id.eq.${targetId},mentor_id.eq.${user.id})`)

      if (error) throw error

      toast.success(`Disconnected from ${targetName}`)
      
      setConnections(prev => prev.filter(c => 
        !((c.founder_id === user.id && c.mentor_id === targetId) || (c.founder_id === targetId && c.mentor_id === user.id))
      ))
    } catch (err: any) {
      toast.error(err.message || "Failed to remove connection.")
    }
  }

  // FIXED: Bidirectional Status Checker
  const getConnectionStatus = (targetId: string) => {
    const conn = connections.find(c => 
      (c.founder_id === user?.id && c.mentor_id === targetId) || 
      (c.founder_id === targetId && c.mentor_id === user?.id)
    )
    return conn ? conn.status : null
  }

  const searchLower = searchTerm.toLowerCase()
  const filteredProfiles = profiles.filter(p => 
    (p.full_name || "").toLowerCase().includes(searchLower) ||
    (p.industry || "").toLowerCase().includes(searchLower) ||
    (p.skills || "").toLowerCase().includes(searchLower) ||
    (p.idea?.target_market || "").toLowerCase().includes(searchLower)
  )

  if (loading) return <div className="p-8 text-center text-zinc-500">Executing matching algorithm...</div>

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8 relative">
      
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Network Discovery</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {currentUserRole === 'founder' 
              ? "Find technical and strategic mentors matched to your profile." 
              : "Discover high-potential founders matched to your industry expertise."}
          </p>
        </div>
        
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search by name, industry, or market..." 
              className="pl-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredProfiles.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
          <Search className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No profiles found</h3>
          <p className="text-sm text-zinc-500">Try adjusting your search filters.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProfiles.map((profile) => {
          const status = getConnectionStatus(profile.id)
          const score = profile.matchScore || 0
          
          let scoreColor = "text-zinc-500"
          if (score >= 80) scoreColor = "text-emerald-600 dark:text-emerald-500 font-bold"
          else if (score >= 60) scoreColor = "text-amber-600 dark:text-amber-500 font-semibold"

          return (
            <Card key={profile.id} className="group overflow-hidden border-zinc-200 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-950">
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <Avatar className="h-12 w-12 border border-zinc-200 dark:border-zinc-800">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}`} />
                  <AvatarFallback>{(profile.full_name || "??").substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <CardTitle className="text-lg truncate max-w-[180px]">{profile.full_name || "Anonymous User"}</CardTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                      {profile.role}
                    </Badge>
                    <span className={`text-xs ${scoreColor}`}>
                      {score}% Match
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pb-4 h-20">
                {profile.role === 'mentor' ? (
                  <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="truncate">Specializes in {profile.industry || "General Strategy"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span>{profile.experience_years ? `${profile.experience_years}+ Years Experience` : "Experience unlisted"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="truncate">
                        {profile.industry ? `Background in ${profile.industry}` : `Building in ${profile.idea?.target_market || "Stealth"}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span>{profile.idea?.problem ? "Idea Validated" : "Ideation Stage"}</span>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex gap-2">
                <Button 
                  variant="outline" 
                  className="w-1/2 gap-2 bg-white dark:bg-zinc-950"
                  onClick={() => setSelectedProfile(profile)}
                >
                  <FileText className="h-4 w-4" /> 
                  {profile.role === 'founder' ? 'View Pitch' : 'Profile'}
                </Button>

                {!status && (
                  <Button onClick={() => handleConnect(profile.id, profile.full_name)} className="w-1/2 gap-2">
                    <UserPlus className="h-4 w-4" /> Connect
                  </Button>
                )}
                {status === 'pending' && (
                  <Button 
                    variant="secondary" 
                    onClick={() => handleDisconnect(profile.id, profile.full_name)}
                    className="w-1/2 gap-2 px-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-500 group transition-colors"
                  >
                    <Clock className="h-4 w-4 group-hover:hidden" /> 
                    <X className="h-4 w-4 hidden group-hover:block" />
                    <span className="group-hover:hidden">Pending</span>
                    <span className="hidden group-hover:block">Cancel</span>
                  </Button>
                )}
                {status === 'accepted' && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleDisconnect(profile.id, profile.full_name)}
                    className="w-1/2 gap-2 px-0 border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-emerald-900/10 dark:text-emerald-500 dark:hover:bg-red-900/20 dark:hover:border-red-900/50 group transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4 group-hover:hidden" /> 
                    <X className="h-4 w-4 hidden group-hover:block" />
                    <span className="group-hover:hidden">Connected</span>
                    <span className="hidden group-hover:block">Disconnect</span>
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex items-start justify-between p-6 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-zinc-200 dark:border-zinc-800">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedProfile.full_name}`} />
                  <AvatarFallback>{(selectedProfile.full_name || "??").substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{selectedProfile.full_name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{selectedProfile.role}</Badge>
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
                      {selectedProfile.matchScore}% Match
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProfile(null)}
                className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8">
              
              {selectedProfile.role === 'founder' ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2 uppercase tracking-wider">Elevator Pitch</h3>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                      {selectedProfile.idea?.elevator_pitch || "This founder hasn't added an elevator pitch to their IdeaLab yet."}
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Target className="h-4 w-4" /> Target Market
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {selectedProfile.idea?.target_market || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Briefcase className="h-4 w-4" /> Founder Background
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {selectedProfile.industry || "Not specified"}
                      </p>
                    </div>
                  </div>

                  {selectedProfile.idea?.tech_stack && (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 uppercase tracking-wider">Proposed Tech Stack</h3>
                      <div className="flex flex-wrap gap-2">
                        {String(selectedProfile.idea.tech_stack).split(',').map((tech: string, i: number) => (
                          <Badge key={i} variant="outline" className="bg-zinc-50 dark:bg-zinc-900">
                            {tech.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-zinc-500" /> Primary Industry
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {selectedProfile.industry || "General Strategy"}
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-zinc-500" /> Experience
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {selectedProfile.experience_years ? `${selectedProfile.experience_years}+ Years` : "Experience unlisted"}
                      </p>
                    </div>
                  </div>

                  {selectedProfile.skills && (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 uppercase tracking-wider">Core Competencies</h3>
                      <div className="flex flex-wrap gap-2">
                        {String(selectedProfile.skills).split(',').map((skill: string, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">
                            {skill.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900/30 rounded-b-xl flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedProfile(null)}>
                Close
              </Button>
              
              {!getConnectionStatus(selectedProfile.id) && (
                <Button onClick={() => handleConnect(selectedProfile.id, selectedProfile.full_name)} className="gap-2">
                  <UserPlus className="h-4 w-4" /> Connect Now
                </Button>
              )}
              {getConnectionStatus(selectedProfile.id) === 'pending' && (
                <Button 
                  variant="secondary" 
                  onClick={() => handleDisconnect(selectedProfile.id, selectedProfile.full_name)}
                  className="gap-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-500 group transition-colors"
                >
                  <Clock className="h-4 w-4 group-hover:hidden" /> 
                  <X className="h-4 w-4 hidden group-hover:block" />
                  <span className="group-hover:hidden">Request Pending</span>
                  <span className="hidden group-hover:block">Cancel Request</span>
                </Button>
              )}
              {getConnectionStatus(selectedProfile.id) === 'accepted' && (
                <Button 
                  variant="outline" 
                  onClick={() => handleDisconnect(selectedProfile.id, selectedProfile.full_name)}
                  className="gap-2 border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-emerald-900/10 dark:text-emerald-500 dark:hover:bg-red-900/20 dark:hover:border-red-900/50 group transition-all"
                >
                  <CheckCircle2 className="h-4 w-4 group-hover:hidden" /> 
                  <X className="h-4 w-4 hidden group-hover:block" />
                  <span className="group-hover:hidden">Connected</span>
                  <span className="hidden group-hover:block">Disconnect</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}