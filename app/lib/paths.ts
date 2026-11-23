export function profilePath(username: string) {
  return `/@${encodeURIComponent(username.replace(/^@/, ""))}`;
}
export function postPath(username: string, id: string) {
  return `${profilePath(username)}/post/${encodeURIComponent(id)}`;
}
export function tagPath(tag: string) {
  return `/search?tag=${encodeURIComponent(tag)}`;
}
export function isUsername(value: string) {
  return /^[a-zа-яё0-9_-]{3,54}$/iu.test(value);
}
export function profileHandle(segment: string) {
  try {
    const value = decodeURIComponent(segment);
    const username = value.slice(1);
    return value.startsWith("@") && isUsername(username) ? username : null;
  } catch {
    return null;
  }
}
export function isUuid(value: string) {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
