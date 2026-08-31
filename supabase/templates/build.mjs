import { writeFileSync, mkdirSync } from "node:fs";

/**
 * One shell, three messages. Written as a generator so the branding cannot drift
 * apart between templates — every change lands in all three.
 */
const AURORA = "#00f5a0", INK = "#f3f7f3", PANEL = "#0d1a16",
      EDGE = "#1e332b", MUTED = "#9db3aa", FAINT = "#7d938a";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const shell = ({ preheader, heading, purpose, label, footnote }) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1ef;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1ef;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
             style="width:560px;max-width:100%;background:${PANEL};border:1px solid ${EDGE};border-radius:18px;">
        <tr><td style="padding:28px 32px 0 32px;">
          <span style="font-family:${SANS};font-size:19px;font-weight:700;color:${INK};letter-spacing:-0.3px;">Herd<span style="color:${AURORA};">wise</span></span>
          <div style="font-family:${SANS};font-size:12px;color:${MUTED};padding-top:3px;">City of Harare &middot; livestock platform</div>
        </td></tr>
        <tr><td style="padding:24px 32px 0 32px;">
          <h1 style="margin:0;font-family:${SANS};font-size:21px;font-weight:600;color:${INK};letter-spacing:-0.3px;">${heading}</h1>
          <p style="margin:10px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${MUTED};">${purpose}</p>
        </td></tr>
        <tr><td style="padding:22px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#08120f;border:1px solid ${EDGE};border-radius:14px;">
            <tr><td align="center" style="padding:20px 16px;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};">${label}</div>
              <div style="font-family:${MONO};font-size:34px;font-weight:600;color:${AURORA};letter-spacing:6px;padding-top:8px;">{{ .Token }}</div>
              <div style="font-family:${SANS};font-size:12px;color:${MUTED};padding-top:10px;">Expires in 10 minutes</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 0 32px;">
          <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">${footnote}</p>
        </td></tr>
        <tr><td style="padding:18px 32px 26px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid ${EDGE};padding-top:16px;">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${FAINT};">
                Herdwise staff will never ask you for this code &mdash; not by phone, not by message,
                not in person. Anyone who does is not from Herdwise.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <div style="font-family:${SANS};font-size:11px;color:#8d9a94;padding-top:14px;">
        Herdwise &middot; a platform by ITTHYNK Smart Solutions
      </div>
    </td></tr>
  </table>
</body>
</html>
`;

mkdirSync("supabase/templates", { recursive: true });

writeFileSync("supabase/templates/sign-up.html", shell({
  preheader: "Your Herdwise account confirmation code.",
  heading: "Confirm your account",
  purpose: "An account has been created for you on the Herdwise livestock platform. Enter this code to confirm your address and finish setting up.",
  label: "Confirmation code",
  footnote: "If you weren&rsquo;t expecting this, no account can be used until this code is entered. Tell your administrator so the invitation can be withdrawn.",
}));

writeFileSync("supabase/templates/magic-link.html", shell({
  preheader: "Your Herdwise sign-in code.",
  heading: "Confirm it&rsquo;s you",
  purpose: "Someone entered the correct password for your Herdwise account. Enter this code to finish signing in.",
  label: "Sign-in code",
  footnote: "If this wasn&rsquo;t you, someone else knows your password. Do not enter the code &mdash; change your password and tell your administrator.",
}));

writeFileSync("supabase/templates/reset-password.html", shell({
  preheader: "Your Herdwise password reset code.",
  heading: "Reset your password",
  purpose: "Enter this code to choose a new password for your Herdwise account.",
  label: "Reset code",
  footnote: "If you didn&rsquo;t ask to reset your password, you can ignore this message &mdash; nothing has changed and your current password still works.",
}));

console.log("wrote 3 branded templates");
