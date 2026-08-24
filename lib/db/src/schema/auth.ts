import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Historical sign-in records retained for the Administrative analytics page.
export const loginEventsTable = pgTable("login_events", {
  id: serial("id").primaryKey(),
  googleSub: text("google_sub").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
