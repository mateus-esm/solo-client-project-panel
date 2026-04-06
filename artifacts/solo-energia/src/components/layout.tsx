import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Bell, LayoutDashboard, FileText, Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import logoLight from "@assets/001_1775433962945.png";
import { useListNotifications } from "@workspace/api-client-react";
import { useAuth, useLogout } from "@/hooks/use-auth";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: notifications } = useListNotifications();
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const { user } = useAuth();
  const logoutMutation = useLogout();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/documents", label: "Documentos", icon: FileText },
    { href: "/notifications", label: "Notificações", icon: Bell, badge: unreadCount },
  ];

  function getInitials(name: string) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center group">
                <img
                  src={logoLight}
                  alt="Solo Energia — Você no controle da sua energia"
                  className="h-8 w-auto object-contain opacity-95 group-hover:opacity-100 transition-opacity"
                />
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {(item.badge ?? 0) > 0 && (
                      <span className="absolute -top-2 -right-3 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute -bottom-[28px] left-0 right-0 h-[2px]"
                        style={{ background: "var(--brand-gradient)" }}
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Profile & Mobile Toggle */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-border">
                {user && (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ background: "var(--brand-gradient-135)" }}
                    >
                      {getInitials(user.clientName)}
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-xs font-medium text-foreground leading-tight">{user.clientName}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{user.clientEmail}</p>
                    </div>
                    <button
                      onClick={() => logoutMutation.mutate()}
                      disabled={logoutMutation.isPending}
                      title="Sair"
                      className="ml-1 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-border bg-card/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3 font-medium">
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </div>
                    {(item.badge ?? 0) > 0 && (
                      <span className="flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {user && (
                <>
                  <div className="flex items-center gap-3 px-4 pt-3 pb-1 border-t border-border mt-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ background: "var(--brand-gradient-135)" }}
                    >
                      {getInitials(user.clientName)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{user.clientName}</p>
                      <p className="text-[10px] text-muted-foreground">{user.clientEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setMobileMenuOpen(false); logoutMutation.mutate(); }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sair</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
