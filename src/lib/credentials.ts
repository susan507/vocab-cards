/** Profiles are Supabase Auth users with a synthetic email. Not secure: a PIN is a weak password. */
export function credentials(name: string, pin: string) {
  const handle = name.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,30}$/.test(handle) || !/^\d{4,6}$/.test(pin)) return null;
  return { email: `${handle}@vocab-cards.local`, password: `vc-pin-${pin}` };
}
