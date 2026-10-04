import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_API_MOCK !== "1") return;
  const { startMockWorker } = await import("@/mocks/browser");
  await startMockWorker();
}

const container = document.getElementById("root");
if (!container) throw new Error("#root element missing");

void enableMocking().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
