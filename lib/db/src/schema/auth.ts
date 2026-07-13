import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Append-only log of every successful Google sign-in, powering the
// Administrative page (who logged in, when, and login-count analytics).
export const loginEventsTable = pgTable("login_events", {
  id: serial("id").primaryKey(),
  googleSub: text("google_sub").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
