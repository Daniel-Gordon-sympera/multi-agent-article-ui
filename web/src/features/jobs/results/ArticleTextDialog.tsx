/**
 * Saved text dialog — streams `GET /v1/articles/{id}?include=text` through the proxy and shows
 * it as it arrives; a `410` means the text artifact expired.
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { ApiError, isApiError } from "@/api/client";
import { qk } from "@/api/keys";
import { articleTextUrl } from "@/api/pipeline";
import type { ArticleRow } from "@/api/types/articles";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCompactNumber } from "@/lib/format";

async function readTextStream(
  url: string,
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "X-Requested-With": "scout", Accept: "text/plain, application/problem+json" },
    signal,
  });
  if (!response.ok) {
    let problem = null;
    try {
      problem = (await response.json()) as { detail?: string; error_category?: string };
    } catch {
      problem = null;
    }
    throw new ApiError(
      response.status,
      problem
        ? {
            type: "about:blank",
            title: "Saved text unavailable",
            status: response.status,
            detail: problem.detail,
            error_category: problem.error_category ?? `http_${response.status}`,
          }
        : null,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onChunk(text);
  }
  return text;
}

function ArticleTextBody({ article }: { article: ArticleRow }) {
  const [partial, setPartial] = useState("");
  const text = useQuery({
    queryKey: [...qk.v1.articles.detail(article.id), "text"],
    queryFn: ({ signal }) => readTextStream(articleTextUrl(article.id), setPartial, signal),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const expired = isApiError(text.error) && text.error.status === 410;
  const shown = text.data ?? partial;
  if (text.isError) {
    return (
      <ErrorState
        variant="plain"
        error={text.error}
        title={expired ? "The saved text has expired" : "The saved text could not be loaded"}
        description={
          expired
            ? "Text artifacts are kept for a limited time; resume the job with “refetch dead articles” to fetch it again."
            : undefined
        }
        onRetry={expired ? undefined : () => void text.refetch()}
      />
    );
  }
  return (
    <>
      <p className="text-[12px] text-muted">
        {text.data ? `${formatCompactNumber(text.data.length)} characters` : "Streaming…"}
      </p>
      <pre
        className="max-h-[60vh] overflow-auto rounded-control border border-border bg-surface-2 p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-ink"
        aria-busy={text.isPending || undefined}
      >
        {shown || (text.isPending ? "Loading the saved text…" : "")}
      </pre>
    </>
  );
}

export function ArticleTextDialog({
  article,
  onClose,
}: {
  article: ArticleRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={article !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">{article?.title ?? "Saved text"}</DialogTitle>
          <DialogDescription>
            {article ? `${article.domain} · article #${article.id}` : ""}
          </DialogDescription>
        </DialogHeader>
        {article ? <ArticleTextBody key={article.id} article={article} /> : null}
        <DialogFooter>
          {article ? (
            <Button asChild variant="secondary">
              <a href={article.canonical_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Open article
              </a>
            </Button>
          ) : null}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
