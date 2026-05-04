import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

import customFontUrl from "@assets/NeueMontreal-Bold_1774472757874.otf";

import Dashboard from "@/pages/dashboard";
import Documents from "@/pages/documents";
import Notifications from "@/pages/notifications";
import Finance from "@/pages/finance";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/index";
import AdminNewProject from "@/pages/admin/new-project";
import AdminProjectEditor from "@/pages/admin/project-editor";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

const FontInjector = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @font-face {
      font-family: 'Neue Montreal Bold';
      src: url('${customFontUrl}') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
  `}} />
);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/admin/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Client portal */}
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <AuthGuard><Dashboard /></AuthGuard>}
      </Route>
      <Route path="/documents">
        {() => <AuthGuard><Documents /></AuthGuard>}
      </Route>
      <Route path="/notifications">
        {() => <AuthGuard><Notifications /></AuthGuard>}
      </Route>
      <Route path="/finance">
        {() => <AuthGuard><Finance /></AuthGuard>}
      </Route>

      {/* Admin panel */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">
        {() => <AdminGuard><AdminDashboard /></AdminGuard>}
      </Route>
      <Route path="/admin/projects/new">
        {() => <AdminGuard><AdminNewProject /></AdminGuard>}
      </Route>
      <Route path="/admin/projects/:id">
        {() => <AdminGuard><AdminProjectEditor /></AdminGuard>}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FontInjector />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
