import { clerkClient } from "@clerk/nextjs/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "pshadaram@gmail.com")
  .split(",")
  .map(e => e.trim().toLowerCase());

export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const clerk = await clerkClient();
    const user  = await clerk.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}
