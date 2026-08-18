import { auth } from "./auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  const userId = (session as { userId?: string } | null)?.userId;
  const email = session?.user?.email;
  if (!userId || !email) throw new UnauthorizedError();
  return { id: userId, email };
}
