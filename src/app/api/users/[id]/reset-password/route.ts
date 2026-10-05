import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { generateTemporaryPassword, hashPassword, isPasswordAccount, resetPermissionError } from "@/lib/server/passwords";
import { createResource, listResourceByFieldUnscoped, updateResource } from "@/lib/server/store";
import type { User } from "@/lib/types";

/**
 * Admin reset: sets a one-time temporary password (returned once, never stored in plain text),
 * forces a change at next sign-in, and logs the user out of existing sessions.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const [target] = (await listResourceByFieldUnscoped("Users", "user_id", id, { limit: 1 })) as User[];
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const denied = resetPermissionError(actor, target);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  if (!isPasswordAccount(target)) {
    return NextResponse.json({ error: "This account signs in with Google/Apple and has no password to reset." }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();
  await updateResource("Users", target.user_id, {
    password_hash_or_auth_id: await hashPassword(temporaryPassword),
    must_change_password: true,
    password_changed_at: new Date().toISOString(),
  } as never);
  await createResource("Activity_Logs", {
    user_id: actor.user_id,
    action: "updated",
    entity_type: "Users",
    entity_id: target.user_id,
    description: `${actor.full_name} reset the password for ${target.full_name}.`,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ data: { temporaryPassword } }, { headers: { "Cache-Control": "no-store" } });
}
