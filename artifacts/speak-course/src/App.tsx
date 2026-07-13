import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";

import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Assignments from "@/pages/Assignments";
import Assessments from "@/pages/Assessments";
import AssessmentRunner from "@/pages/AssessmentRunner";
import Analytics from "@/pages/Analytics";
import Integrity from "@/pages/Integrity";
import Diagnostics from "@/pages/Diagnostics";
import UnitView from "@/pages/UnitView";
import LectureView from "@/pages/LectureView";
import AssignmentDetail from "@/pages/AssignmentDetail";
import AttemptsList from "@/pages/AttemptsList";
import AttemptRunner from "@/pages/AttemptRunner";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/assignments" component={Assignments} />
        <Route path="/assessments" component={Assessments} />
        <Route path="/assessments/:assessmentId" component={AssessmentRunner} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/integrity" component={Integrity} />
        <Route path="/diagnostics" component={Diagnostics} />
        <Route path="/units/:unitNumber" component={UnitView} />
        <Route path="/lectures/:lectureId" component={LectureView} />
        <Route path="/assignments/:assignmentId" component={AssignmentDetail} />
        <Route path="/attempts" component={AttemptsList} />
        <Route path="/attempts/:attemptId" component={AttemptRunner} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
