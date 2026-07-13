import {
  useGetSpeakingOverview,
  useGetSpeakingProgress,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Activity,
  ClipboardList,
  GraduationCap,
  BarChart3,
  Mic2,
  Flame,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { cn, computeStreak } from "@/lib/utils";

function unitState(completed: number, total: number, anyStarted: boolean) {
  if (total > 0 && completed === total) return "complete" as const;
  if (anyStarted) return "in_progress" as const;
  return "not_started" as const;
}

const STATUS = {
  complete: {
    label: "Complete",
    Icon: CheckCircle2,
    className: "bg-secondary/15 text-secondary-foreground border-secondary/40",
    bar: "[&>div]:bg-secondary",
  },
  in_progress: {
    label: "In progress",
    Icon: Loader2,
    className: "bg-primary/10 text-primary border-primary/30",
    bar: "[&>div]:bg-primary",
  },
  not_started: {
    label: "Not started",
    Icon: CircleDashed,
    className: "bg-muted text-muted-foreground border-border",
    bar: "[&>div]:bg-muted-foreground/40",
  },
};

export default function Dashboard() {
  const { data: overview, isLoading, error } = useGetSpeakingOverview();
  const { data: progress } = useGetSpeakingProgress();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load the studio dashboard. Please try again.
      </div>
    );
  }

  const completionPct =
    overview.totals.assignmentsTotal > 0
      ? Math.round(
          (overview.totals.assignmentsCompleted /
            overview.totals.assignmentsTotal) *
            100,
        )
      : 0;

  const streak = computeStreak(progress?.recent.map((r) => r.at) ?? []);
  const stats = [
    {
      label: "Assignments complete",
      value: `${overview.totals.assignmentsCompleted}`,
      sub: `of ${overview.totals.assignmentsTotal}`,
      icon: ClipboardList,
    },
    {
      label: "Recordings submitted",
      value: `${overview.totals.attemptsCount}`,
      sub: "spoken attempts",
      icon: Mic2,
    },
    {
      label: "Average score",
      value:
        progress?.averageScore != null
          ? `${Math.round(progress.averageScore)}`
          : "—",
      sub: "content + delivery",
      icon: BarChart3,
    },
    {
      label: "Day streak",
      value: `${streak}`,
      sub: streak === 1 ? "day active" : "days active",
      icon: Flame,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">
          {overview.title}
        </p>
        <h1 className="text-4xl font-serif font-bold text-foreground">
          Your speaking studio
        </h1>
        <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
          Read the lecture, drill against a prompt, step up to the mic. Every
          attempt is transcribed and coached on what you said and how you said
          it.
        </p>
      </div>

      {/* Course progress banner */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg">Course progress</h2>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {completionPct}%
              </span>
            </div>
            <Progress value={completionPct} className="h-2.5 [&>div]:bg-primary" />
            <p className="text-sm text-muted-foreground mt-2">
              {overview.totals.assignmentsCompleted} of{" "}
              {overview.totals.assignmentsTotal} graded assignments complete
              across {overview.units.length} weeks.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/assignments">
              <div className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground cursor-pointer transition-transform hover:scale-[1.03]">
                Continue course
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-muted/60 p-2.5 rounded-lg text-primary shrink-0">
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  {s.label} · {s.sub}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weeks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif font-semibold">Your weeks</h2>
            <Link href="/assignments">
              <span className="text-sm font-medium text-primary cursor-pointer hover:underline">
                View all assignments
              </span>
            </Link>
          </div>
          <div className="space-y-3">
            {overview.units.map((unit) => {
              const total = unit.assignments.length;
              const completed = unit.assignments.filter(
                (a) => a.status === "submitted",
              ).length;
              const anyStarted = unit.assignments.some(
                (a) => a.status === "in_progress" || a.status === "submitted",
              );
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const scored = unit.assignments
                .map((a) => a.bestScore)
                .filter((s): s is number => typeof s === "number");
              const avgScore =
                scored.length > 0
                  ? Math.round(
                      scored.reduce((sum, s) => sum + s, 0) / scored.length,
                    )
                  : null;
              const cfg = STATUS[unitState(completed, total, anyStarted)];
              const StatusIcon = cfg.Icon;

              return (
                <Link key={unit.unitNumber} href={`/units/${unit.unitNumber}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                            Week {unit.unitNumber}
                          </div>
                          <h3 className="text-lg font-bold truncate">
                            {unit.title}
                          </h3>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 gap-1 font-medium", cfg.className)}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">
                          {completed} of {total} complete
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {pct}%
                          {avgScore !== null && (
                            <span className="ml-2 text-secondary-foreground font-semibold">
                              avg {avgScore}
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress value={pct} className={cn("h-1.5", cfg.bar)} />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-2xl font-serif font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Recent activity
          </h2>
          <Card>
            <CardContent className="p-5">
              {progress && progress.recent.length > 0 ? (
                <div className="space-y-5">
                  {progress.recent.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div className="w-px flex-1 bg-border mt-1" />
                      </div>
                      <div className="pb-1 min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(item.at), "MMM d")}
                          {item.unitNumber != null && ` · Week ${item.unitNumber}`}
                        </div>
                        <div className="font-medium text-sm mt-0.5 truncate">
                          {item.title}
                        </div>
                        {item.score != null && (
                          <div className="text-xs font-bold text-secondary-foreground mt-0.5">
                            Scored {Math.round(item.score)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <GraduationCap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No activity yet. Step up to the mic on your first assignment
                    and it'll show up here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
