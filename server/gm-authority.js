// Use a hello-validated server token, never a token supplied with a command.
// stillCurrent checks socket identity, token binding and the local role epoch.
export async function authenticatedAdmin({ auth, effective, token, account, persistAccount, stillCurrent }) {
  if (!token || !account || persistAccount !== account) return false;
  try {
    const id = await auth(token);
    if (id !== account || !stillCurrent()) return false;
    const allowed = await effective(id);
    return allowed === true && stillCurrent();
  } catch { return false; }
}
