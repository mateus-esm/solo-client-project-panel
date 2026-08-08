import { ReactNode } from 'react';
import { useInstallerAuth } from '@/hooks/use-installer-auth';
import { useInstallerLogout } from '@/hooks/use-installer-logout';
import { Link, useLocation } from 'wouter';
import { LogOut, Wrench, Menu, X, ChevronRight, Wallet, Users } from 'lucide-react';
import logoUrl from '@assets/001_1775433962945.png';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";

interface InstallerLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

const NAV_ITEMS = [
  { href: '/services', label: 'Serviços', icon: Wrench },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/team', label: 'Minha Equipe', icon: Users },
] as const;

export function InstallerLayout({ children, title = 'Painel', showBack }: InstallerLayoutProps) {
  const { installer, isLoading } = useInstallerAuth();
  const logout = useInstallerLogout();
  const [location] = useLocation();
  
  if (isLoading || !installer) {
    return <div className="min-h-screen bg-muted/30" />;
  }

  const initials = installer.name.substring(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-white/5">
      <div className="p-6">
        <div className="flex flex-col gap-1 mb-8">
          <img src={logoUrl} alt="Solo Energia" className="h-9 w-auto object-contain self-start" />
          <span className="text-xs uppercase tracking-widest text-primary font-semibold">Equipe de Execução</span>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl mb-8">
          <Avatar className="w-12 h-12 border-2 border-primary">
            <AvatarFallback className="brand-gradient-135 text-white font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold text-lg leading-tight">{installer.name}</span>
            <span className="text-secondary-foreground/70 text-sm font-medium">{installer.teamName}</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={
                  'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ' +
                  (active
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground')
                }
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <Button 
          variant="outline" 
          className="w-full justify-start text-sidebar-foreground border-white/10 hover:bg-white/5 hover:text-white"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-72 flex flex-col min-h-[100dvh]">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 bg-sidebar border-none">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu de Navegação</SheetTitle>
                </SheetHeader>
                <SidebarContent />
              </SheetContent>
            </Sheet>
            
            {showBack ? (
              <Link href="/services" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-5 h-5 rotate-180" />
                <span className="font-medium text-sm">Voltar</span>
              </Link>
            ) : (
              <img src={logoUrl} alt="Solo Energia" className="h-7 w-auto object-contain" />
            )}
          </div>
          <Avatar className="w-8 h-8 ring-2 ring-primary/20">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-white/5 px-8 h-20 items-center justify-between">
          <div className="flex items-center gap-4">
            {showBack && (
              <Link href="/services" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-lg hover:bg-muted">
                <ChevronRight className="w-5 h-5 rotate-180" />
                <span className="font-medium">Voltar aos Serviços</span>
              </Link>
            )}
            {!showBack && (
              <h1 className="text-2xl font-display font-bold text-foreground">
                {title}
              </h1>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
