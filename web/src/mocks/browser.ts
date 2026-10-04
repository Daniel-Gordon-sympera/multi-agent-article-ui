/** MSW in the browser (`VITE_API_MOCK=1`): the worker starts before React renders. */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/app") || url.pathname.startsWith("/v1")) print.warning();
    },
    quiet: true,
  });
}
