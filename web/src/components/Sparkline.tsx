/**
 * Sparkline — mockup §3.1: 96×28 SVG, 12 points, muted polyline (chart-line-muted, 2 px
 * round), the last segment redrawn in brand-600 with a 3.5 px end dot (white stroke 2).
 */
import { cn } from "@/lib/cn";

export interface SparklineProps {
  /** Raw values; scaled to the box (highest value = top). */
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
  title?: string;
}

export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  pad = 3,
): Array<[number, number]> {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / range) * (height - 2 * pad);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

export function Sparkline({ values, width = 96, height = 28, className, title }: SparklineProps) {
  const points = sparklinePoints(values, width, height);
  if (points.length < 2) return null;
  const last = points[points.length - 1] as [number, number];
  const previous = points[points.length - 2] as [number, number];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="var(--chart-line-muted)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={previous[0]}
        y1={previous[1]}
        x2={last[0]}
        y2={last[1]}
        stroke="var(--brand-600)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3.5}
        fill="var(--brand-600)"
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
