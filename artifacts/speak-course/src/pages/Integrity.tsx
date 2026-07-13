import {
  useGetSpeakingFlagged,
  getGetSpeakingFlaggedQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Mic2,
  Pencil,
} from "lucide-react";

export default function Integrity() {
  const { data, isLoading, error } = useGetSpeakingFlagged({
    query: {
      queryKey: getGetSpeakingFlaggedQueryKey(),
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load integrity flags.
      </div>
    );
  }

  const { flaggedCount, screenedCount, items } = data;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">
          Integrity Review
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Every submission is screened for AI authorship. This is the across-course
          view of everything that tripped a flag.
        </p>
      </div>

      <Card
        className={
          flaggedCount > 0
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-green-500/30 bg-green-500/5"
        }
      >
        <CardContent className="p-6 flex items-center gap-4">
          {flaggedCount > 0 ? (
            <ShieldAlert className="w-10 h-10 text-amber-600 shrink-0" />
          ) : (
            <ShieldCheck className="w-10 h-10 text-green-600 shrink-0" />
          )}
          <div>
            <div className="text-3xl font-bold text-foreground">
              {flaggedCount} of {screenedCount}
            </div>
            <div className="text-sm text-muted-foreground">
              {screenedCount === 0
                ? "No submissions have been screened yet."
                : flaggedCount > 0
                  ? "screened submissions flagged for review"
                  : "screened submissions — none flagged"}
            </div>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <ShieldCheck className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nothing flagged
            </h3>
            <p className="max-w-sm">
              No submission has tripped the AI-authorship or keystroke screens.
              Flagged work will show up here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card
              key={item.responseId}
              className="overflow-hidden border-amber-500/30"
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {item.unitNumber != null && (
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Unit {item.unitNumber}
                        </span>
                      )}
                      {item.unitNumber != null && (
                        <span className="text-muted-foreground text-xs">•</span>
                      )}
                      <Badge
                        variant="outline"
                        className="gap-1 text-xs capitalize"
                      >
                        {item.mode === "spoken" ? (
                          <Mic2 className="w-3 h-3" />
                        ) : (
                          <Pencil className="w-3 h-3" />
                        )}
                        {item.mode}
                      </Badge>
                      {item.assignmentKind && (
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {item.assignmentKind}
                        </Badge>
                      )}
                      {item.isPractice && (
                        <Badge variant="outline" className="text-xs">
                          Practice
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-lg truncate">
                      {item.assignmentTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {item.promptText}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm text-amber-700 font-semibold">
                      AI{" "}
                      {item.aiScore != null
                        ? `${Math.round(item.aiScore * 100)}%`
                        : "—"}
                    </div>
                    {item.mode === "written" &&
                      item.diachronicScore != null && (
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">
                          keystroke {Math.round(item.diachronicScore * 100)}%
                        </div>
                      )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {item.aiFlagged && (
                    <Badge className="gap-1 bg-amber-600 hover:bg-amber-600 text-white">
                      <ShieldAlert className="w-3 h-3" />
                      AI text
                    </Badge>
                  )}
                  {item.diachronicFlagged && (
                    <Badge className="gap-1 bg-amber-600 hover:bg-amber-600 text-white">
                      <ShieldAlert className="w-3 h-3" />
                      Keystroke pattern
                    </Badge>
                  )}
                </div>

                {item.detectionRationale && (
                  <div className="rounded-lg p-4 border border-amber-500/40 bg-amber-500/10 text-sm text-muted-foreground">
                    {item.detectionRationale}
                  </div>
                )}

                <div className="flex justify-end">
                  <Link href={`/attempts/${item.attemptId}`}>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline cursor-pointer">
                      View attempt
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
