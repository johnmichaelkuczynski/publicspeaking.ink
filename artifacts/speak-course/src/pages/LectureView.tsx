import { useGetSpeakingLecture, getGetSpeakingLectureQueryKey, useGetSpeakingOverview } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { LectureTutor } from "@/components/LectureTutor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";

interface LectureNavItem {
  id: number;
}

function LectureNav({
  prev,
  next,
}: {
  prev: LectureNavItem | null;
  next: LectureNavItem | null;
}) {
  const [, setLocation] = useLocation();
  if (!prev && !next) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      {prev ? (
        <Button
          variant="outline"
          onClick={() => setLocation(`/lectures/${prev.id}`)}
          aria-label="Previous lecture"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous Lecture
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button
          variant="outline"
          onClick={() => setLocation(`/lectures/${next.id}`)}
          aria-label="Next lecture"
        >
          Next Lecture
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

export default function LectureView() {
  const [, params] = useRoute("/lectures/:lectureId");
  const lectureId = params?.lectureId ? parseInt(params.lectureId, 10) : 0;

  const { data: lecture, isLoading, error } = useGetSpeakingLecture(lectureId, {
    query: {
      enabled: !!lectureId,
      queryKey: getGetSpeakingLectureQueryKey(lectureId)
    }
  });

  const { data: overview } = useGetSpeakingOverview();

  const orderedLectures = (overview?.units ?? []).flatMap((u) => u.lectures);
  const currentIndex = orderedLectures.findIndex((l) => l.id === lectureId);
  const prevLecture =
    currentIndex > 0 ? orderedLectures[currentIndex - 1] : null;
  const nextLecture =
    currentIndex >= 0 && currentIndex < orderedLectures.length - 1
      ? orderedLectures[currentIndex + 1]
      : null;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-3/4" />
        <div className="space-y-4 pt-8">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (error || !lecture) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg max-w-3xl mx-auto">
        Failed to load lecture.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href={`/units/${lecture.unitNumber}`}>
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Unit {lecture.unitNumber}
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] gap-8 items-start">
        <div className="min-w-0">
          <div className="mb-6">
            <LectureNav prev={prevLecture} next={nextLecture} />
          </div>

          <div className="mb-10">
            <div className="text-sm font-mono text-muted-foreground mb-3">{lecture.code}</div>
            <h1 className="text-4xl font-serif font-bold text-foreground leading-tight">
              {lecture.title}
            </h1>
            {lecture.unitTitle && (
              <div className="text-primary mt-2 font-medium">Part of: {lecture.unitTitle}</div>
            )}
          </div>

          <div className="bg-card border rounded-lg p-6 md:p-10 shadow-sm text-lg leading-relaxed">
            <MarkdownRenderer content={lecture.body} />
          </div>

          <div className="mt-8">
            <LectureNav prev={prevLecture} next={nextLecture} />
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 h-[calc(100vh-7rem)] min-h-[28rem]">
          <LectureTutor lectureId={lecture.id} lectureTitle={lecture.title} />
        </aside>
      </div>
    </div>
  );
}
