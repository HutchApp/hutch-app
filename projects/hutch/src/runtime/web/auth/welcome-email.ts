import Handlebars from "handlebars";
import { EMAIL_COLORS } from "../email-colors";

export function buildWelcomeEmailHtml({ installUrl }: { installUrl: string }): string {
	const safeInstallUrl = Handlebars.Utils.escapeExpression(installUrl);
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Readplace</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_COLORS.background};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_COLORS.background};padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_COLORS.surface};border-radius:8px;padding:40px;">
<tr><td>
<h1 style="margin:0 0 16px;font-size:24px;color:${EMAIL_COLORS.heading};">Welcome to Readplace</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">Thanks for joining — really glad you're here.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">I built Readplace because I wanted a quiet place to keep the things I want to read later, without the noise of a feed or the rot of bookmarks. It's still just me working on it, so every signup matters.</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">The fastest way to start saving is to install the browser extension:</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background-color:${EMAIL_COLORS.brand};">
<a href="${safeInstallUrl}" style="display:inline-block;padding:12px 24px;font-size:16px;color:${EMAIL_COLORS.brandText};text-decoration:none;border-radius:6px;">Get the extension</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">If anything breaks or feels off, just reply to this email — it comes straight to me, and I read everything.</p>
<p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">— Fayner</p>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.muted};">Readplace is solo-built. Your feedback shapes what I work on next.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
