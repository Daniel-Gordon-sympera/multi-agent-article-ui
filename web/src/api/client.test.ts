import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { getJobSummary } from "./pipeline";

describe("job summary cache", () => {
  it("keeps live 202 semantics on 304 and replaces them when the stored result arrives", async () => {
    let requestNumber = 0;
    const validators: Array<string | null> = [];
    server.use(
      http.get("/v1/jobs/cache-test/summary", ({ request }) => {
        validators.push(request.headers.get("If-None-Match"));
        requestNumber += 1;
        if (requestNumber === 2 || requestNumber === 4)
          return new HttpResponse(null, { status: 304 });
        return HttpResponse.json(
          { status: requestNumber === 1 ? "analysing" : "completed" },
          {
            status: requestNumber === 1 ? 202 : 200,
            headers: { ETag: requestNumber === 1 ? '"live"' : '"stored"' },
          },
        );
      }),
    );
    expect((await getJobSummary("cache-test")).kind).toBe("live");
    expect((await getJobSummary("cache-test")).kind).toBe("live");
    expect((await getJobSummary("cache-test")).kind).toBe("stored");
    expect((await getJobSummary("cache-test")).kind).toBe("stored");
    expect(validators).toEqual([null, '"live"', '"live"', '"stored"']);
  });
});
