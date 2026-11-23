import type { ReactNode } from "react";
import { SessionGate } from "./session";
export default function SocialLayout({ children }: { children: ReactNode }) {
  return <SessionGate>{children}</SessionGate>;
}
