import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSpeakingAssessments,
  useStartSpeakingAssessment,
  useBuildSpeakingAssessment,
  getGetSpeakingAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  Mic2,
  PenLine,
  Sparkles,
  Award,
  CheckCircle2,
  Loader2,
  Wand2,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Format = "spoken" | "written" | "hybrid" | "official";

const FORMAT_META: Record<
  Format,
  { label: string; Icon: typeof Mic2; hint: string }
> = {
  official: { label: "Official", Icon: Award, hint: "Counts toward credit" },
  spoken: { label: "Spoken", Icon: Mic2, hint: "Answer out loud" },
  written: { label: "Written", Icon: PenLine, hint: "Type your answers" },
  hybrid: { label: "Hybrid", Icon: Sparkles, hint: "Mix of both" },
};

export default function Assessments() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetSpeakingAssessments({
    query: { queryKey: getGetSpeakingAssessmentsQueryKey() },
  });

  const start = useStartSpeakingAssessment();
  const build = useBuildSpeakingAssessment();
  const [request, setRequest] = useState("");
  const [buildFormat, setBuildFormat] = useState<"spoken" | "written" | "hybrid">(
    "spoken",
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleStart = (
    slotKey: string,
    scope: "before" | "after",
    unitNumber: number,
    format: Format,
  ) => {
    setPendingKey(`${slotKey}-${format}`);
    start.mutate(
      { data: { slotKey, scope, unitNumber, format } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({
            queryKey: getGetSpeakingAssessmentsQueryKey(),
          });
          navigate(`/assessments/${res.id}`);
        },
        onError: () => {
          setPendingKey(null);
          toast({
            variant: "destructive",
            title: "Couldn't start assessment",
            description: "The question generator hit an error. Try again.",
          });
        },
      },
    );
  };

  const handleBuild = () => {
    if (!request.trim()) return;
    build.mutate(
      { data: { request: request.trim(), format: buildFormat } },
      {
        onSuccess: (res) => {
          setRequest("");
          queryClient.invalidateQueries({
            queryKey: getGetSpeakingAssessmentsQueryKey(),
          });
          navigate(`/assessments/${res.id}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Couldn't build assessment",
            description: "The builder hit an error. Try a different request.",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load assessments. Please try again.
      </div>
    );
  }

  const before = data.slots.filter((s) => s.scope === "before");
  const after = data.slots.filter((s) => s.scope === "after");
  const creditPct =
    data.credit.creditMax > 0
      ? Math.round((data.credit.creditPercent / data.credit.creditMax) * 100)
      : 0;

  const renderSlots = (slots: typeof data.slots, label: string, blurb: string) => (
    <section className="space-y-4">
      <div className="border-b border-border pb-2">
        <h2 className="text-2xl font-serif font-semibold">{label}</h2>
        <p className="text-sm text-muted-foreground mt-1">{blurb}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {slots.map((slot) => {
          const officialDone = slot.formats.some(
            (f) => f.isOfficial && f.status === "completed",
          );
          return (
            <Card key={slot.key}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">
                      Week {slot.unitNumber}
                    </div>
                    <h3 className="font-bold leading-snug">{slot.title}</h3>
                  </div>
                  {officialDone && (
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 bg-secondary/15 text-secondary-foreground border-secondary/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Official done
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {slot.formats.map((f) => {
                    const meta = FORMAT_META[f.format];
                    const Icon = meta.Icon;
                    const isPending =
                      pendingKey === `${slot.key}-${f.format}` && start.isPending;
                    const done = f.status === "completed";
                    return (
                      <Button
                        key={f.format}
                        size="sm"
                        variant={f.isOfficial ? "default" : "outline"}
                        disabled={start.isPending}
                        onClick={() =>
                          handleStart(
                            slot.key,
                            slot.scope as "before" | "after",
                            slot.unitNumber,
                            f.format,
                          )
                        }
                        className={cn(
                          "gap-1.5",
                          done && "ring-1 ring-secondary/50",
                        )}
                        title={meta.hint}
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : done ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                        {meta.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">
          Assessments
        </h1>
        <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
          Diagnostic check-ins for each week — once before you study it, once
          after. Only the <span className="font-semibold">official</span> format
          counts toward course credit. The rest are unlimited practice.
        </p>
      </div>

      {/* Credit */}
      <Card className="border-2 border-secondary/30 bg-secondary/5">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="bg-secondary/20 p-3 rounded-full text-secondary-foreground shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="font-bold">Assessment credit</h2>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {Math.round(data.credit.creditPercent)} / {data.credit.creditMax}{" "}
                pts
              </span>
            </div>
            <Progress value={creditPct} className="h-2.5 [&>div]:bg-secondary" />
            <p className="text-sm text-muted-foreground mt-2">
              {data.credit.completedOfficials} of{" "}
              {data.credit.requiredOfficials} official assessments complete.
            </p>
          </div>
        </CardContent>
      </Card>

      {renderSlots(
        before,
        "Before each week",
        "Take a cold-open diagnostic before you study the material — establish your baseline.",
      )}
      {renderSlots(
        after,
        "After each week",
        "Re-check once you've worked through the week to see how far you've moved.",
      )}

      {/* Custom builder */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" /> Build your own
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Describe what you want to be quizzed on and the AI will author a
            custom assessment. Custom assessments never count toward credit.
          </p>
        </div>
        <Card>
          <CardContent className="p-5 space-y-4">
            <Textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="e.g. Quiz me on handling hostile audience questions and recovering from a lost train of thought."
              className="min-h-24 resize-none"
            />
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex gap-2">
                {(["spoken", "written", "hybrid"] as const).map((f) => {
                  const meta = FORMAT_META[f];
                  const Icon = meta.Icon;
                  return (
                    <Button
                      key={f}
                      size="sm"
                      variant={buildFormat === f ? "default" : "outline"}
                      onClick={() => setBuildFormat(f)}
                      className="gap-1.5"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {meta.label}
                    </Button>
                  );
                })}
              </div>
              <Button
                onClick={handleBuild}
                disabled={!request.trim() || build.isPending}
                className="gap-2"
              >
                {build.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Build assessment
              </Button>
            </div>
          </CardContent>
        </Card>

        {data.customAssessments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.customAssessments.map((c) => {
              const meta = FORMAT_META[c.format];
              const Icon = meta.Icon;
              const done = c.status === "completed";
              return (
                <Card
                  key={c.id}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/assessments/${c.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                        <span className="text-border">·</span>
                        {c.questionCount} questions
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 gap-1",
                          done
                            ? "bg-secondary/15 text-secondary-foreground border-secondary/40"
                            : "bg-primary/10 text-primary border-primary/30",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Loader2 className="w-3.5 h-3.5" />
                        )}
                        {done ? "Complete" : "In progress"}
                      </Badge>
                    </div>
                    <h3 className="font-bold leading-snug">{c.title}</h3>
                    <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                      {done ? "Review" : "Continue"}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {data.slots.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No assessment slots available.</p>
        </div>
      )}
    </div>
  );
}
