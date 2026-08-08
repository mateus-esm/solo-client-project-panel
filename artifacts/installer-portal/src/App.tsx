import { type ReactNode, useEffect } from 'react';
import customFontUrl from '@assets/NeueMontreal-Bold_1774472757874.otf';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import ServicesDashboard from '@/pages/services';
import ServiceDetail from '@/pages/service-detail';
import { useInstallerAuth } from '@/hooks/use-installer-auth';
import { Loader2 } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
  Redirect,
} from 'wouter';

const queryClient = new QueryClient();

// Brand display font (same as the Solo Energia client portal)
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

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useInstallerAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component {...rest} />;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useInstallerAuth();
  
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return <Redirect to={isAuthenticated ? "/services" : "/login"} />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/login" component={Login} />
        <Route path="/services">
          {() => <ProtectedRoute component={ServicesDashboard} />}
        </Route>
        <Route path="/services/:id">
          {() => <ProtectedRoute component={ServiceDetail} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FontInjector />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
