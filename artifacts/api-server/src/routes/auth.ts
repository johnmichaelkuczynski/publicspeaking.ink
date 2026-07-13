import { Router, type IRouter, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import crypto from "node:crypto";
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
} from "../lib/authSession";

const router: IRouter = Router();

const STATE_COOKIE = "oauth_state";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function callbackUrl(req: Request): string {
  const host = req.get("host");
  return `${req.protocol}://${host}/api/auth/google/callback`;
}

function oauthClient(req: Request): OAuth2Client {
  return new OAuth2Client(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    callbackUrl(req),
  );
}

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

router.get("/auth/google", (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
  const url = oauthClient(req).generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
  res.redirect(url);
});

router.get(
  "/auth/google/callback",
  async (req: Request, res: Response): Promise<void> => {
    const cookies = req.cookies as Record<string, string> | undefined;
    const expectedState = cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/" });

    const { code, state, error } = req.query;

    if (error) {
      req.log.warn({ error }, "Google OAuth returned an error");
      res.redirect("/?auth=failed");
      return;
    }
    if (
      typeof code !== "string" ||
      typeof state !== "string" ||
      !expectedState ||
      state !== expectedState
    ) {
      req.log.warn("OAuth callback state mismatch or missing code");
      res.redirect("/?auth=failed");
      return;
    }

    try {
      const client = oauthClient(req);
      const { tokens } = await client.getToken(code);
      const idToken = tokens.id_token;
      if (!idToken) {
        throw new Error("Google token response did not include an ID token");
      }
      const ticket = await client.verifyIdToken({
        idToken,
        audience: requiredEnv("GOOGLE_CLIENT_ID"),
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new Error("Google ID token is missing required claims");
      }
      const allowlist = allowedEmails();
      if (allowlist.length > 0) {
        if (!allowlist.includes(payload.email.toLowerCase())) {
          req.log.warn(
            { email: payload.email },
            "Sign-in rejected: email not in ALLOWED_EMAILS",
          );
          res.redirect("/?auth=unauthorized");
          return;
        }
      } else {
        req.log.warn(
          "ALLOWED_EMAILS is not set — any Google account can sign in",
        );
      }
      setSessionCookie(res, {
        sub: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        picture: payload.picture,
      });
      res.redirect("/");
    } catch (err) {
      req.log.error({ err }, "Google OAuth code exchange failed");
      res.redirect("/?auth=failed");
    }
  },
);

router.get("/auth/me", (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json({ user });
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.status(204).end();
});

export default router;
