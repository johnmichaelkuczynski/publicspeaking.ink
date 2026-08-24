import { useMemo, useState } from "react";
import {
  useGetAdminLogins,
  getGetAdminLoginsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ShieldCheck, Users, CalendarClock } from "lucide-react";

type PeriodKey = "day" | "week" | "month" | "year" | "allTime";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Last day" },
  { key: "week", label: "Last week" },
  { key: "month", label: "Last month" },
  { key: "year", label: "Last year" },
  { key: "allTime", label: "All time" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  label: string;
  logins: number;
}

function buildBuckets(dates: Date[], period: PeriodKey): Bucket[] {
  const now = new Date();

  if (period === "day") {
    const start = now.getTime() - DAY_MS;
    const buckets: Bucket[] = [];
    for (let i = 0; i < 24; i++) {
      const bucketStart = new Date(start + i * 60 * 60 * 1000);
      buckets.push({
        label: bucketStart.toLocaleTimeString([], { hour: "numeric" }),
        logins: dates.filter((d) => {
          const t = d.getTime();
          return (
            t >= bucketStart.getTime() &&
            t < bucketStart.getTime() + 60 * 60 * 1000
          );
        }).length,
      });
    }
    return buckets;
  }

  if (period === "week" || period === "month") {
    const days = period === "week" ? 7 : 30;
    const buckets: Bucket[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i,
      );
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      buckets.push({
        label: dayStart.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),
        logins: dates.filter((d) => d >= dayStart && d < dayEnd).length,
      });
    }
    return buckets;
  }

  // year: last 12 months. allTime: monthly since first login (min 12 months).
  let monthsBack = 11;
  if (period === "allTime" && dates.length > 0) {
    const first = dates.reduce((a, b) => (a < b ? a : b));
    const diff =
      (now.getFullYear() - first.getFullYear()) * 12 +
      (now.getMonth() - first.getMonth());
    monthsBack = Math.max(monthsBack, diff);
  }
  const buckets: Bucket[] = [];
  for (let i = monthsBack; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      label: monthStart.toLocaleDateString([], {
        month: "short",
        year: "2-digit",
      }),
      logins: dates.filter((d) => d >= monthStart && d < monthEnd).length,
    });
  }
  return buckets;
}

export default function Administrative() {
  const { data, isLoading } = useGetAdminLogins({
    query: { queryKey: getGetAdminLoginsQueryKey() },
  });
  const [period, setPeriod] = useState<PeriodKey>("week");

  const dates = useMemo(
    () => (data ? data.events.map((e) => new Date(e.at)) : []),
    [data],
  );
  const chartData = useMemo(
    () => buildBuckets(dates, period),
    [dates, period],
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-destructive/10 text-destructive rounded-lg">
        Failed to load the administrative page. Please try again.
      </div>
    );
  }

  const totals = data.totals;
  const cards: { label: string; value: number }[] = [
    { label: "Last day", value: totals.day },
    { label: "Last week", value: totals.week },
    { label: "Last month", value: totals.month },
    { label: "Last year", value: totals.year },
    { label: "All time", value: totals.allTime },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Administrative
        </h1>
        <p className="text-muted-foreground mt-1">
          Historical sign-in records and login analytics.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.value === 1 ? "login" : "logins"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="w-4 h-4 text-primary" />
              Logins over time
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={period === p.key ? "default" : "outline"}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip />
                <Bar
                  dataKey="logins"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Who has logged in
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No historical login records are available.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gmail</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.email}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(e.at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
