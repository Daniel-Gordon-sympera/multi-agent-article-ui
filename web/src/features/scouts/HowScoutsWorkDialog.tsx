/** The "How Scouts work" explainer behind the note banner link (mockup §3.3). */
import { useState } from "react";
import { Button } from "@/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function HowScoutsWorkLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" size="sm" onClick={() => setOpen(true)}>
        How Scouts work
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby="how-scouts-work-description">
          <DialogHeader>
            <DialogTitle>How Scouts work</DialogTitle>
            <DialogDescription id="how-scouts-work-description">
              A Scout is a saved setup you can run again and again.
            </DialogDescription>
          </DialogHeader>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] text-ink-2">
            <li>
              <strong className="text-ink">Setup.</strong> A Scout stores the county and state, the
              location phrase for the finder, the industries, where the sites come from (the finder
              or your curated Data Sources) and the settings overrides.
            </li>
            <li>
              <strong className="text-ink">Run.</strong> Running it creates one pipeline job per
              industry (a <em>batch</em>); site-URL and seed Scouts create a single job. Each job
              carries{" "}
              <code className="font-mono text-[12px]">ui:&lt;batch&gt;:&lt;industry&gt;</code> as
              its client reference, so the jobs stay linked to the Scout and to each other.
            </li>
            <li>
              <strong className="text-ink">Follow.</strong> The jobs appear under Runs with a "batch
              n of N" chip; the Scout row shows the last run's status and its signals. Runs stay
              listed even after a Scout is archived.
            </li>
            <li>
              <strong className="text-ink">Repeat.</strong> Judged domains are remembered by the
              finder for 180 days, so repeat runs are cheaper; seed Scouts pick up new sources you
              add to Data Sources automatically.
            </li>
          </ol>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
