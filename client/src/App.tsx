import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AutomationTrigger from "@/pages/automation-trigger";
import LogsPage from "@/pages/logs";
import Landing from "@/pages/landing";
import AuthFallback from "@/pages/auth-fallback";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, isReplitRequired } = useAuth();

  return (
    <Switch>
      {isLoading ? (
        <Route path="/" component={Landing} />
      ) : isReplitRequired ? (
        <Route path="/" component={AuthFallback} />
      ) : !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={AutomationTrigger} />
          <Route path="/logs" component={LogsPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
