import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
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
import { ModeToggle } from "@/components/ModeToggle";
import { Menu, X } from "lucide-react";

const supabase = createClient();

export function DashboardLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<'founder' | 'mentor' | 'investor' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    async function fetchRole() {
      if (!user) return;
      const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
      if (data) setRole(data.role);
    }
    fetchRole();
  }, [user]);

  // Clear unread count when user opens the Messages page
  useEffect(() => {
    setMobileMenuOpen(false);
    if (location.pathname === "/dashboard/messages") {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  // Realtime notification badge listener for incoming messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`nav_notifications_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        if (payload.new.receiver_id === user.id && location.pathname !== "/dashboard/messages") {
          setUnreadCount((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() || "VB";
  const avatarUrl = user?.user_metadata?.avatar_url;

  const navLinks = [
    { to: "/dashboard", label: "Home", show: true },
    { to: "/dashboard/idealab", label: "IdeaLab", show: role === "founder" },
    { to: "/dashboard/ventures", label: "My Ventures", show: role === "founder" },
    { to: "/dashboard/validation", label: "Validation Lab", show: role === "founder" },
    { to: "/dashboard/dealflow", label: "Deal Flow", show: role === "investor" },
    { to: "/dashboard/portfolio", label: "Portfolio", show: role === "investor" },
    { to: "/dashboard/network", label: "Network", show: true },
    { to: "/dashboard/messages", label: "Messages", show: true },
  ].filter((link) => link.show);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          
          {/* 1. Logo */}
          <Link to="/dashboard" className="text-xl font-bold tracking-tight">
            VentureBridge
          </Link>

          {/* 2. Desktop Navigation */}
          <nav className="hidden gap-6 md:flex items-center">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="relative flex items-center text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                {link.label}
                {link.to === "/dashboard/messages" && unreadCount > 0 && (
                  <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white leading-none">
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* 3. Right Side Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            <ModeToggle />
            
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
                    <p className="text-xs font-mono text-indigo-500 capitalize">{role}</p>
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

            {/* Mobile Navigation Trigger Button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-600" />
              )}
            </Button>
          </div>
        </div>

        {/* 4. Mobile Dropdown Navigation Menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-white px-4 py-3 dark:bg-zinc-950 md:hidden animate-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <span>{link.label}</span>
                  {link.to === "/dashboard/messages" && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* --- MAIN CONTENT INJECTION POINT --- */}
      <main className="container mx-auto flex-1 px-4 py-6 md:px-8 md:py-8">
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