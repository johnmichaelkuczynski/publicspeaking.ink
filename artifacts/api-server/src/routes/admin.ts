import { Router, type IRouter, type Request, type Response } from "express";
import { desc } from "drizzle-orm";
import { db, loginEventsTable } from "@workspace/db";
import { GetAdminLoginsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

router.get("/admin/logins", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: loginEventsTable.id,
      email: loginEventsTable.email,
      name: loginEventsTable.name,
      createdAt: loginEventsTable.createdAt,
    })
    .from(loginEventsTable)
    .orderBy(desc(loginEventsTable.createdAt), desc(loginEventsTable.id));

  const now = Date.now();
  const totals = { day: 0, week: 0, month: 0, year: 0, allTime: rows.length };
  for (const row of rows) {
    const age = now - row.createdAt.getTime();
    if (age <= DAY_MS) totals.day += 1;
    if (age <= 7 * DAY_MS) totals.week += 1;
    if (age <= 30 * DAY_MS) totals.month += 1;
    if (age <= 365 * DAY_MS) totals.year += 1;
  }

  res.json(
    GetAdminLoginsResponse.parse({
      events: rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        at: row.createdAt.toISOString(),
      })),
      totals,
    }),
  );
});

export default router;
