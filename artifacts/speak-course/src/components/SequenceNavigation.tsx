import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Destination = { href: string; label: string };

export function SequenceNavigation({
  previous,
  next,
}: {
  previous?: Destination | null;
  next?: Destination | null;
}) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Course navigation" className="flex items-center justify-between gap-3">
      {previous ? (
        <Button asChild variant="outline" size="icon">
          <Link href={previous.href} aria-label={previous.label} title={previous.label}
            onClick={() => window.scrollTo(0, 0)}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      ) : <span />}
      {next ? (
        <Button asChild variant="outline" size="icon">
          <Link href={next.href} aria-label={next.label} title={next.label}
            onClick={() => window.scrollTo(0, 0)}>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      ) : <span />}
    </nav>
  );
}
