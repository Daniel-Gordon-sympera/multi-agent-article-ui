/**
 * Resume dialog — the `POST /v1/jobs/{id}/resume` options of contract §1: site timeout,
 * memory mode, re-analysis, re-enrichment and refetching dead articles. Empty fields keep the
 * settings saved with the job. Used by the Runs row action and the job header.
 */
import { useState, type ReactNode } from "react";
import type { MemoryMode, ResumeJobInput } from "@/api/types/jobs";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Orange County, FL · Construction" */
  jobTitle: ReactNode;
  pending?: boolean;
  onResume: (input: ResumeJobInput) => void;
}

const KEEP = "__keep__";
const MEMORY_MODES: Array<{ value: MemoryMode; label: string }> = [
  { value: "full", label: "full" },
  { value: "pages_only", label: "pages_only" },
  { value: "off", label: "off" },
];

function CheckRow({
  id,
  checked,
  onChange,
  label,
  help,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="cursor-pointer text-[13px] text-ink">
          {label}
        </Label>
        <p className="text-[12px] text-muted">{help}</p>
      </div>
    </div>
  );
}

export function ResumeDialog({
  open,
  onOpenChange,
  jobTitle,
  pending,
  onResume,
}: ResumeDialogProps) {
  const [siteTimeout, setSiteTimeout] = useState("");
  const [memoryMode, setMemoryMode] = useState<string>(KEEP);
  const [reanalyze, setReanalyze] = useState(false);
  const [reenrich, setReenrich] = useState(false);
  const [refetchDead, setRefetchDead] = useState(false);
  const timeoutNumber = siteTimeout.trim() === "" ? null : Number(siteTimeout);
  const timeoutInvalid =
    timeoutNumber !== null && (!Number.isInteger(timeoutNumber) || timeoutNumber < 0);

  const submit = () => {
    if (timeoutInvalid) return;
    const input: ResumeJobInput = {};
    if (timeoutNumber !== null) input.site_timeout = timeoutNumber;
    if (memoryMode !== KEEP) input.memory_mode = memoryMode as MemoryMode;
    if (reanalyze) input.reanalyze = true;
    if (reenrich) input.reenrich = true;
    if (refetchDead) input.refetch_dead_articles = true;
    onResume(input);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent hideClose aria-describedby="resume-dialog-description">
        <DialogHeader>
          <DialogTitle>Resume this run?</DialogTitle>
          <DialogDescription id="resume-dialog-description">
            {jobTitle} — unfinished site runs and dead tasks are re-queued. Leave a field empty to
            keep the setting saved with the job; overrides are audited per site run.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-site-timeout">Site timeout (s)</Label>
            <Input
              id="resume-site-timeout"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="keep saved"
              value={siteTimeout}
              invalid={timeoutInvalid}
              aria-describedby="resume-site-timeout-help"
              onChange={(event) => setSiteTimeout(event.target.value)}
            />
            <p
              id="resume-site-timeout-help"
              className={
                timeoutInvalid ? "text-[12px] text-status-fail-fg" : "text-[12px] text-muted"
              }
            >
              {timeoutInvalid ? "Whole seconds, 0 or more." : "0 = no per-site limit"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-memory-mode">Memory mode</Label>
            <Select value={memoryMode} onValueChange={setMemoryMode}>
              <SelectTrigger id="resume-memory-mode" size="form" aria-label="Memory mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>keep saved</SelectItem>
                {MEMORY_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="font-mono">
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <CheckRow
            id="resume-reanalyze"
            checked={reanalyze}
            onChange={setReanalyze}
            label="Re-analyse every article (reanalyze)"
            help="Ignores summaries of matching prompt versions and runs the analysis again."
          />
          <CheckRow
            id="resume-reenrich"
            checked={reenrich}
            onChange={setReenrich}
            label="Re-run company enrichment (reenrich)"
            help="Recomputes the company flags from the cached registry and rules."
          />
          <CheckRow
            id="resume-refetch-dead"
            checked={refetchDead}
            onChange={setRefetchDead}
            label="Refetch dead articles (refetch_dead_articles)"
            help="Fetches again the articles whose saved text expired instead of skipping them."
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} disabled={timeoutInvalid}>
            Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
