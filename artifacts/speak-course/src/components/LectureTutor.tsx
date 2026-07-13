import { useEffect, useRef, useState } from "react";
import {
  useAskLectureTutor,
  useGetLectureTutorSuggestions,
  getGetLectureTutorSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sparkles, SendHorizonal, GraduationCap, RotateCcw } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LectureTutorProps {
  lectureId: number;
  lectureTitle: string;
}

export function LectureTutor({ lectureId, lectureTitle }: LectureTutorProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(0);

  const ask = useAskLectureTutor();

  useEffect(() => {
    sessionRef.current += 1;
    setMessages([]);
    setInput("");
    ask.reset();
    // Reset the tutor session whenever the student opens a different lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId]);

  const {
    data: suggestionData,
    isLoading: suggestionsLoading,
    error: suggestionsError,
  } = useGetLectureTutorSuggestions(lectureId, {
    query: {
      enabled: !!lectureId,
      queryKey: getGetLectureTutorSuggestionsQueryKey(lectureId),
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, ask.isPending]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;

    const session = sessionRef.current;
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");

    try {
      const result = await ask.mutateAsync({
        lectureId,
        data: { messages: nextMessages },
      });
      // Ignore a reply that arrives after the session was cleared or the
      // student switched lectures, so stale answers can't reappear.
      if (session !== sessionRef.current) return;
      setMessages([
        ...nextMessages,
        { role: "assistant", content: result.reply },
      ]);
    } catch {
      if (session !== sessionRef.current) return;
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
      toast({
        title: "The tutor couldn't answer",
        description:
          "Something went wrong reaching the tutor. Please try again in a moment.",
        variant: "destructive",
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const suggestions = suggestionData?.suggestions ?? [];
  const hasConversation = messages.length > 0;

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">
              Ask the tutor
            </div>
            <div className="text-xs text-muted-foreground leading-tight">
              Your AI coach for this lecture
            </div>
          </div>
        </div>
        {hasConversation && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 px-2"
            disabled={ask.isPending}
            onClick={() => {
              sessionRef.current += 1;
              setMessages([]);
              setInput("");
              ask.reset();
            }}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[14rem]"
      >
        {!hasConversation && (
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              Ask anything about{" "}
              <span className="text-foreground font-medium">
                {lectureTitle}
              </span>{" "}
              — or about public speaking in general. Bounce ideas around, ask for
              examples, or have the tutor quiz you.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {m.role === "assistant" ? (
                <MarkdownRenderer content={m.content} />
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}

        {ask.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-muted">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3 space-y-3 bg-background">
        {!hasConversation && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              Suggested questions
            </div>
            {suggestionsLoading && (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-7 w-40 rounded-full" />
                <Skeleton className="h-7 w-32 rounded-full" />
                <Skeleton className="h-7 w-44 rounded-full" />
              </div>
            )}
            {suggestionsError && (
              <p className="text-xs text-muted-foreground">
                Couldn't load suggestions — type your own question below.
              </p>
            )}
            {!suggestionsLoading && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={ask.isPending}
                    className="text-xs text-left rounded-full border border-border bg-card px-3 py-1.5 text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this lecture… (Shift+Enter for newline)"
            rows={2}
            className="resize-none min-h-[2.75rem] max-h-40 text-sm"
          />
          <Button
            size="icon"
            className="shrink-0 h-11 w-11"
            disabled={!input.trim() || ask.isPending}
            onClick={() => void send(input)}
            aria-label="Send question"
          >
            <SendHorizonal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
