import {
  useGetSpeakingAssignment,
  getGetSpeakingAssignmentQueryKey,
  useStartSpeakingAttempt,
  useGenerateSpeakingPractice,
  useListSpeakingPractice,
  getListSpeakingPracticeQueryKey,
} from "@workspace/api-client-react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Play,
  AlertCircle,
  Sparkles,
  Loader2,
  Repeat,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function AssignmentDetail() {
  const [, params] = useRoute("/assignments/:assignmentId");
  const assignmentId = params?.assignmentId ? parseInt(params.assignmentId, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignment, isLoading, error } = useGetSpeakingAssignment(assignmentId, {
    query: {
      enabled: !!assignmentId,
      queryKey: getGetSpeakingAssignmentQueryKey(assignmentId)
    }
  });

  const { data: practiceSets } = useListSpeakingPractice(assignmentId, {
    query: {
      enabled: !!assignmentId,
      queryKey: getListSpeakingPracticeQueryKey(assignmentId),
    },
  });

  const startAttempt = useStartSpeakingAttempt();
  const generatePractice = useGenerateSpeakingPractice();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg max-w-3xl mx-auto">
        Failed to load assignment.
      </div>
    );
  }

  const handleStart = () => {
    startAttempt.mutate({ assignmentId }, {
      onSuccess: (attempt) => {
        setLocation(`/attempts/${attempt.id}`);
      }
    });
  };

  const handleGeneratePractice = async () => {
    try {
      const result = await generatePractice.mutateAsync({ assignmentId });
      await queryClient.invalidateQueries({
        queryKey: getListSpeakingPracticeQueryKey(assignmentId),
      });
      toast({
        title: "Fresh practice ready",
        description: "Brand-new questions — never the graded ones. Coach is on call.",
      });
      setLocation(`/attempts/${result.attemptId}`);
    } catch (err: any) {
      toast({
        title: "Couldn't build practice",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const sets = practiceSets ?? [];

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href={`/units/${assignment.unitNumber}`}>
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Unit {assignment.unitNumber}
        </Button>
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="secondary" className="uppercase tracking-wider font-bold">
            {assignment.kind}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">Unit {assignment.unitNumber}</span>
        </div>
        <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
          {assignment.title}
        </h1>
        {assignment.instructions && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {assignment.instructions}
          </p>
        )}
      </div>

      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Before you begin</h3>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Ensure you are in a quiet room with minimal background noise.</li>
                <li>Check your microphone permissions when prompted.</li>
                <li>Speak clearly and at a natural pace.</li>
                <li>This assignment contains {assignment.prompts.length} prompt{assignment.prompts.length === 1 ? '' : 's'}.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button 
          size="lg" 
          className="w-full md:w-auto px-12 py-6 text-lg rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
          onClick={handleStart}
          disabled={startAttempt.isPending}
        >
          {startAttempt.isPending ? "Starting..." : (
            <>
              <Play className="w-5 h-5 mr-2 fill-current" />
              Step up to the Mic
            </>
          )}
        </Button>
      </div>

      {/* PRACTICE MODE — unlimited unofficial reps, never the graded prompts. */}
      <Card className="mt-10 border-2 border-secondary/40 bg-secondary/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-secondary/20 p-3 rounded-full text-secondary-foreground shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                Practice as much as you want
              </h3>
              <p className="text-muted-foreground mb-4">
                Generate a fresh, <strong>unofficial</strong> version of this {assignment.kind} — brand-new
                questions every time, <strong>never</strong> the real graded prompts. Record or write your
                answer, get an instant unofficial grade with lots of feedback, and talk it through with
                Coach, your live tutor. None of it counts — it just makes you sharper.
              </p>
              <Button
                onClick={handleGeneratePractice}
                disabled={generatePractice.isPending}
                className="rounded-full font-semibold"
              >
                {generatePractice.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Building fresh questions…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate practice round
                  </>
                )}
              </Button>

              {sets.length > 0 && (
                <div className="mt-6 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Your practice rounds
                  </div>
                  {sets.map((s) => (
                    <button
                      key={s.assignmentId}
                      onClick={() => s.attemptId && setLocation(`/attempts/${s.attemptId}`)}
                      className="w-full flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-secondary/50 hover:bg-secondary/5"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          <Repeat className="w-4 h-4 text-secondary-foreground shrink-0" />
                          {s.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.promptCount} prompt{s.promptCount === 1 ? "" : "s"} ·{" "}
                          {s.status === "submitted" ? (
                            <span className="text-primary font-medium">
                              Finished{s.overallScore != null ? ` · ${Math.round(s.overallScore)}/100 (unofficial)` : ""}
                            </span>
                          ) : (
                            <span>{s.gradedCount ?? 0} graded · in progress</span>
                          )}
                        </div>
                      </div>
                      {s.status === "submitted" ? (
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      ) : (
                        <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 space-y-4">
        <h3 className="text-xl font-serif font-semibold">Prompts Preview</h3>
        <div className="space-y-3">
          {assignment.prompts.map((prompt, idx) => (
            <div key={prompt.id} className="p-4 border rounded-lg bg-card flex gap-4">
              <div className="text-muted-foreground font-mono font-bold mt-0.5">{(idx + 1).toString().padStart(2, '0')}</div>
              <div>
                <div className="font-medium">{prompt.prompt}</div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="uppercase tracking-wider">{prompt.mode}</span>
                  {prompt.targetSeconds && <span>Target: {prompt.targetSeconds}s</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
