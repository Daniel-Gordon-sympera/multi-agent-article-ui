/**
 * Streams the saved article text (`GET /v1/articles/{id}?include=text`, contract §1) chunk by
 * chunk so long articles appear progressively; `410` means the artifact expired.
 */
import { articleTextUrl } from "@/api/pipeline";

export type ArticleTextOutcome = "done" | "expired";

export async function streamArticleText(
  articleId: number,
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<ArticleTextOutcome> {
  const response = await fetch(articleTextUrl(articleId), {
    credentials: "include",
    headers: { "X-Requested-With": "scout", Accept: "text/plain" },
    signal,
  });
  if (response.status === 410) return "expired";
  if (!response.ok) throw new Error(`The saved text could not be loaded (${response.status}).`);
  if (!response.body) {
    onChunk(await response.text());
    return "done";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
  onChunk(decoder.decode());
  return "done";
}
