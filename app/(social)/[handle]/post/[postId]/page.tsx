import { notFound } from "next/navigation";
import { Timeline } from "../../../../feed/timeline";
import { isUuid, profileHandle } from "../../../../lib/paths";
export default async function PostPage({ params }: { params: Promise<{ handle: string; postId: string }> }) {
  const { handle, postId } = await params;
  const username = profileHandle(handle);
  if (!username || !isUuid(postId)) notFound();
  return <Timeline screen={{ view: "post", handle: username, id: postId }} />;
}
