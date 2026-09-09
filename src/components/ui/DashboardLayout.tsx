import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/ui/AuthProvider";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "./ModeToggle";
const supabase = createClient();

export function DashboardLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Generate initials for the avatar if no image exists
  const initials = user?.email?.substring(0, 2).toUpperCase() || "VB";
  // Grab Google/GitHub profile picture if available
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* --- HEADER --- */}
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          
          {/* 1. Logo */}
          <Link to="/dashboard" className="text-xl font-bold tracking-tight">
            VentureBridge
          </Link>

          {/* 2. Desktop Navigation */}
          <nav className="hidden gap-6 md:flex">
            <Link to="/dashboard" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">Home</Link>
            <Link to="/dashboard/idealab" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">IdeaLab</Link>
            <Link to="/dashboard/network" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">Network</Link>
            <Link to="/dashboard/messages" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">Messages</Link>
          </nav>

          {/* 3. Right Side Actions (Toggle + Avatar) */}
          <div className="flex items-center gap-2 md:gap-4">
            
            <ModeToggle />
            
            {/* Premium subtle vertical divider */}
            <div className="hidden h-5 w-px bg-zinc-200 dark:bg-zinc-800 md:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl} alt="User Avatar" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-zinc-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile" className="w-full cursor-pointer">
                    Profile Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT INJECTION POINT --- */}
      <main className="container mx-auto flex-1 px-4 py-8 md:px-8">
        <Outlet />
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t bg-white dark:bg-zinc-950">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 text-sm text-zinc-500 md:px-8">
          <p>© {new Date().getFullYear()} VentureBridge.</p>
          <div className="flex gap-4">
            <Link to="#" className="hover:underline">
              Privacy
            </Link>
            <Link to="#" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
