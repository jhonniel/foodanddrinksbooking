import type { Reward, RewardType } from "@/types";

export async function saveRewardRemote(input: {
  id?: string;
  name: string;
  description?: string | null;
  type?: RewardType;
  pointsRequired: number;
  discountValue?: number | null;
}): Promise<{ reward?: Reward; error?: string }> {
  const method = input.id ? "PATCH" : "POST";
  const res = await fetch("/api/admin/rewards", {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      pointsRequired: input.pointsRequired,
      discountValue: input.discountValue ?? null,
    }),
  });
  const payload = (await res.json().catch(() => null)) as {
    reward?: Reward;
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not save reward." };
  }

  return { reward: payload?.reward };
}

export async function deleteRewardRemote(
  rewardId: string
): Promise<{ error?: string }> {
  const res = await fetch(`/api/admin/rewards/${rewardId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not delete reward." };
  }

  return {};
}

export async function toggleRewardActiveRemote(
  rewardId: string,
  isActive: boolean
): Promise<{ error?: string }> {
  const res = await fetch("/api/admin/rewards", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rewardId, isActive }),
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not update reward." };
  }

  return {};
}
