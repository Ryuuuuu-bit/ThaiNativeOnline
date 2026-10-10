// Only Google's image hosts are admitted; no arbitrary image URL comes from a save.
export function googlePictureURL(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    const trusted = ['googleusercontent.com', 'ggpht.com'].some(h => host === h || host.endsWith(`.${h}`));
    return u.protocol === 'https:' && trusted && !u.username && !u.password && !u.port ? u.href : null;
  } catch { return null; }
}
