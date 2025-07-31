import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import MedicalDatabaseExtraction from "@/pages/medical-database-extraction";
import PatientList from "@/pages/patient-list";
import PatientDetail from "@/pages/patient-detail";
import ESignatureForm from "@/pages/e-signature-form";

function Router() {
  return (
    <Switch>
      <Route path="/patients" component={PatientList} />
      <Route path="/patient/new" component={ESignatureForm} />
      <Route path="/patient/:id" component={PatientDetail} />
      <Route path="/extraction" component={MedicalDatabaseExtraction} />
      <Route>
        <Redirect to="/patients" />
      </Route>
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
