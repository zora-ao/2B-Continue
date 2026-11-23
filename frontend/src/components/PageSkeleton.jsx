import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonCard({ className, children }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-6", className)}>
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="gap-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3.5 w-36" />
          </SkeletonCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <SkeletonCard className="min-h-80 justify-between">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-44 rounded-lg" />
          </div>
          <div className="flex h-52 items-end gap-3 pt-4">
            {[45, 70, 55, 85, 60, 75, 50].map((height, index) => (
              <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%` }} />
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-80 justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto size-36 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </SkeletonCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <SkeletonCard className="min-h-56">
          <Skeleton className="h-5 w-40" />
          <div className="flex flex-col gap-3 pt-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-56">
          <Skeleton className="h-5 w-28" />
          <div className="flex flex-col gap-3 pt-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </SkeletonCard>
      </div>
    </>
  );
}

function BudgetSkeleton() {
  return (
    <>
      <Skeleton className="h-4 w-64" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <SkeletonCard className="w-full lg:w-[360px] lg:shrink-0">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="flex flex-col gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </SkeletonCard>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <SkeletonCard>
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <div className="flex flex-col gap-3 pt-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </SkeletonCard>

          <SkeletonCard>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </SkeletonCard>
        </div>
      </div>
    </>
  );
}

function AppliancesSkeleton() {
  return (
    <>
      <Skeleton className="h-4 w-56" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <SkeletonCard className="w-full lg:w-[400px] lg:shrink-0">
          <Skeleton className="h-5 w-36" />
          <div className="flex flex-col gap-3 pt-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </SkeletonCard>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} className="flex-row items-center justify-between gap-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
              <Skeleton className="h-7 w-24" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </>
  );
}

function SolarSkeleton() {
  return (
    <>
      <SkeletonCard className="gap-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-56 rounded-lg" />
            <Skeleton className="h-10 w-48 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 4 }).map((_, row) => (
                  <Skeleton key={row} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <SkeletonCard className="min-h-80 justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
          <div className="flex h-52 items-end gap-4 pt-4">
            {[60, 75, 50, 80, 65, 70, 55].map((height, index) => (
              <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%` }} />
            ))}
          </div>
        </SkeletonCard>

        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <SkeletonCard key={index} className="gap-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3.5 w-40" />
            </SkeletonCard>
          ))}
          <SkeletonCard className="h-16" />
        </div>
      </div>
    </>
  );
}

function AlertsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={index} className="gap-2.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </SkeletonCard>
        ))}
      </div>

      <SkeletonCard>
        <Skeleton className="h-5 w-28" />
        <div className="flex flex-col gap-4 pt-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}

const VARIANTS = {
  dashboard: DashboardSkeleton,
  budget: BudgetSkeleton,
  appliances: AppliancesSkeleton,
  solar: SolarSkeleton,
  alerts: AlertsSkeleton,
};

export default function PageSkeleton({ variant, label = "Loading..." }) {
  const Content = VARIANTS[variant];
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        {Content ? <Content /> : <Skeleton className="h-48 w-full rounded-xl" />}
      </div>
    </div>
  );
}
