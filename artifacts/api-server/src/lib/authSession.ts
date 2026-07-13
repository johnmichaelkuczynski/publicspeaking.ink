import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export const SESSION_COOKIE = "podium_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

export function setSessionCookie(res: Response, user: SessionUser): void {
  const token = jwt.sign(
    {
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    sessionSecret(),
    { expiresIn: SESSION_TTL_SECONDS },
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionUser(req: Request): SessionUser | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, sessionSecret());
    if (typeof payload === "string") return null;
    const { sub, email, name, picture } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    return {
      sub,
      email,
      name: typeof name === "string" ? name : email,
      picture: typeof picture === "string" ? picture : undefined,
    };
  } catch {
    return null;
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.user = user;
  next();
}
