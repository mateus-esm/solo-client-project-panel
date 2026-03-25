import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import customFontUrl from "@assets/NeueMontreal-Bold_1774472757874.otf";

// Pages
import Dashboard from "@/pages/dashboard";
import Documents from "@/pages/documents";
import Notifications from "@/pages/notifications";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

// Inject custom font safely guaranteeing Vite asset pipeline resolution
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/documents" component={Documents} />
      <Route path="/notifications" component={Notifications} />
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
