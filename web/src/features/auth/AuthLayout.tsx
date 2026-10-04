/** Centered single-card layout for sign-in and the forced password change (not in the mockup). */
import type { ReactNode } from "react";

export interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex items-center gap-3 self-center">
          <img
            src="/sympera-logo.png"
            alt="Sympera AI logo"
            width={40}
            height={40}
            className="size-10 rounded-control"
          />
          <div className="flex flex-col leading-[1.15]">
            <span className="text-[18px] font-bold tracking-[-0.01em] text-ink">Sympera AI</span>
            <span className="text-[11px] font-semibold tracking-[0.06em] text-brand-600 uppercase">
              Scout
            </span>
          </div>
        </div>
        <section className="card flex flex-col gap-5 p-6" aria-labelledby="auth-title">
          <header className="flex flex-col gap-1">
            <h1 id="auth-title" className="text-[20px] font-bold tracking-[-0.01em] text-ink">
              {title}
            </h1>
            {description ? <p className="text-[13px] text-muted">{description}</p> : null}
          </header>
          {children}
        </section>
        {footer ? <p className="text-center text-[12px] text-muted">{footer}</p> : null}
      </div>
    </main>
  );
}
