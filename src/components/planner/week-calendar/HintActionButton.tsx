"use client";

import type { ReactNode } from "react";

const hintActionClassName =
  "cursor-pointer text-left underline decoration-muted-foreground underline-offset-2 hover:text-foreground";

type Props = {
  children: ReactNode;
  onClick: () => void;
};

export function HintActionButton({ children, onClick }: Props) {
  return (
    <button type="button" className={hintActionClassName} onClick={onClick}>
      {children}
    </button>
  );
}
