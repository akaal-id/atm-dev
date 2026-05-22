import { cn } from "@/lib/utils";

/** Standard workspace page stack — keeps content inside the viewport on mobile. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 w-full max-w-full space-y-5", className)}>{children}</div>;
}

/** Horizontal scroll row for kanban lanes and similar on small screens. */
export function ScrollRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-1 flex gap-4 overflow-x-auto overscroll-x-contain px-1 pb-1 snap-x snap-mandatory lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
