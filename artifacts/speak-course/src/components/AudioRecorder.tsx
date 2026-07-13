import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, RotateCcw, Video, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaKind = "audio" | "video";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationMs: number, mediaKind: MediaKind) => void;
  /** Fired when the user clears a take to record again. Use to cancel any
   *  in-flight processing of the previous recording. */
  onReset?: () => void;
  disabled?: boolean;
}

export function AudioRecorder({ onRecordingComplete, onReset, disabled }: AudioRecorderProps) {
  const [mediaKind, setMediaKind] = useState<MediaKind>("audio");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0); // in ms
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const kindRef = useRef<MediaKind>("audio");
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      setRecordedBlob(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setDuration(0);
      chunksRef.current = [];
      kindRef.current = mediaKind;

      const wantsVideo = mediaKind === "video";
      const stream = await navigator.mediaDevices.getUserMedia(
        wantsVideo ? { audio: true, video: true } : { audio: true },
      );
      streamRef.current = stream;

      if (wantsVideo && livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        livePreviewRef.current.muted = true;
        await livePreviewRef.current.play().catch(() => {});
      }

      const mimeType = wantsVideo ? "video/webm" : "audio/webm";
      const mediaRecorder = MediaRecorder.isTypeSupported(mimeType)
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const kind = kindRef.current;
        const blob = new Blob(chunksRef.current, {
          type: kind === "video" ? "video/webm" : "audio/webm",
        });
        const finalDuration = Date.now() - startTimeRef.current;
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setDuration(finalDuration);
        onRecordingComplete(blob, finalDuration, kind);
        if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      console.error("Error accessing media devices", err);
      alert(
        mediaKind === "video"
          ? "Could not access camera/microphone. Please check your permissions."
          : "Could not access microphone. Please check your permissions.",
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (kindRef.current === "video") {
      const v = playbackVideoRef.current;
      if (!v) return;
      if (isPlaying) {
        v.pause();
        setIsPlaying(false);
      } else {
        v.play();
        setIsPlaying(true);
      }
      return;
    }

    if (!audioRef.current && recordedUrl) {
      const audio = new Audio(recordedUrl);
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
      };
      audio.ontimeupdate = () => {
        setPlaybackTime(audio.currentTime * 1000);
      };
      audioRef.current = audio;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setDuration(0);
    setPlaybackTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const isVideo = kindRef.current === "video";

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-card border rounded-xl shadow-sm relative overflow-hidden group">
      {/* Background recording pulse */}
      {isRecording && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-full bg-destructive/5 animate-pulse" />
        </div>
      )}

      {/* Audio / Video mode toggle (only before recording starts) */}
      {!recordedBlob && !isRecording && (
        <div className="relative z-10 mb-6 inline-flex rounded-lg border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMediaKind("audio")}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              mediaKind === "audio"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <AudioLines className="w-4 h-4" /> Audio
          </button>
          <button
            type="button"
            onClick={() => setMediaKind("video")}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              mediaKind === "video"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Video className="w-4 h-4" /> Video
          </button>
        </div>
      )}

      {/* Live camera preview while recording video */}
      {isRecording && mediaKind === "video" && (
        <div className="relative z-10 mb-4 w-full max-w-md">
          <video
            ref={livePreviewRef}
            className="w-full rounded-lg bg-black aspect-video"
            playsInline
            muted
          />
        </div>
      )}

      {/* Recorded video playback */}
      {recordedBlob && isVideo && recordedUrl && (
        <div className="relative z-10 mb-4 w-full max-w-md">
          <video
            ref={playbackVideoRef}
            src={recordedUrl}
            className="w-full rounded-lg bg-black aspect-video"
            playsInline
            controls
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-3xl font-mono font-medium tracking-wider">
          {recordedBlob ? formatTime(playbackTime || duration) : formatTime(duration)}
        </div>

        {!recordedBlob ? (
          isRecording ? (
            <Button
              size="lg"
              variant="destructive"
              className="w-20 h-20 rounded-full rounded-xl animate-in zoom-in"
              onClick={stopRecording}
              disabled={disabled}
            >
              <Square className="w-8 h-8 fill-current" />
            </Button>
          ) : (
            <Button
              size="lg"
              className={cn("w-20 h-20 rounded-full", disabled ? "" : "hover:bg-primary/90 hover:scale-105 transition-all shadow-md")}
              onClick={startRecording}
              disabled={disabled}
            >
              {mediaKind === "video" ? <Video className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </Button>
          )
        ) : (
          <div className="flex flex-col items-center gap-4">
            {!isVideo && (
              <Button
                size="lg"
                className="w-16 h-16 rounded-full shadow-sm"
                onClick={togglePlayback}
                disabled={disabled}
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </Button>
            )}

            {/* Re-recording must ALWAYS be available — never gate this on the
                `disabled` (busy) state, so a failed or slow upload/transcription
                can never trap the user. */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                resetRecording();
                onReset?.();
              }}
            >
              <RotateCcw className="w-4 h-4" /> Record again
            </Button>
          </div>
        )}

        <div className="text-sm font-medium text-muted-foreground h-5">
          {isRecording ? (
            <span className="text-destructive animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive inline-block" />{" "}
              Recording {mediaKind === "video" ? "video" : "audio"}
            </span>
          ) : recordedBlob ? (
            "Ready to submit"
          ) : mediaKind === "video" ? (
            "Click to start recording video"
          ) : (
            "Click to start speaking"
          )}
        </div>
      </div>
    </div>
  );
}
