import { ReactNode } from 'react';
import { useInstallerAuth } from '@/hooks/use-installer-auth';
import { useInstallerLogout } from '@/hooks/use-installer-logout';
import { Link } from 'wouter';
import { LogOut, Wrench, Menu, X, ChevronRight, HardHat } from 'lucide-react';
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

export function InstallerLayout({ children, title = 'Painel', showBack }: InstallerLayoutProps) {
  const { installer, isLoading } = useInstallerAuth();
  const logout = useInstallerLogout();
  
  if (isLoading || !installer) {
    return <div className="min-h-screen bg-muted/30" />;
  }

  const initials = installer.name.substring(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-secondary text-secondary-foreground">
      <div className="p-6">
        <div className="flex items-center gap-3 font-display font-bold text-2xl mb-8">
          <div className="bg-primary text-primary-foreground p-2 rounded-md">
            <HardHat className="w-6 h-6" />
          </div>
          Solo Execução
        </div>

        <div className="flex items-center gap-4 bg-secondary-foreground/10 p-4 rounded-xl mb-8">
          <Avatar className="w-12 h-12 border-2 border-primary">
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold text-lg leading-tight">{installer.name}</span>
            <span className="text-secondary-foreground/70 text-sm font-medium">{installer.teamName}</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <Link 
            href="/services" 
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
          >
            <Wrench className="w-5 h-5" />
            Serviços
          </Link>
        </nav>
      </div>

      <div className="mt-auto p-6">
        <Button 
          variant="outline" 
          className="w-full justify-start text-secondary-foreground border-secondary-foreground/20 hover:bg-secondary-foreground/10 hover:text-white"
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/30">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-72 flex flex-col min-h-[100dvh]">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 bg-white border-b px-4 h-16 flex items-center justify-between md:hidden shadow-sm">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 bg-secondary border-none">
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
              <div className="font-display font-bold text-xl flex items-center gap-2">
                <HardHat className="w-5 h-5 text-primary" />
                Solo
              </div>
            )}
          </div>
          <Avatar className="w-8 h-8 ring-2 ring-primary/20">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b px-8 h-20 items-center justify-between">
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
