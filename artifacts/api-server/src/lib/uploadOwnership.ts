import { and, eq } from "drizzle-orm";
import { db, speakingUploadsTable } from "@workspace/db";
import { owned } from "./studentContext";

export async function ownsUpload(path: string): Promise<boolean> {
  const rows = await db.select().from(speakingUploadsTable)
    .where(and(owned(speakingUploadsTable), eq(speakingUploadsTable.objectPath, path)));
  return rows.length > 0;
}
