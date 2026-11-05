import "server-only";
import type { UserProfile } from "@/types/commerce";
import type { SessionUser } from "@/server/auth";
import { firestoreStore as store } from "@/server/repositories/firestore-store";
import { profileSchema } from "@/lib/validation/commerce";

export async function getProfile(user: SessionUser): Promise<UserProfile> {
  return store.transaction(async (tx) => {
    const existing = await tx.get<UserProfile>("users", user.uid);
    if (existing) {
      const searchName = existing.name.normalize("NFKC").trim().toLowerCase();
      const searchEmail = existing.email.normalize("NFKC").trim().toLowerCase();
      if (existing.searchName !== searchName || existing.searchEmail !== searchEmail) {
        const indexed = { ...existing, searchName, searchEmail };
        tx.set("users", user.uid, indexed);
        return indexed;
      }
      return existing;
    }
    const now = Date.now();
    const name = user.name || user.email.split("@")[0] || "VELA customer";
    const profile: UserProfile = {
      id: user.uid,
      email: user.email,
      name,
      searchName: name.normalize("NFKC").trim().toLowerCase(),
      searchEmail: user.email.normalize("NFKC").trim().toLowerCase(),
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
      searchName: data.name.normalize("NFKC").trim().toLowerCase(),
      searchEmail: user.email.normalize("NFKC").trim().toLowerCase(),
      updatedAt: Date.now(),
    };
    tx.set("users", user.uid, updated);
    return updated;
  });
}
