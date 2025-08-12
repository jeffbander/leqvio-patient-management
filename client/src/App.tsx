import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import { Layout } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import MedicalDatabaseExtraction from "@/pages/medical-database-extraction";
import PatientList from "@/pages/patient-list";
import PatientDetail from "@/pages/patient-detail";
import ESignatureForm from "@/pages/e-signature-form";
import OrganizationManagement from "@/pages/OrganizationManagement";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

function AuthenticatedRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/patients" component={PatientList} />
        <Route path="/patient/new" component={ESignatureForm} />
        <Route path="/patient/:id" component={PatientDetail} />
        <Route path="/extraction" component={MedicalDatabaseExtraction} />
        <Route path="/organization" component={OrganizationManagement} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </Layout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
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
