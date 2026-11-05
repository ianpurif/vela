import "server-only";
import type { UserProfile } from "@/types/commerce";
import type { SessionUser } from "@/server/auth";
import { firestoreStore as store } from "@/server/repositories/firestore-store";
import { profileSchema } from "@/lib/validation/commerce";

export async function getProfile(user: SessionUser): Promise<UserProfile> {
  return store.transaction(async (tx) => {
    const existing = await tx.get<UserProfile>("users", user.uid);
    if (existing) return existing;
    const now = Date.now();
    const profile: UserProfile = {
      id: user.uid,
      email: user.email,
      name: user.name || user.email.split("@")[0] || "VELA customer",
      addresses: [],
      createdAt: now,
      updatedAt: now,
    };
    tx.set("users", user.uid, profile);
    return profile;
  });
}
export async function updateProfile(user: SessionUser, input: unknown) {
  const data = profileSchema.parse(input);
  return store.transaction(async (tx) => {
    const profile = await tx.get<UserProfile>("users", user.uid);
    const updated: UserProfile = {
      id: user.uid,
      email: user.email,
      createdAt: profile?.createdAt || Date.now(),
      ...data,
      updatedAt: Date.now(),
    };
    tx.set("users", user.uid, updated);
    return updated;
  });
}
