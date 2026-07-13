import { randomUUID } from "crypto";
import type { Request, Response } from "express";

/**
 * Podium has no login system — it is a single-user studio. To still protect
 * private recordings behind an ownership check (so that if the studio is ever
 * shared or multi-user, one student cannot fetch another's recording by
 * guessing an object path), we mint a stable per-browser "studio session" id
 * and store it in an httpOnly cookie.
 *
 * - The id is recorded as the `owner` of a recording's ACL policy at submit time.
 * - The serving route checks the requester's id against that ACL.
 *
 * For single-user/local development this is frictionless: the same browser
 * keeps the same cookie, so it always owns (and can play back) its own
 * recordings without any sign-in step.
 */
const STUDIO_SESSION_COOKIE = "podium_sid";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface RequestWithStudio extends Request {
  studioUserId?: string;
}

/**
 * Resolve the studio session id for this request, minting and setting the
 * cookie when one is not already present. The id is cached on the request so
 * repeated calls within the same request return a consistent value.
 */
export function getStudioUserId(req: Request, res: Response): string {
  const typed = req as RequestWithStudio;
  if (typed.studioUserId) {
    return typed.studioUserId;
  }

  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  const existing = cookies?.[STUDIO_SESSION_COOKIE];
  const studioUserId =
    typeof existing === "string" && existing.length > 0
      ? existing
      : randomUUID();

  if (existing !== studioUserId) {
    res.cookie(STUDIO_SESSION_COOKIE, studioUserId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR_MS,
      path: "/",
    });
  }

  typed.studioUserId = studioUserId;
  return studioUserId;
}
