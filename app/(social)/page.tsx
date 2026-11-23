import { redirect } from "next/navigation";
import { Timeline } from "../feed/timeline";
import { profilePath, isUsername, isUuid } from "../lib/paths";

export default async function FeedPage({ searchParams }: {
  searchParams: Promise<{ profile?: string; notifications?: string }>;
}) {
  const query = await searchParams;
  if (typeof query.profile === "string") {
    const handle = query.profile.replace(/^@/, "");
    if (handle === "me" || isUuid(handle)) {
      return <Timeline screen={{ view: "profile", handle, legacy: true }} />;
    }
    if (isUsername(handle)) redirect(profilePath(handle));
  }
  if (query.notifications !== undefined) redirect("/notifications");
  return <Timeline screen={{ view: "feed" }} />;
}
