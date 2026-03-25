import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Bell, LayoutDashboard, FileText, Menu, X, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import logoSrc from "@assets/003_1774472742998.png";
import { useListNotifications } from "@workspace/api-client-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { data: notifications } = useListNotifications();
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/documents", label: "Documentos", icon: FileText },
    { href: "/notifications", label: "Notificações", icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center p-1.5 border border-white/10 group-hover:border-primary/50 transition-colors">
                  <img src={logoSrc} alt="Solo Energia" className="w-full h-full object-contain" />
                </div>
                <span className="font-display font-bold text-xl tracking-wide hidden sm:block">
                  SOLO <span className="text-primary">ENERGIA</span>
                </span>
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
                    {item.badge > 0 && (
                      <span className="absolute -top-2 -right-3 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div 
                        layoutId="nav-indicator"
                        className="absolute -bottom-[28px] left-0 right-0 h-[2px] bg-primary"
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
                <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover-elevate cursor-pointer transition-colors hover:text-primary">
                  <User className="w-5 h-5" />
                </div>
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
                      isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3 font-medium">
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </div>
                    {item.badge > 0 && (
                      <span className="flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
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
