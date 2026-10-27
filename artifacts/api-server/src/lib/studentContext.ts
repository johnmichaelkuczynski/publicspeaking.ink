import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, speakingAssignmentsTable, speakingAttemptsTable, speakingResponsesTable, speakingActivityTable, speakingAssessmentsTable, speakingUploadsTable, speakingProfileTable } from "@workspace/db";

const students = new AsyncLocalStorage<string>();

export function studentId(): string {
  const id = students.getStore();
  if (!id) throw new Error("Student context is required");
  return id;
}

export function owned(table: { ownerId: AnyPgColumn }) {
  return eq(table.ownerId, studentId());
}

export function visibleAssignment() {
  return or(
    and(isNull(speakingAssignmentsTable.practiceForAssignmentId), isNull(speakingAssignmentsTable.ownerId)),
    owned(speakingAssignmentsTable),
  );
}

export const studentContext: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (userId) {
    const guest = req.signedCookies?.podium_guest;
    if (typeof guest === "string" && /^[0-9a-f-]{36}$/.test(guest)) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${guest}))`);
        const ownerId = `clerk:${userId}`;
        for (const table of [speakingAssignmentsTable, speakingAttemptsTable, speakingResponsesTable,
          speakingActivityTable, speakingAssessmentsTable, speakingUploadsTable]) {
          await tx.update(table).set({ ownerId }).where(eq(table.ownerId, `guest:${guest}`));
        }
        const profiles = await tx.select().from(speakingProfileTable).where(eq(speakingProfileTable.ownerId, ownerId));
        if (!profiles.length) {
          await tx.update(speakingProfileTable).set({ ownerId }).where(eq(speakingProfileTable.ownerId, `guest:${guest}`));
        }
      });
      res.clearCookie("podium_guest", { path: "/" });
    }
    res.setHeader("Cache-Control", "private, no-store");
    students.run(`clerk:${userId}`, next);
    return;
  }
  const existing = req.signedCookies?.podium_guest;
  const guestId = typeof existing === "string" && /^[0-9a-f-]{36}$/.test(existing)
    ? existing : randomUUID();
  if (guestId !== existing) {
    res.cookie("podium_guest", guestId, {
      signed: true, httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60 * 1000, path: "/",
    });
  }
  res.setHeader("Cache-Control", "private, no-store");
  students.run(`guest:${guestId}`, next);
};
