import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./theme.css";
import "./social.css";
import "./feed/content.css";
import "./profile/profile.css";
import "./feed/discussion.css";
import "./status/status.css";
import { copy } from "./lib/locale";
import { WelcomeDialog } from "./ui/welcome-dialog";
export const metadata: Metadata = {
  title: copy.ru.brand,
  description: copy.ru.description,
  icons: {
    icon: "/logo.svg",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { capable: true, title: copy.ru.brand, statusBarStyle: "black" },
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><body>
    {children}
    <WelcomeDialog />
  </body></html>;
}
