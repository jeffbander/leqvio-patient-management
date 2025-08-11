import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import { Layout } from "@/components/Sidebar";
import Dashboard from "@/pages/dashboard";
import MedicalDatabaseExtraction from "@/pages/medical-database-extraction";
import PatientList from "@/pages/patient-list";
import PatientDetail from "@/pages/patient-detail";
import ESignatureForm from "@/pages/e-signature-form";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/patients" component={PatientList} />
        <Route path="/patient/new" component={ESignatureForm} />
        <Route path="/patient/:id" component={PatientDetail} />
        <Route path="/extraction" component={MedicalDatabaseExtraction} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </Layout>
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
