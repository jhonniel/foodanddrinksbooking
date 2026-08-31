export async function uploadPaymentProof(
  file: File,
  userId: string
): Promise<{ publicUrl: string; path: string } | { error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", "payment-proofs");
  form.append("folder", userId);

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    publicUrl?: string;
    path?: string;
  };
  if (!res.ok || !json.publicUrl || !json.path) {
    return { error: json.error ?? "Could not upload payment proof." };
  }
  return { publicUrl: json.publicUrl, path: json.path };
}
