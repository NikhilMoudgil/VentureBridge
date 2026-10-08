import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/client"

const supabase = createClient()

export type Role = "founder" | "mentor" | "investor" | "admin"

type ProfileState = { forId: string | null; role: Role | null; hasProfile: boolean }

type AuthContextType = {
  user: User | null
  /** true until the session AND the role/profile lookup have finished */
  loading: boolean
  role: Role | null
  hasProfile: boolean
  /** Re-reads role and profile (call after onboarding creates them) */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  hasProfile: false,
  refresh: async () => {},
})

async function fetchProfileState(id: string): Promise<ProfileState> {
  try {
    const { data } = await supabase.from("users").select("role").eq("id", id).maybeSingle()
    const role = (data?.role as Role | undefined) ?? null

    let hasProfile = false
    if (role === "admin") {
      hasProfile = true // admins have no founder/mentor/investor row
    } else if (role) {
      const { data: row } = await supabase.from(`${role}s`).select("id").eq("id", id).maybeSingle()
      hasProfile = !!row
    }
    return { forId: id, role, hasProfile }
  } catch {
    return { forId: id, role: null, hasProfile: false }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileState>({ forId: null, role: null, hasProfile: false })
  const uid = user?.id ?? null

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setSessionLoading(false)
    })

    // Listen for login/logout events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setSessionLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Keyed on the user id (not the user object), so token refreshes don't trigger a re-fetch
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    fetchProfileState(uid).then((next) => {
      if (!cancelled) setProfile(next)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  const refresh = useCallback(async () => {
    if (uid) setProfile(await fetchProfileState(uid))
  }, [uid])

  const ready = !uid || profile.forId === uid

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: sessionLoading || !ready,
        role: uid && ready ? profile.role : null,
        hasProfile: Boolean(uid && ready && profile.hasProfile),
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to grab the user (and now role) anywhere in your app
export const useAuth = () => useContext(AuthContext)
