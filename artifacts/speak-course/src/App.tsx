import { Switch, Route, Router as WouterRouter } from "wouter";
import { AccountProvider } from "@/components/AccountProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Assignments from "@/pages/Assignments";
import Assessments from "@/pages/Assessments";
import AssessmentRunner from "@/pages/AssessmentRunner";
import Analytics from "@/pages/Analytics";
import Integrity from "@/pages/Integrity";
import Administrative from "@/pages/Administrative";
import Diagnostics from "@/pages/Diagnostics";
import UnitView from "@/pages/UnitView";
import LectureView from "@/pages/LectureView";
import AssignmentDetail from "@/pages/AssignmentDetail";
import AttemptsList from "@/pages/AttemptsList";
import AttemptRunner from "@/pages/AttemptRunner";

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
        <Route path="/administrative" component={Administrative} />
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

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AccountProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AccountProvider>
    </WouterRouter>
  );
}

export default App;
