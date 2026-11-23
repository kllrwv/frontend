import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./theme.css";
import "./social.css";
import "./feed/content.css";
import "./profile/profile.css";
import "./feed/discussion.css";
import "./status/status.css";
import { copy } from "./lib/locale";
export const metadata: Metadata = {
  title: copy.ru.brand,
  description: copy.ru.description,
  icons: { icon: "/logo.svg" },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><body>{children}</body></html>;
}
