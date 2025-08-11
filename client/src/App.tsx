import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import { Layout } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import MedicalDatabaseExtraction from "@/pages/medical-database-extraction";
import PatientList from "@/pages/patient-list";
import PatientDetail from "@/pages/patient-detail";
import ESignatureForm from "@/pages/e-signature-form";
import Organizations from "@/pages/organizations";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <Layout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/patients" component={PatientList} />
            <Route path="/patient/new" component={ESignatureForm} />
            <Route path="/patient/:id" component={PatientDetail} />
            <Route path="/extraction" component={MedicalDatabaseExtraction} />
            <Route path="/organizations" component={Organizations} />
            <Route>
              <Redirect to="/dashboard" />
            </Route>
          </Switch>
        </Layout>
      )}
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
