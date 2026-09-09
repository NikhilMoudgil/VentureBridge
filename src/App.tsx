import { useEffect, useState } from "react"
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LoginForm } from "@/features/auth/LoginForm"
import { SignupForm } from "@/features/auth/SignupForm"
import { DashboardLayout } from "@/features/dashboard/DashboardLayout"
import { Onboarding } from "@/features/auth/Onboarding"
import { AuthProvider, useAuth } from "@/app/AuthProvider"
import { createClient } from "@/lib/client"
import { ProfileSettings } from "@/features/profiles/ProfileSettings"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { Toaster } from "sonner"
import { ThemeProvider } from "./app/ThemeProvider"
import { IdeaLab } from "@/features/ideas/IdeaLab"
import { MyVentures } from "@/features/ideas/MyVentures"
import { NetworkDiscovery } from "@/features/matching/NetworkDiscovery"
const supabase = createClient()

// --- Route Guard with Profile Checking ---
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    async function checkProfile() {
      if (!user) return

      // CHANGED: .single() to .maybeSingle() to prevent 406 errors
      const { data: founder } = await supabase.from('founders').select('id').eq('id', user.id).maybeSingle()
      const { data: mentor } = await supabase.from('mentors').select('id').eq('id', user.id).maybeSingle()
      
      setHasProfile(!!founder || !!mentor)
    }

    if (user) checkProfile()
  }, [user])

  // Wait until both Auth and Database checks are complete
  if (authLoading || (user && hasProfile === null)) {
    return <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">Loading VentureBridge...</div>
  }

  // Kick unauthenticated users to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect to onboarding if they have no profile (and aren't already there)
  if (!hasProfile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // If they DO have a profile, block them from going back to the onboarding screen
  if (hasProfile && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// --- Pages ---
function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-zinc-950">
      <h1 className="text-4xl font-bold tracking-tight">VentureBridge</h1>
      <p className="text-zinc-500">Connect Founders with the right Mentors.</p>
      <div className="flex gap-4">
        <Link to="/login">
          <Button variant="outline">Sign In</Button>
        </Link>
        <Link to="/signup">
          <Button>Register</Button>
        </Link>
      </div>
    </div>
  )
}

function Login() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <LoginForm />
    </div>
  )
}

function Signup() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <SignupForm />
    </div>
  )
}



// --- Main App Router ---
export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Protected Onboarding Route (No Layout Wrapper) */}
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } 
        />
        
        {/* Protected Dashboard Layout */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } 
        >
          {/* This renders inside the <Outlet /> at exactly /dashboard */}
          <Route index element={<Dashboard />} />
          
          {/* Profile Settings Route */}
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="ventures" element={<MyVentures />} />
          <Route path="idealab" element={<IdeaLab />} />
          <Route path="network" element={<NetworkDiscovery />} />
        </Route>
      </Routes>
      <Toaster/>
      </ThemeProvider>
    </AuthProvider>
  )
}