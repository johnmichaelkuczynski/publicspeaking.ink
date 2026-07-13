import { Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInUrl } from "@/hooks/useAuth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.1 3.58-5.18 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.14-4.06 1.14-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export default function Landing() {
  const authFailed = new URLSearchParams(window.location.search).get("auth");

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 font-serif text-4xl font-bold text-primary">
            <Mic2 className="w-9 h-9" />
            Podium
          </div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
            Public Speaking Studio
          </p>
        </div>

        <div className="space-y-4">
          <h1 className="font-serif text-2xl font-semibold">
            Step up to the mic
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A four-week college public speaking course — taught, drilled, and
            graded out loud. Sign in to pick up where you left off.
          </p>
        </div>

        {authFailed === "failed" && (
          <p className="text-sm text-destructive">
            Sign-in didn't go through. Please try again.
          </p>
        )}
        {authFailed === "unauthorized" && (
          <p className="text-sm text-destructive">
            That Google account isn't authorized for this studio.
          </p>
        )}

        <Button asChild size="lg" className="gap-3 px-8">
          <a href={signInUrl()}>
            <GoogleIcon />
            Continue with Google
          </a>
        </Button>
      </div>
    </div>
  );
}
