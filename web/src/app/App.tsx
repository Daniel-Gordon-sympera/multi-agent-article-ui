/** Provider stack (contract §2.1): Query → Session → Theme → Tooltip → Router, plus toasts. */
import { RouterProvider } from "@tanstack/react-router";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { SessionProvider } from "@/app/providers/SessionProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { router } from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function App() {
  return (
    <QueryProvider client={router.options.context.queryClient}>
      <SessionProvider>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
