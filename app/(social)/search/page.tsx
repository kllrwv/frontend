import { Timeline } from "../../feed/timeline";

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const query = await searchParams;
  if (typeof query.tag === "string" && /^[\p{L}\p{N}_]{1,54}$/u.test(query.tag)) {
    return <Timeline screen={{ view: "tag", tag: query.tag.toLowerCase() }} />;
  }
  return <Timeline screen={{ view: "search", query: typeof query.q === "string" ? query.q.slice(0, 100) : "" }} />;
}
