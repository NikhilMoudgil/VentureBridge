import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/features/auth/LoginForm";
import { SignupForm } from "@/features/auth/SignupForm";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { Onboarding } from "@/features/auth/Onboarding";
import { AuthProvider, useAuth, type Role } from "@/app/AuthProvider";
import { ProfileSettings } from "@/features/profiles/ProfileSettings";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { Toaster } from "sonner";
import { ThemeProvider } from "./app/ThemeProvider";
import { IdeaLab } from "@/features/ideas/IdeaLab";
import { MyVentures } from "@/features/ideas/MyVentures";
import { NetworkDiscovery } from "@/features/matching/NetworkDiscovery";
import { AdminLogin } from "@/features/auth/AdminLogin";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { Messages } from "@/features/messages/Messages";
import { ValidationLab } from "@/features/ideas/ValidationLab";
import { DealFlow } from "@/features/investors/DealFlow";
import { Portfolio } from "@/features/investors/Portfolio";

// --- Route Guard: login + profile check (role and profile now come from AuthProvider) ---
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, hasProfile } = useAuth();
  const location = useLocation();

  // Wait until both Auth and the role/profile lookup are complete
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        Loading VentureBridge...
      </div>
    );
  }

  // Kick unauthenticated users to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admins use their own console, not the member dashboard
  if (role === "admin") {
    return <Navigate to="/admin/operations" replace />;
  }

  // Redirect to onboarding if they have no profile (and aren't already there)
  if (!hasProfile && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If they DO have a profile, block them from going back to the onboarding screen
  if (hasProfile && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// --- Route Guard: only the listed roles may open this page ---
// (The navbar already hides these links; this stops people typing the URL.)
function RoleRoute({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role || !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// --- Pages ---
function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-zinc-950">
      <h1 className="text-4xl font-bold tracking-tight">VentureBridge</h1>
      <p className="text-zinc-500">Connect Founders with the right Mentors and Investors.</p>
      <div className="flex gap-4">
        <Link to="/login">
          <Button variant="outline">Sign In</Button>
        </Link>
        <Link to="/signup">
          <Button>Register</Button>
        </Link>
      </div>
    </div>
  );
}

function Login() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <LoginForm />
    </div>
  );
}

function Signup() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <SignupForm />
    </div>
  );
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
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin/operations" element={<AdminDashboard />} />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />

            {/* Core Routes (all roles) */}
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="network" element={<NetworkDiscovery />} />
            <Route path="messages" element={<Messages />} />

            {/* Founder-only Routes */}
            <Route path="ventures" element={<RoleRoute allow={["founder"]}><MyVentures /></RoleRoute>} />
            <Route path="idealab" element={<RoleRoute allow={["founder"]}><IdeaLab /></RoleRoute>} />
            <Route path="validation" element={<RoleRoute allow={["founder"]}><ValidationLab /></RoleRoute>} />

            {/* Investor-only Routes */}
            <Route path="dealflow" element={<RoleRoute allow={["investor"]}><DealFlow /></RoleRoute>} />
            <Route path="portfolio" element={<RoleRoute allow={["investor"]}><Portfolio /></RoleRoute>} />
          </Route>
        </Routes>
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  );
}
