// Content data only: account and character-slot settings (src/account).
export const ACCOUNTS = {
  slots: 4,                       // characters per account
  idPattern: /^[a-z0-9_]{3,16}$/, // account id: lowercase letters, digits, _
  idHint: 'ภาษาอังกฤษตัวเล็ก ตัวเลข หรือ _ ยาว 3–16 ตัว',
  minPassword: 6,
  pbkdfIterations: 120000,
  guestName: 'ผู้มาเยือน',
};
