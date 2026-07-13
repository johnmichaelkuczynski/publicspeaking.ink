import { useState } from "react";
import {
  useGetSpeakingProgress,
  useGetSpeakingProfile,
  useGenerateNarrativeReport,
  getGetSpeakingProgressQueryKey,
  getGetSpeakingProfileQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { computeStreak } from "@/lib/utils";
import { Link } from "wouter";
import {
  Trophy,
  Target,
  Activity,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  ThumbsUp,
  Repeat,
  MessageSquare,
  Mic2,
  FileText,
  Loader2,
  Settings,
  Flame,
  Clock,
} from "lucide-react";

function fmt(n: number | null | undefined, suffix = "") {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n)}${suffix}`;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function topicMastery(
  responses: number,
  averageScore: number | null | undefined,
): { label: string; variant: BadgeVariant } {
  if (responses === 0) return { label: "Not started", variant: "outline" };
  if (averageScore == null) return { label: "In progress", variant: "secondary" };
  if (averageScore >= 85) return { label: "Mastered", variant: "default" };
  if (averageScore >= 70) return { label: "Proficient", variant: "secondary" };
  return { label: "Developing", variant: "destructive" };
}

const TREND = {
  improving: { label: "Improving", icon: TrendingUp, className: "text-green-600" },
  declining: { label: "Slipping", icon: TrendingDown, className: "text-amber-600" },
  steady: { label: "Steady", icon: Minus, className: "text-muted-foreground" },
  insufficient: {
    label: "Not enough data yet",
    icon: HelpCircle,
    className: "text-muted-foreground",
  },
};

export default function Analytics() {
  const { data: progress, isLoading: progressLoading } = useGetSpeakingProgress({
    query: { queryKey: getGetSpeakingProgressQueryKey() },
  });
  const { data: profile, isLoading: profileLoading } = useGetSpeakingProfile({
    query: { queryKey: getGetSpeakingProfileQueryKey() },
  });
  const narrative = useGenerateNarrativeReport();
  const [report, setReport] = useState<string | null>(null);

  if (progressLoading || profileLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!progress || !profile) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load analytics. Please try again.
      </div>
    );
  }

  const a = profile.analytics;
  const trend = TREND[a.trend] ?? TREND.insufficient;
  const TrendIcon = trend.icon;
  const hasActivity = a.gradedResponses + a.practiceResponses > 0;

  const streak = computeStreak(progress.recent.map((r) => r.at));
  const headlineStats = [
    { label: "Average score", value: fmt(progress.averageScore), Icon: Target },
    {
      label: "Streak (days)",
      value: `${streak}`,
      Icon: Flame,
    },
    {
      label: "Assignments",
      value: `${progress.completedAssignments}/${progress.totalAssignments}`,
      Icon: FileText,
    },
    { label: "Recordings", value: `${progress.totalAttempts}`, Icon: Mic2 },
    { label: "Practice reps", value: `${a.practiceResponses}`, Icon: Repeat },
  ];

  const metricStats = [
    { label: "Avg content", value: fmt(a.averageContent) },
    { label: "Avg delivery", value: fmt(a.averageDelivery) },
    { label: "Words / min", value: fmt(a.averageWordsPerMinute) },
    {
      label: "Fillers / 100 words",
      value: a.averageFillerRate != null ? a.averageFillerRate.toFixed(1) : "—",
    },
    { label: "Avg pauses", value: fmt(a.averagePauseCount) },
    { label: "Coach exchanges", value: `${a.tutorExchanges}` },
  ];

  const handleNarrative = () => {
    narrative.mutate(undefined, {
      onSuccess: (res) => setReport(res.report),
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">
            Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
            How you're tracking as a speaker — scores, delivery metrics, and your
            evolving coaching profile, all in one place.
          </p>
        </div>
        <Link href="/diagnostics">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" /> System diagnostics
          </Button>
        </Link>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {headlineStats.map((s) => (
          <Card key={s.label} className="border-t-4 border-primary">
            <CardContent className="p-5">
              <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <s.Icon className="w-4 h-4" /> {s.label}
              </div>
              <div className="text-3xl font-bold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Narrative report */}
      <Card className="border-2 border-secondary/30 bg-secondary/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary-foreground" />
                Narrative report
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                A written, end-to-end read on your journey so far — where you
                started, what's changed, and what to do next.
              </p>
            </div>
            <Button
              onClick={handleNarrative}
              disabled={narrative.isPending}
              className="gap-2 shrink-0"
            >
              {narrative.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {report ? "Regenerate" : "Generate report"}
            </Button>
          </div>
          {narrative.isError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              The report generator hit an error. Please try again.
            </div>
          )}
          {report ? (
            <div className="bg-card rounded-lg p-5 border border-border mt-2">
              <MarkdownRenderer content={report} />
            </div>
          ) : (
            !narrative.isPending && (
              <p className="text-sm text-muted-foreground">
                Click generate to have your coach write up a full narrative of
                your progress.
              </p>
            )
          )}
        </CardContent>
      </Card>

      {/* Coach read */}
      {hasActivity ? (
        <>
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Coach's read on you
                </h2>
                <Badge variant="outline" className={`gap-1.5 ${trend.className}`}>
                  <TrendIcon className="w-3.5 h-3.5" />
                  {trend.label}
                </Badge>
              </div>
              {profile.summary ? (
                <MarkdownRenderer content={profile.summary} />
              ) : (
                <p className="text-muted-foreground">
                  Keep practicing — your coach is still forming a full picture.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Activity counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <Mic2 className="w-7 h-7 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{a.gradedResponses}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Graded responses
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <Repeat className="w-7 h-7 text-secondary-foreground" />
                <div>
                  <div className="text-2xl font-bold">{a.practiceResponses}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Practice reps
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <MessageSquare className="w-7 h-7 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{a.tutorExchanges}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Coach exchanges
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metrics */}
          <Card>
            <CardContent className="p-6">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Your delivery averages
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {metricStats.map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/40 p-4">
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Strengths + focus */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="text-sm font-bold text-green-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" /> Strengths
                </div>
                {profile.strengths.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-2 text-sm">
                    {profile.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Building this list as you go.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-secondary">
              <CardContent className="p-6">
                <div className="text-sm font-bold text-secondary-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Focus areas
                </div>
                {profile.focusAreas.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-2 text-sm">
                    {profile.focusAreas.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Building this list as you go.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-2 border-secondary/40 bg-secondary/5">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <Mic2 className="w-12 h-12 text-secondary mb-4" />
            <h2 className="text-xl font-serif font-bold mb-2">
              Your analytics start with your first rep
            </h2>
            <p className="text-muted-foreground max-w-md">
              Submit a graded response or run a practice round and this page will
              fill with scores, delivery metrics, and coaching.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unit + topic mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unit mastery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {progress.units.map((unit) => {
              const percent =
                unit.total > 0 ? (unit.completed / unit.total) * 100 : 0;
              return (
                <div key={unit.unitNumber} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2">
                        Week {unit.unitNumber}
                      </span>
                      <span className="font-semibold">{unit.title}</span>
                    </div>
                    <div className="text-sm font-medium">
                      {unit.averageScore
                        ? `${Math.round(unit.averageScore)} avg`
                        : "No score"}
                    </div>
                  </div>
                  <ProgressBar value={percent} className="h-2" />
                  <div className="text-xs text-muted-foreground text-right">
                    {unit.completed} of {unit.total} assignments
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Topic mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead className="w-16 text-center">Week</TableHead>
                  <TableHead className="w-20 text-center">Attempts</TableHead>
                  <TableHead className="w-20 text-center">Accuracy</TableHead>
                  <TableHead className="w-28 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.topics.map((topic) => {
                  const mastery = topicMastery(topic.responses, topic.averageScore);
                  return (
                    <TableRow key={topic.topicId}>
                      <TableCell className="font-medium">{topic.title}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {topic.unitNumber}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {topic.responses}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {topic.averageScore != null
                          ? `${Math.round(topic.averageScore)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={mastery.variant}>{mastery.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {progress.topics.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-6"
                    >
                      No topics yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {progress.recent.length > 0 ? (
            <ol className="relative border-l border-border ml-2 space-y-5">
              {progress.recent.map((item) => (
                <li key={item.id} className="ml-4">
                  <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {item.kind.replace(/_/g, " ")}
                        {item.unitNumber != null && ` · Week ${item.unitNumber}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.score != null && (
                        <span className="text-sm font-bold text-secondary-foreground">
                          {Math.round(item.score)}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-6">
              No activity yet — your timeline fills in as you work.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
