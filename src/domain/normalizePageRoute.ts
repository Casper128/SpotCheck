export function normalizePageRoute(value: string): string {
  let pathname = value;
  const absoluteUrl = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i.exec(value);
  if (absoluteUrl) pathname = absoluteUrl[1] ?? "/";

  pathname = pathname.split(/[?#]/, 1)[0] || "/";
  const normalized = `/${pathname}`.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}
