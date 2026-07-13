import { useGetSpeakingOverview } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  BookOpen,
  Mic2,
  PenLine,
  Layers,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ArrowRight,
  FileText,
  FlaskConical,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  submitted: {
    label: "Complete",
    Icon: CheckCircle2,
    className: "bg-secondary/15 text-secondary-foreground border-secondary/40",
  },
  in_progress: {
    label: "In progress",
    Icon: Loader2,
    className: "bg-primary/10 text-primary border-primary/30",
  },
  not_started: {
    label: "Not started",
    Icon: CircleDashed,
    className: "bg-muted text-muted-foreground border-border",
  },
};

const KIND = {
  homework: { label: "Homework", Icon: FileText },
  test: { label: "Test", Icon: FlaskConical },
  capstone: { label: "Capstone", Icon: Award },
};

const MODE = {
  spoken: { label: "Spoken", Icon: Mic2 },
  written: { label: "Written", Icon: PenLine },
  mixed: { label: "Mixed", Icon: Layers },
};

export default function Assignments() {
  const { data: overview, isLoading, error } = useGetSpeakingOverview();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load assignments. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">
          Assignments
        </h1>
        <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
          Four weeks of college public speaking. Read each lecture, then record
          and submit the graded work. Scores reflect both content and delivery.
        </p>
      </div>

      <div className="space-y-10">
        {overview.units.map((unit) => {
          const total = unit.assignments.length;
          const completed = unit.assignments.filter(
            (a) => a.status === "submitted",
          ).length;

          return (
            <section key={unit.unitNumber} className="space-y-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    Week {unit.unitNumber}
                  </span>
                  <h2 className="text-2xl font-serif font-semibold">
                    {unit.title}
                  </h2>
                </div>
                <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
                  {completed}/{total} done
                </span>
              </div>

              {unit.summary && (
                <p className="text-muted-foreground text-sm max-w-3xl">
                  {unit.summary}
                </p>
              )}

              {/* Lectures */}
              {unit.lectures.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {unit.lectures.map((lecture) => (
                    <Link key={lecture.id} href={`/lectures/${lecture.id}`}>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm cursor-pointer hover:border-primary/40 hover:bg-accent transition-colors">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">{lecture.title}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Assignments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unit.assignments.map((a) => {
                  const status = STATUS[a.status];
                  const StatusIcon = status.Icon;
                  const kind = KIND[a.kind];
                  const KindIcon = kind.Icon;
                  const mode = MODE[a.mode];
                  const ModeIcon = mode.Icon;

                  return (
                    <Link key={a.id} href={`/assignments/${a.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
                        <CardContent className="p-5 flex flex-col h-full">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <KindIcon className="w-3.5 h-3.5" />
                              {kind.label}
                              <span className="text-border">·</span>
                              <ModeIcon className="w-3.5 h-3.5" />
                              {mode.label}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 gap-1 font-medium",
                                status.className,
                              )}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              {status.label}
                            </Badge>
                          </div>

                          <h3 className="font-bold mb-2 leading-snug">
                            {a.title}
                          </h3>

                          <div className="mt-auto flex items-center justify-between pt-3">
                            <span className="text-xs text-muted-foreground">
                              {a.promptCount}{" "}
                              {a.promptCount === 1 ? "prompt" : "prompts"}
                              {a.bestScore != null && (
                                <span className="ml-2 font-bold text-secondary-foreground">
                                  Best {Math.round(a.bestScore)}
                                </span>
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                              {a.status === "submitted"
                                ? "Review results"
                                : a.status === "in_progress"
                                  ? "Continue"
                                  : "Start"}
                              <ArrowRight className="w-4 h-4" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
