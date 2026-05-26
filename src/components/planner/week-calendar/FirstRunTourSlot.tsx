"use client";

import dynamic from "next/dynamic";

const FirstRunTour = dynamic(
  () => import("./FirstRunTour").then((m) => m.FirstRunTour),
  { ssr: false },
);

type Props = {
  plannerItemCount: number;
};

/** Reserved-height slot for the client-only tour (avoids SSR hydration mismatch). */
export function FirstRunTourSlot({ plannerItemCount }: Props) {
  return (
    <div className="min-h-0 empty:min-h-0">
      <FirstRunTour plannerItemCount={plannerItemCount} />
    </div>
  );
}
