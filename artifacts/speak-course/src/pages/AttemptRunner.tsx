import { useEffect, useRef, useState } from "react";
import { 
  useGetSpeakingAttempt, 
  getGetSpeakingAttemptQueryKey, 
  useRequestUploadUrl, 
  useSubmitSpeakingResponse, 
  useFinalizeSpeakingAttempt,
  type KeystrokeTrace
} from "@workspace/api-client-react";
import { useRoute, useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Mic2, Star, RotateCcw, Pencil, Sparkles, Target, Dumbbell, ShieldCheck, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { PracticeTutor } from "@/components/PracticeTutor";
import { cn } from "@/lib/utils";

function emptyTrace(): KeystrokeTrace {
  return {
    keystrokeCount: 0,
    eraseCount: 0,
    bulkInsertCount: 0,
    longestBulkInsertChars: 0,
    rewriteSegments: 0,
    durationMs: 0,
  };
}

export default function AttemptRunner() {
  const [, params] = useRoute("/attempts/:attemptId");
  const attemptId = params?.attemptId ? parseInt(params.attemptId, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activePromptId, setActivePromptId] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<{blob: Blob, durationMs: number, mediaKind: "audio" | "video"} | null>(null);

  const traceRef = useRef<KeystrokeTrace>(emptyTrace());
  const sessionStartRef = useRef<number>(Date.now());
  const lastKeyWasEraseRef = useRef<boolean>(false);

  const resetTrace = () => {
    traceRef.current = emptyTrace();
    sessionStartRef.current = Date.now();
    lastKeyWasEraseRef.current = false;
  };

  const handleWrittenKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isErase = e.key === "Backspace" || e.key === "Delete";
    if (isErase) {
      traceRef.current.eraseCount += 1;
      if (!lastKeyWasEraseRef.current) {
        traceRef.current.rewriteSegments = (traceRef.current.rewriteSegments || 0) + 1;
      }
      lastKeyWasEraseRef.current = true;
    } else if (e.key.length === 1 || e.key === "Enter") {
      traceRef.current.keystrokeCount += 1;
      lastKeyWasEraseRef.current = false;
    }
  };

  const handleWrittenChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const diff = newVal.length - writtenAnswer.length;
    if (diff > 5) {
      traceRef.current.bulkInsertCount = (traceRef.current.bulkInsertCount || 0) + 1;
      if (diff > (traceRef.current.longestBulkInsertChars || 0)) {
        traceRef.current.longestBulkInsertChars = diff;
      }
    }
    setWrittenAnswer(newVal);
  };
  
  const { data: attempt, isLoading, error, refetch } = useGetSpeakingAttempt(attemptId, {
    query: {
      enabled: !!attemptId,
      queryKey: getGetSpeakingAttemptQueryKey(attemptId)
    }
  });

  const requestUploadUrl = useRequestUploadUrl();
  const submitResponse = useSubmitSpeakingResponse();
  const finalizeAttempt = useFinalizeSpeakingAttempt();

  // One-time default selection per loaded attempt: jump to the first unanswered
  // prompt as a convenience. After this, navigation is fully user-driven so we
  // never fight the user or re-select from stale post-submit data.
  const initializedAttemptRef = useRef<number | null>(null);
  useEffect(() => {
    if (!attempt || attempt.status === "submitted") return;
    if (initializedAttemptRef.current === attempt.id) return;
    initializedAttemptRef.current = attempt.id;
    const unanswered = (attempt.prompts || []).find(
      (p) => !attempt.responses.some((r) => r.promptId === p.id),
    );
    if (unanswered) setActivePromptId(unanswered.id);
  }, [attempt]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg max-w-4xl mx-auto">
        Failed to load attempt.
      </div>
    );
  }

  const isFinalized = attempt.status === 'submitted';
  const isPractice = attempt.isPractice === true;
  const hasAnyResponse = (attempt.responses?.length ?? 0) > 0;
  const prompts = attempt.prompts || [];

  const activePrompt = prompts.find(p => p.id === activePromptId);
  const isAllAnswered = prompts.length > 0 && prompts.every(p => attempt.responses.some(r => r.promptId === p.id));

  // Freely select any prompt (any order, redo at will), resetting any staged input.
  const selectPrompt = (promptId: number) => {
    setActivePromptId(promptId);
    setRecordedBlob(null);
    setWrittenAnswer("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRecordingComplete = (blob: Blob, durationMs: number, mediaKind: "audio" | "video") => {
    setRecordedBlob({ blob, durationMs, mediaKind });
  };

  const handleSubmitSpoken = async () => {
    if (!activePrompt || !recordedBlob) return;

    const fallbackType = recordedBlob.mediaKind === "video" ? "video/webm" : "audio/webm";

    try {
      // 1. Get upload URL
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: {
          name: `recording-${activePrompt.id}.webm`,
          size: recordedBlob.blob.size,
          contentType: recordedBlob.blob.type || fallbackType
        }
      });
      
      // 2. Upload to GCS
      const res = await fetch(uploadURL, {
        method: "PUT",
        body: recordedBlob.blob,
        headers: { "Content-Type": recordedBlob.blob.type || fallbackType }
      });
      
      if (!res.ok) {
        throw new Error("Failed to upload recording");
      }
      
      // 3. Submit response
      await submitResponse.mutateAsync({
        attemptId,
        data: {
          promptId: activePrompt.id,
          mode: "spoken",
          recordingObjectPath: objectPath,
          mediaKind: recordedBlob.mediaKind,
          durationMs: recordedBlob.durationMs
        }
      });
      
      toast({
        title: "Response submitted",
        description: "Your recording has been sent for grading.",
      });
      
      setRecordedBlob(null);
      // Return to the prompt overview; the user chooses what to do next.
      setActivePromptId(null);
      refetch();
      
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Failed to submit recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSubmitWritten = async () => {
    if (!activePrompt || !writtenAnswer.trim()) return;
    
    try {
      await submitResponse.mutateAsync({
        attemptId,
        data: {
          promptId: activePrompt.id,
          mode: "written",
          textAnswer: writtenAnswer,
          trace: {
            ...traceRef.current,
            durationMs: Date.now() - sessionStartRef.current,
          }
        }
      });
      
      toast({
        title: "Response submitted",
        description: "Your written answer has been saved.",
      });
      
      setWrittenAnswer("");
      // Return to the prompt overview; the user chooses what to do next.
      setActivePromptId(null);
      resetTrace();
      refetch();
      
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Failed to submit written answer.",
        variant: "destructive"
      });
    }
  };

  const handleFinalize = async () => {
    try {
      await finalizeAttempt.mutateAsync({ attemptId });
      toast(
        attempt?.isPractice
          ? {
              title: "Practice round finished",
              description: "Unofficial score ready. Generate another fresh round any time.",
            }
          : {
              title: "Assignment Completed",
              description: "Your overall score is now available.",
            },
      );
      refetch();
    } catch (err: any) {
      toast({
        title: "Finalization failed",
        description: err.message || "Failed to complete assignment.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="pl-0 hover:bg-transparent hover:text-primary text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Studio
        </Button>
        <Link href={`/units/${attempt.unitNumber}`}>
          <span className="text-muted-foreground hover:text-primary cursor-pointer transition-colors">
            Back to Unit {attempt.unitNumber}
          </span>
        </Link>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-2 flex-wrap">
            <span>Unit {attempt.unitNumber} • {attempt.kind}</span>
            {isPractice && (
              <Badge className="bg-secondary/20 text-secondary-foreground border-secondary/40 hover:bg-secondary/20 gap-1">
                <Sparkles className="w-3 h-3" /> Practice — unofficial
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {isPractice && attempt.practiceParentTitle
              ? `Practice: ${attempt.practiceParentTitle}`
              : attempt.assignmentTitle}
          </h1>
          {isPractice && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Fresh questions, never the graded ones. Nothing here counts toward your record — it's
              pure reps. Your coach is on screen the whole time.
            </p>
          )}
        </div>
        {isFinalized && attempt.overallScore !== undefined && attempt.overallScore !== null && (
          <div className={cn(
            "px-6 py-3 rounded-xl border flex flex-col items-center",
            isPractice
              ? "bg-secondary/10 text-secondary-foreground border-secondary/30"
              : "bg-primary/10 text-primary border-primary/20",
          )}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1">
              {isPractice ? "Unofficial Score" : "Final Score"}
            </div>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 fill-current" />
              {Math.round(attempt.overallScore)}
            </div>
          </div>
        )}
      </div>

      {isPractice && (
        <PracticeTutor attemptId={attempt.id} hasWork={hasAnyResponse} />
      )}

      {!isFinalized && prompts.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Prompts in this assignment — pick any, in any order
          </div>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p, idx) => {
              const r = attempt.responses.find(x => x.promptId === p.id);
              const isActive = activePromptId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => selectPrompt(p.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-muted-foreground/30 bg-background hover:bg-muted",
                  )}
                >
                  {p.mode === "spoken" ? <Mic2 className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  <span>Prompt {idx + 1}</span>
                  {r?.status === "graded" && r.overallScore !== undefined && r.overallScore !== null && (
                    <span
                      className={cn(
                        "ml-1 text-xs font-bold px-2 py-0.5 rounded-full",
                        isActive ? "bg-primary-foreground/20" : "bg-primary/10 text-primary",
                      )}
                    >
                      {Math.round(r.overallScore)}
                    </span>
                  )}
                  {r?.status === "pending" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {r?.status === "failed" && (
                    <AlertTriangle className={cn("w-3.5 h-3.5", isActive ? "" : "text-destructive")} />
                  )}
                  {!r && (
                    <span
                      className={cn(
                        "ml-1 text-xs",
                        isActive ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      Not started
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isFinalized && !activePrompt && isAllAnswered && (
        <Card className="border-secondary border-2 bg-secondary/5">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-secondary mb-4" />
            <h2 className="text-2xl font-serif font-bold mb-2">All Prompts Answered</h2>
            <p className="text-muted-foreground mb-6">
              {isPractice
                ? "Nice reps. Finish to see your unofficial overall — then generate another fresh round any time. Practice is unlimited."
                : "You have completed all prompts for this assignment. Submit to finalize and see your overall score."}
            </p>
            <Button 
              size="lg" 
              onClick={handleFinalize}
              disabled={finalizeAttempt.isPending}
              className="px-8"
            >
              {finalizeAttempt.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              {isPractice ? "Finish Practice Round" : "Complete Assignment"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Prompt View */}
      {!isFinalized && activePrompt && (
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-md">
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-6">
                <Badge variant="outline" className="text-primary border-primary bg-primary/5 uppercase tracking-wider font-bold">
                  Prompt {prompts.findIndex(p => p.id === activePrompt.id) + 1} of {prompts.length}
                </Badge>
                {activePrompt.targetSeconds && (
                  <Badge variant="secondary">Target: {activePrompt.targetSeconds}s</Badge>
                )}
              </div>
              
              <div className="text-2xl font-serif font-medium leading-relaxed text-foreground">
                {activePrompt.prompt}
              </div>
              
              {activePrompt.guidance && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground border">
                  <strong>Guidance:</strong> {activePrompt.guidance}
                </div>
              )}
            </CardContent>
          </Card>

          {activePrompt.mode === "spoken" ? (
            <div className="space-y-4">
              <AudioRecorder 
                onRecordingComplete={handleRecordingComplete} 
                onReset={() => setRecordedBlob(null)}
                disabled={requestUploadUrl.isPending || submitResponse.isPending}
              />
              <div className="flex justify-end">
                <Button 
                  size="lg"
                  onClick={handleSubmitSpoken}
                  disabled={!recordedBlob || requestUploadUrl.isPending || submitResponse.isPending}
                  className="w-full sm:w-auto"
                >
                  {requestUploadUrl.isPending || submitResponse.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><Mic2 className="w-5 h-5 mr-2" /> Submit Recording</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea 
                value={writtenAnswer}
                onChange={handleWrittenChange}
                onKeyDown={handleWrittenKeyDown}
                placeholder="Type your answer here..."
                className="min-h-[200px] text-lg p-6 border-muted-foreground/30 focus-visible:ring-primary"
                disabled={submitResponse.isPending}
              />
              <div className="flex justify-end">
                <Button 
                  size="lg"
                  onClick={handleSubmitWritten}
                  disabled={!writtenAnswer.trim() || submitResponse.isPending}
                  className="w-full sm:w-auto"
                >
                  {submitResponse.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <>Submit Answer <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answered Prompts History */}
      <div className="space-y-6 mt-12">
        <h3 className="text-xl font-serif font-bold border-b pb-2">Response History</h3>
        
        {prompts.map((prompt, idx) => {
          const response = attempt.responses.find(r => r.promptId === prompt.id);
          
          if (!response) {
            if (isFinalized) return null; // shouldn't happen, but just in case
            return (
              <Card key={prompt.id} className="opacity-50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="font-medium text-muted-foreground">Prompt {idx + 1}: Unanswered</div>
                  {activePromptId !== prompt.id && (
                    <Button variant="ghost" size="sm" onClick={() => selectPrompt(prompt.id)}>Answer Now</Button>
                  )}
                </CardContent>
              </Card>
            );
          }

          const isPendingGrade = response.status === 'pending';
          const isFailed = response.status === 'failed';

          return (
            <Card key={prompt.id} className={`overflow-hidden border-l-4 ${response.status === 'graded' ? 'border-l-primary' : 'border-l-muted-foreground'}`}>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Prompt {idx + 1}</div>
                    <div className="font-medium">{prompt.prompt}</div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center gap-2 shrink-0">
                    {response.status === 'graded' && response.overallScore !== undefined && response.overallScore !== null && (
                      <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-center h-fit">
                        <div className="text-xs font-bold uppercase tracking-wider">Score</div>
                        <div className="text-2xl font-bold">{Math.round(response.overallScore)}</div>
                      </div>
                    )}
                    {!isFinalized && !isPendingGrade && activePromptId !== prompt.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectPrompt(prompt.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" /> Redo
                      </Button>
                    )}
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border">
                  {response.mode === 'spoken' && response.recordingObjectPath && (
                    <div className="mb-4">
                      {response.mediaKind === 'video' ? (
                        <video
                          controls
                          playsInline
                          src={`/api/storage${response.recordingObjectPath}`}
                          className="w-full max-w-md rounded-lg bg-black aspect-video"
                        />
                      ) : (
                        <audio controls src={`/api/storage${response.recordingObjectPath}`} className="w-full h-10" />
                      )}
                    </div>
                  )}
                  
                  {isPendingGrade ? (
                    <div className="flex items-center justify-center p-6 text-muted-foreground gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Transcribing and analyzing response...</span>
                    </div>
                  ) : isFailed ? (
                    <div className="flex items-center justify-center p-6 text-destructive gap-3">
                      <AlertTriangle className="w-6 h-6" />
                      <span>{response.errorMessage || "Analysis failed. Please try again."}</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {response.transcript && (
                        <div>
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Transcript</div>
                          <div className="text-sm leading-relaxed">{response.transcript}</div>
                        </div>
                      )}
                      
                      {response.textAnswer && (
                        <div>
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Your Answer</div>
                          <div className="text-sm leading-relaxed">{response.textAnswer}</div>
                        </div>
                      )}

                      {response.detectionRationale && (
                        (() => {
                          const flagged = !!(response.aiFlagged || response.diachronicFlagged);
                          return (
                            <div
                              className={`rounded-lg p-4 border text-sm ${
                                flagged
                                  ? "bg-amber-500/10 border-amber-500/40"
                                  : "bg-muted/40 border-muted-foreground/20"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1 font-bold uppercase tracking-wider text-xs">
                                {flagged ? (
                                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <ShieldCheck className="w-4 h-4 text-green-600" />
                                )}
                                <span className={flagged ? "text-amber-700" : "text-green-700"}>
                                  AI-authorship screening
                                </span>
                                {response.aiScore != null && (
                                  <span className="ml-auto font-mono text-muted-foreground normal-case tracking-normal">
                                    AI {Math.round(response.aiScore * 100)}%
                                    {response.diachronicScore != null && response.mode === "written" && (
                                      <> · keystroke {Math.round(response.diachronicScore * 100)}%</>
                                    )}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground">{response.detectionRationale}</p>
                            </div>
                          );
                        })()
                      )}
                      
                      {((response.whatWorked?.length ?? 0) > 0 || (response.whatToFix?.length ?? 0) > 0 || response.summary) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                          {response.summary && (
                            <div className="md:col-span-2">
                              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Feedback Summary</div>
                              <MarkdownRenderer content={response.summary} />
                            </div>
                          )}
                          
                          {response.whatWorked && response.whatWorked.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">What Worked</div>
                              <ul className="list-disc pl-4 space-y-1 text-sm">
                                {response.whatWorked.map((item, i) => <li key={i}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                          
                          {response.whatToFix && response.whatToFix.length > 0 && (
                            <div>
                              <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">To Improve</div>
                              <ul className="list-disc pl-4 space-y-1 text-sm">
                                {response.whatToFix.map((item, i) => <li key={i}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {((response.focusPointers?.length ?? 0) > 0 || (response.drills?.length ?? 0) > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-secondary/30">
                          {response.focusPointers && response.focusPointers.length > 0 && (
                            <div className="rounded-lg bg-secondary/10 p-4">
                              <div className="text-xs font-bold text-secondary-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5" /> Focus on this
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-sm">
                                {response.focusPointers.map((item, i) => <li key={i}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                          {response.drills && response.drills.length > 0 && (
                            <div className="rounded-lg bg-secondary/10 p-4">
                              <div className="text-xs font-bold text-secondary-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Dumbbell className="w-3.5 h-3.5" /> Try this drill
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-sm">
                                {response.drills.map((item, i) => <li key={i}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
