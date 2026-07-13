import { useGetSpeakingUnit } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { getGetSpeakingUnitQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, Mic2, ArrowRight } from "lucide-react";

export default function UnitView() {
  const [, params] = useRoute("/units/:unitNumber");
  const unitNumber = params?.unitNumber ? parseInt(params.unitNumber, 10) : 0;

  const { data: unit, isLoading, error } = useGetSpeakingUnit(unitNumber, {
    query: {
      enabled: !!unitNumber,
      queryKey: getGetSpeakingUnitQueryKey(unitNumber)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load unit details.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="text-sm font-medium text-primary mb-1 uppercase tracking-wider">Unit {unit.unitNumber}</div>
        <h1 className="text-4xl font-serif font-bold text-foreground">
          {unit.title}
        </h1>
        {unit.summary && (
          <p className="text-muted-foreground mt-4 text-lg max-w-3xl leading-relaxed">
            {unit.summary}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Lectures
          </h2>
          {unit.lectures.map((lecture) => (
            <Link key={lecture.id} href={`/lectures/${lecture.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer group hover:border-primary/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 font-mono">{lecture.code}</div>
                    <div className="font-medium group-hover:text-primary transition-colors">{lecture.title}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {unit.lectures.length === 0 && (
            <div className="text-muted-foreground italic text-sm p-4 border rounded-md border-dashed">No lectures for this unit.</div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <Mic2 className="w-6 h-6 text-secondary" /> Assignments
          </h2>
          {unit.assignments.map((assignment) => (
            <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer group hover:border-secondary/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium group-hover:text-secondary transition-colors">{assignment.title}</div>
                    <div className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground capitalize">
                      {assignment.kind}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                    <div>{assignment.promptCount} Prompts</div>
                    <div className="capitalize">{assignment.mode} Mode</div>
                    <div className={`font-medium ${assignment.status === 'submitted' ? 'text-green-600' : assignment.status === 'in_progress' ? 'text-secondary' : ''}`}>
                      {assignment.status.replace('_', ' ')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {unit.assignments.length === 0 && (
             <div className="text-muted-foreground italic text-sm p-4 border rounded-md border-dashed">No assignments for this unit.</div>
          )}
        </div>
      </div>
    </div>
  );
}
