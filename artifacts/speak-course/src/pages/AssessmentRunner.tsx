import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSpeakingAssessment,
  useCompleteSpeakingAssessment,
  useGradeSpeakingAssessment,
  useRequestUploadUrl,
  useTranscribeAssessmentRecording,
  getGetSpeakingAssessmentQueryKey,
  getGetSpeakingAssessmentsQueryKey,
} from "@workspace/api-client-react";
import type { SpeakingMetrics } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioRecorder } from "@/components/AudioRecorder";
import {
  ArrowLeft,
  Mic2,
  PenLine,
  Award,
  Sparkles,
  CheckCircle2,
  Loader2,
  Lightbulb,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FORMAT_META = {
  official: { label: "Official", Icon: Award },
  spoken: { label: "Spoken", Icon: Mic2 },
  written: { label: "Written", Icon: PenLine },
  hybrid: { label: "Hybrid", Icon: Sparkles },
};

export default function AssessmentRunner() {
  const params = useParams();
  const id = Number(params.assessmentId);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useGetSpeakingAssessment(id, {
    query: { queryKey: getGetSpeakingAssessmentQueryKey(id), enabled: !!id },
  });
  const complete = useCompleteSpeakingAssessment();
  const grade = useGradeSpeakingAssessment();
  const requestUploadUrl = useRequestUploadUrl();
  const transcribe = useTranscribeAssessmentRecording();

  const [answers, setAnswers] = useState<string[]>([]);
  // Delivery metrics captured at transcription time, kept per question so a
  // spoken answer can be graded on content AND delivery on submit.
  const metricsRef = useRef<Record<number, SpeakingMetrics | null>>({});
  const [transcribingIndex, setTranscribingIndex] = useState<number | null>(
    null,
  );
  // Per-question token: bumped on every new recording or "record again" so a
  // slow/stale transcription can never overwrite a fresh take or trap the user.
  const takeTokenRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (data) {
      setAnswers(
        data.questions.map((_, i) => data.answers?.[i] ?? ""),
      );
      // Fresh assessment: drop any metrics captured for a previous one so we
      // never grade new answers against stale delivery measurements.
      metricsRef.current = {};
    }
  }, [id, data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/assessments">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to assessments
          </span>
        </Link>
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
          Failed to load this assessment.
        </div>
      </div>
    );
  }

  const meta = FORMAT_META[data.format];
  const FormatIcon = meta.Icon;
  const isDone = data.status === "completed";
  const hasFeedback =
    Array.isArray(data.feedback) &&
    data.feedback.length === data.questions.length &&
    data.feedback.every((f) => f != null);
  const answeredCount = answers.filter((a) => a.trim().length > 0).length;
  const allAnswered =
    data.questions.length > 0 && answeredCount === data.questions.length;

  const handleResetRecording = (index: number) => {
    // Invalidate any in-flight transcription for this question and release the
    // busy state so the user is never stuck waiting on a previous take.
    takeTokenRef.current[index] = (takeTokenRef.current[index] ?? 0) + 1;
    // Drop captured metrics for this question so a discarded take can't grade
    // a later answer's delivery.
    delete metricsRef.current[index];
    setTranscribingIndex((cur) => (cur === index ? null : cur));
  };

  const handleRecordingComplete = async (
    index: number,
    blob: Blob,
    mediaKind: "audio" | "video",
  ) => {
    const fallbackType = mediaKind === "video" ? "video/webm" : "audio/webm";
    const token = (takeTokenRef.current[index] ?? 0) + 1;
    takeTokenRef.current[index] = token;
    const isCurrent = () => takeTokenRef.current[index] === token;

    setTranscribingIndex(index);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: {
          name: `assessment-${id}-q${index}.webm`,
          size: blob.size,
          contentType: blob.type || fallbackType,
        },
      });

      const res = await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": blob.type || fallbackType },
      });
      if (!res.ok) throw new Error("Failed to upload recording");

      const { transcript, metrics } = await transcribe.mutateAsync({
        data: { objectPath },
      });

      // The user recorded again (or reset) while this was processing — drop it.
      if (!isCurrent()) return;

      const clean = transcript.trim();
      if (!clean) {
        // No usable transcript — discard any metrics so they can't be applied
        // to a later typed answer.
        delete metricsRef.current[index];
        toast({
          variant: "destructive",
          title: "We couldn't hear anything",
          description:
            "That recording came back empty. Use “Record again” and speak your answer.",
        });
        return;
      }

      // Attach delivery metrics only now that we have a valid transcript.
      metricsRef.current[index] = metrics ?? null;

      setAnswers((prev) => {
        const next = [...prev];
        next[index] = clean;
        return next;
      });

      toast({
        title: "Recording transcribed",
        description:
          "We turned your spoken answer into text below. Edit it if you like, then submit.",
      });
    } catch {
      if (!isCurrent()) return;
      toast({
        variant: "destructive",
        title: "Couldn't process that recording",
        description:
          "Something went wrong. Use “Record again” to try once more.",
      });
    } finally {
      if (isCurrent()) setTranscribingIndex(null);
    }
  };

  const handleComplete = () => {
    const metrics = data.questions.map((_, i) => metricsRef.current[i] ?? null);
    complete.mutate(
      { assessmentId: id, data: { answers, metrics } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetSpeakingAssessmentQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetSpeakingAssessmentsQueryKey(),
          });
          toast({
            title: "Assessment graded",
            description: data.isOfficial
              ? "Logged as official — see your feedback below."
              : "Logged as practice — see your feedback below.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Couldn't grade your answers",
            description:
              "Your work is saved. Please submit again in a moment to get feedback.",
          });
        },
      },
    );
  };

  const handleGetFeedback = () => {
    grade.mutate(
      { assessmentId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetSpeakingAssessmentQueryKey(id),
          });
          toast({
            title: "Feedback ready",
            description: "We've graded every answer — see it below.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Couldn't grade your answers",
            description: "Something went wrong. Please try again in a moment.",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <Link href="/assessments">
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to assessments
        </span>
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge
            variant={data.isOfficial ? "default" : "outline"}
            className="gap-1.5"
          >
            <FormatIcon className="w-3.5 h-3.5" />
            {meta.label}
            {data.isOfficial && " · counts toward credit"}
          </Badge>
          {data.unitNumber != null && (
            <Badge variant="outline" className="text-muted-foreground">
              Week {data.unitNumber}
            </Badge>
          )}
          {data.scope !== "custom" && (
            <Badge variant="outline" className="text-muted-foreground capitalize">
              {data.scope} study
            </Badge>
          )}
          {isDone && (
            <Badge
              variant="outline"
              className="gap-1 bg-secondary/15 text-secondary-foreground border-secondary/40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          {data.title}
        </h1>
        {data.request && (
          <p className="text-muted-foreground mt-2 italic">"{data.request}"</p>
        )}
        <p className="text-sm text-muted-foreground mt-3">
          {data.questions.length} questions · scored for completion, not for being
          right. Work through each one honestly — this is a diagnostic.
        </p>
      </div>

      <div className="space-y-4">
        {data.questions.map((q, i) => {
          const QIcon = q.mode === "spoken" ? Mic2 : PenLine;
          return (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary font-bold rounded-full w-7 h-7 flex items-center justify-center shrink-0 text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug">{q.prompt}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                      <QIcon className="w-3.5 h-3.5" />
                      {q.mode === "spoken"
                        ? "Record your answer out loud — we'll transcribe it for you."
                        : "Written answer."}
                    </div>
                    {q.hint && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1.5">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-secondary-foreground" />
                        {q.hint}
                      </div>
                    )}
                  </div>
                </div>

                {q.mode === "spoken" && !isDone && (
                  <div className="space-y-2">
                    <AudioRecorder
                      onRecordingComplete={(blob, _durationMs, mediaKind) =>
                        handleRecordingComplete(i, blob, mediaKind)
                      }
                      onReset={() => handleResetRecording(i)}
                    />
                    {transcribingIndex === i && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Transcribing your recording…
                      </div>
                    )}
                  </div>
                )}

                {q.mode === "spoken" && (
                  <p className="text-xs text-muted-foreground">
                    {isDone
                      ? "Your transcribed answer:"
                      : "Your transcribed answer appears here — edit it if anything came out wrong."}
                  </p>
                )}

                <Textarea
                  value={answers[i] ?? ""}
                  disabled={isDone || transcribingIndex === i}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  placeholder={
                    q.mode === "spoken"
                      ? "Record above to transcribe your spoken answer, or type it here…"
                      : "Type your answer…"
                  }
                  className="min-h-24 resize-none"
                />

                {(() => {
                  const fb = data.feedback?.[i];
                  if (!fb) return null;
                  return (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4 mt-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className="gap-1.5">
                          <Award className="w-3.5 h-3.5" />
                          {fb.grade}
                        </Badge>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
                          <span>overall {fb.overallScore}</span>
                          <span>content {fb.contentScore}</span>
                          {fb.deliveryScore != null && (
                            <span>delivery {fb.deliveryScore}</span>
                          )}
                        </div>
                      </div>

                      {fb.summary && (
                        <div>
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Feedback summary
                          </div>
                          <p className="text-sm leading-relaxed">{fb.summary}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fb.whatWorked && fb.whatWorked.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">
                              What worked
                            </div>
                            <ul className="list-disc pl-4 space-y-1 text-sm">
                              {fb.whatWorked.map((item, j) => (
                                <li key={j}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fb.whatToFix && fb.whatToFix.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
                              To improve
                            </div>
                            <ul className="list-disc pl-4 space-y-1 text-sm">
                              {fb.whatToFix.map((item, j) => (
                                <li key={j}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isDone && (
        <div className="flex items-center justify-between gap-4 sticky bottom-4">
          <div
            className={cn(
              "text-sm font-medium",
              allAnswered ? "text-secondary-foreground" : "text-muted-foreground",
            )}
          >
            {answeredCount} of {data.questions.length} answered
          </div>
          <Button
            size="lg"
            onClick={handleComplete}
            disabled={!allAnswered || complete.isPending}
            className="gap-2 shadow-lg"
          >
            {complete.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Submit assessment
          </Button>
        </div>
      )}

      {isDone && (
        <div className="flex flex-wrap items-center gap-3">
          {!hasFeedback && (
            <Button
              size="lg"
              onClick={handleGetFeedback}
              disabled={grade.isPending}
              className="gap-2 shadow-lg"
            >
              {grade.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Get my feedback
            </Button>
          )}
          <Button
            variant={hasFeedback ? "default" : "outline"}
            onClick={() => navigate("/assessments")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to all assessments
          </Button>
        </div>
      )}
    </div>
  );
}
