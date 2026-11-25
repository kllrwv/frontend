import { notFound } from "next/navigation";
import { Timeline } from "../../feed/timeline";
import { isUsername, profileHandle } from "../../lib/paths";
export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const username = profileHandle(handle) ?? (isUsername(handle) ? handle : null);
  if (!username) notFound();
  return <Timeline screen={{ view: "profile", handle: username, bare: !handle.startsWith("@") }} />;
}
