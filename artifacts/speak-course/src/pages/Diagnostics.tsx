import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, PlayCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DiagnosticStep {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
  error?: string;
}

interface DiagnosticResult {
  ok: boolean;
  generatedAt: string;
  steps: DiagnosticStep[];
}

export default function Diagnostics() {
  const [systemResult, setSystemResult] = useState<DiagnosticResult | null>(null);
  const [syntheticResult, setSyntheticResult] = useState<DiagnosticResult | null>(null);
  const [isRunningSystem, setIsRunningSystem] = useState(false);
  const [isRunningSynthetic, setIsRunningSynthetic] = useState(false);

  const runSystemTest = async () => {
    setIsRunningSystem(true);
    try {
      const res = await fetch("/api/speaking/diagnostics/system");
      const data = await res.json();
      setSystemResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningSystem(false);
    }
  };

  const runSyntheticTest = async () => {
    setIsRunningSynthetic(true);
    try {
      const res = await fetch("/api/speaking/diagnostics/synthetic-run", { method: "POST" });
      const data = await res.json();
      setSyntheticResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningSynthetic(false);
    }
  };

  const renderResult = (result: DiagnosticResult | null) => {
    if (!result) return null;

    return (
      <div className="mt-6 space-y-4">
        <div className={`text-lg font-bold ${result.ok ? "text-green-600" : "text-destructive"}`}>
          Status: {result.ok ? "PASS" : "FAIL"}
        </div>
        <div className="space-y-2">
          {result.steps.map((step, idx) => (
            <Alert key={idx} variant={step.ok ? "default" : "destructive"}>
              <AlertTitle className="flex justify-between items-center">
                <span>{step.name}</span>
                <span className="text-sm font-normal text-muted-foreground">{step.ms}ms</span>
              </AlertTitle>
              {(step.detail || step.error) && (
                <AlertDescription className="mt-2 text-sm font-mono whitespace-pre-wrap break-words">
                  {step.detail}
                  {step.error && <div className="text-destructive mt-1">{step.error}</div>}
                </AlertDescription>
              )}
            </Alert>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-bold">Diagnostics</h1>
        <p className="text-muted-foreground mt-2">
          Run system checks and synthetic tests to verify studio functionality.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              System Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Verifies database connectivity, AI services, and object storage availability.
            </p>
            <Button 
              onClick={runSystemTest} 
              disabled={isRunningSystem}
              className="w-full"
            >
              {isRunningSystem ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Run System Check
            </Button>
            {renderResult(systemResult)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-secondary" />
              Synthetic Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Executes a full mock attempt, verifying grading pipelines and storage.
            </p>
            <Button 
              onClick={runSyntheticTest} 
              disabled={isRunningSynthetic}
              variant="secondary"
              className="w-full"
            >
              {isRunningSynthetic ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Run Synthetic Test
            </Button>
            {renderResult(syntheticResult)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
