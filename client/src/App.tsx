import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AutomationTrigger from "@/pages/automation-trigger";
import LogsPage from "@/pages/logs";
import AnalyticsPage from "@/pages/analytics";
import InsuranceExtractionPage from "@/pages/insurance-extraction";
import PatientIntake from "@/pages/patient-intake";
import AudioTranscription from "@/pages/audio-transcription";
import AudioTranscriptionLocal from "@/pages/audio-transcription-local";
import AudioTranscriptionVosk from "@/pages/audio-transcription-vosk";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AutomationTrigger} />
      <Route path="/intake" component={PatientIntake} />
      <Route path="/audio" component={AudioTranscription} />
      <Route path="/audio-local" component={AudioTranscriptionLocal} />
      <Route path="/audio-vosk" component={AudioTranscriptionVosk} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/insurance" component={InsuranceExtractionPage} />
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
