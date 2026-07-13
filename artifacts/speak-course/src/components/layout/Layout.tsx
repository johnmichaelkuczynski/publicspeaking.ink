import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Mic2,
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Loader2,
  LogOut,
} from "lucide-react";
import {
  useGenerateSpeakingLectures,
  useResetSpeakingCourse,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth, logout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/assessments", label: "Assessments", icon: GraduationCap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrity", label: "Integrity", icon: ShieldAlert },
  { href: "/administrative", label: "Administrative", icon: ShieldCheck },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);

  const generateLectures = useGenerateSpeakingLectures();
  const resetCourse = useResetSpeakingCourse();

  const handleGenerate = () => {
    generateLectures.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries();
        toast({
          title:
            res.created > 0
              ? `Authored ${res.created} new lectures`
              : "Lectures already generated",
          description:
            res.created > 0
              ? "Medium and long variants are now available in each unit."
              : "Every unit already has its medium and long variants.",
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Couldn't generate lectures",
          description: "The lecture author hit an error. Please try again.",
        });
      },
    });
  };

  const handleReset = () => {
    resetCourse.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setResetOpen(false);
        toast({
          title: "Course reset",
          description:
            "All your progress was cleared. Course content is untouched — start fresh whenever you're ready.",
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Reset failed",
          description: "Something went wrong clearing your progress.",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="w-full md:w-60 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col">
        <div className="p-6">
          <Link href="/">
            <div className="flex items-center gap-2 font-serif text-2xl font-bold text-primary cursor-pointer">
              <Mic2 className="w-7 h-7" />
              Podium
            </div>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">
            Public Speaking Studio
          </p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const isActive = item.exact
              ? location === item.href
              : location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 text-[11px] text-muted-foreground">
          <Link href="/diagnostics">
            <span className="cursor-pointer hover:text-foreground transition-colors">
              System diagnostics
            </span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generateLectures.isPending}
              className="gap-2"
            >
              {generateLectures.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-secondary-foreground" />
              )}
              Generate lectures
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetOpen(true)}
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="w-4 h-4" />
              Reset course
            </Button>
            {user && (
              <>
                <span className="text-xs text-muted-foreground hidden sm:inline max-w-[160px] truncate">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void logout()}
                  className="gap-2 text-muted-foreground"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </div>
      </main>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the whole course?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently clears all your progress — every attempt,
              recording, grade, assessment, activity log, and your coaching
              profile. The course content (lectures, assignments, and prompts)
              stays exactly as it is. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetCourse.isPending}>
              Keep my progress
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReset();
              }}
              disabled={resetCourse.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetCourse.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Reset everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
