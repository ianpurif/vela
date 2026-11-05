/** Only return visitors to actual same-site shopping/account routes after authentication. */
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 600 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s\u0000-\u001f]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://vela.invalid");
    const allowed =
      /^(?:\/account(?:\/orders(?:\/[a-zA-Z0-9_-]+)?)?|\/checkout|\/cart|\/shop|\/routine|\/admin(?:\/[a-zA-Z0-9_-]+)*)\/?$/;
    if (url.origin !== "https://vela.invalid" || !allowed.test(url.pathname)) return "/account";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/account";
  }
}
