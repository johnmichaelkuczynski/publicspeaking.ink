import { useListSpeakingAttempts, getListSpeakingAttemptsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ArrowRight, Mic2 } from "lucide-react";

export default function AttemptsList() {
  const { data: attempts, isLoading, error } = useListSpeakingAttempts({
    query: {
      queryKey: getListSpeakingAttemptsQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !attempts) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load recordings.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">
          Your Recordings
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Review your graded submissions and feedback. Practice rounds live on each assignment.
        </p>
      </div>

      {attempts.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <Mic2 className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No recordings yet</h3>
            <p className="max-w-sm">You haven't completed any speaking assignments. Head to the studio dashboard to start your first module.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <Link key={attempt.id} href={`/attempts/${attempt.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer group hover:border-primary/50 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="bg-muted/30 p-4 md:w-48 border-r md:border-b-0 border-b flex flex-row md:flex-col items-center justify-between md:justify-center">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">Score</div>
                      {attempt.status === 'submitted' ? (
                        <div className="text-3xl font-bold text-primary">
                          {attempt.overallScore !== null && attempt.overallScore !== undefined ? Math.round(attempt.overallScore) : '-'}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-secondary bg-secondary/10 border-secondary/20">Pending</Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-6 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Unit {attempt.unitNumber}</span>
                        <span className="text-muted-foreground text-xs">•</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(attempt.startedAt), 'MMM d, yyyy')}</span>
                      </div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{attempt.assignmentTitle}</h3>
                      <div className="text-sm text-muted-foreground capitalize mt-1">{attempt.kind}</div>
                    </div>
                    <div className="shrink-0 flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                      <Badge variant={attempt.status === 'submitted' ? 'default' : 'secondary'}>
                        {attempt.status.replace('_', ' ')}
                      </Badge>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
