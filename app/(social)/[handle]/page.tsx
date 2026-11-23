import { notFound } from "next/navigation";
import { Timeline } from "../../feed/timeline";
import { profileHandle } from "../../lib/paths";
export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const username = profileHandle(handle);
  if (!username) notFound();
  return <Timeline screen={{ view: "profile", handle: username }} />;
}
