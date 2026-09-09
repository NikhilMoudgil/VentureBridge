import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { useAuth } from "@/app/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, UserPlus, Briefcase, GraduationCap } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient()

type NetworkProfile = {
  id: string
  full_name: string
  role: string
  details?: any // Will hold either founder or mentor specific data
}

export function NetworkDiscovery() {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<'founder' | 'mentor' | null>(null)
  const [profiles, setProfiles] = useState<NetworkProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    async function fetchNetwork() {
      if (!user) return

      // 1. Get current user's role
      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      
      if (userData) {
        const role = userData.role
        setCurrentUserRole(role)

        // 2. Determine target role (Founders look for Mentors, Mentors look for Founders)
        const targetRole = role === 'founder' ? 'mentor' : 'founder'

        // 3. Fetch users of the target role
        const { data: networkData } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('role', targetRole)
          .neq('id', user.id) // Exclude self just in case

        if (networkData) {
          // For a production app, you would do a SQL join here. 
          // For now, we set the base user data.
          setProfiles(networkData)
        }
      }
      setLoading(false)
    }

    fetchNetwork()
  }, [user])

  const handleConnect = (name: string) => {
    toast.success(`Connection request sent to ${name}`)
  }

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Scanning network...</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      
      {/* Header & Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Network Discovery</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {currentUserRole === 'founder' 
              ? "Find technical and strategic mentors to accelerate your venture." 
              : "Discover high-potential founders and review their IdeaLab pitches."}
          </p>
        </div>
        
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search by name or keyword..." 
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

      {/* Empty State */}
      {filteredProfiles.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
          <Search className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No profiles found</h3>
          <p className="text-sm text-zinc-500">Try adjusting your search filters.</p>
        </div>
      )}

      {/* Directory Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProfiles.map((profile) => (
          <Card key={profile.id} className="group overflow-hidden border-zinc-200 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-950">
            <CardHeader className="flex flex-row items-start gap-4 pb-4">
              <Avatar className="h-12 w-12 border border-zinc-200 dark:border-zinc-800">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}`} />
                <AvatarFallback>{profile.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <CardTitle className="text-lg">{profile.full_name || "Anonymous User"}</CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                    {profile.role}
                  </Badge>
                  <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">
                    94% Match
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {profile.role === 'mentor' ? (
                <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-zinc-400" />
                    <span>Specializes in Go-to-Market & SaaS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-zinc-400" />
                    <span>10+ Years Experience</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-zinc-400" />
                    <span>Building in AI/FinTech</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-zinc-400" />
                    <span>MVP Stage</span>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <Button onClick={() => handleConnect(profile.full_name)} className="w-full gap-2">
                <UserPlus className="h-4 w-4" /> Connect
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}