const EMAIL_COLORS = {
	background: "#F7F8FA",
	surface: "#FFFFFF",
	heading: "#1A202C",
	body: "#5A6170",
	muted: "#8C919D",
	brand: "#C8702A",
	brandText: "#FFFFFF",
} as const;

interface BuildCheckoutRecoveryEmailParams {
	founderAvatarUrl: string;
	resumeUrl: string;
}

interface CheckoutRecoveryEmail {
	html: string;
	text: string;
}

export function buildCheckoutRecoveryEmail(
	params: BuildCheckoutRecoveryEmailParams,
): CheckoutRecoveryEmail {
	const { founderAvatarUrl, resumeUrl } = params;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Did something stop you?</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_COLORS.background};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_COLORS.background};padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_COLORS.surface};border-radius:8px;padding:40px;">
<tr><td align="center" style="padding-bottom:16px;">
<img src="${escapeHtml(founderAvatarUrl)}" width="64" height="64" alt="Fayner Brack" style="border-radius:50%;display:block;">
</td></tr>
<tr><td>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">Hi there,</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">I'm Fayner — I built Readplace alone, and I noticed you signed up but didn't make it through checkout. I wanted to ask, gently: was it the price, the flow, or something else?</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">I genuinely want to know. A two-line reply would help me more than any analytics dashboard.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">The reason I'm pushing for a paid plan at all is that the $3.99 a month is what pays for the AI summaries on every article you save — and once it lands, the manual Pocket and Instapaper import I'm running by hand for the first members. It's less than a single cup of coffee a month, and there's no investor money behind this — every subscription literally keeps Readplace running for one more month.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">If you want, I can offer you a yearly plan with 20% off — just reply to this email and I'll set it up for you. That's the founder discount, it's not on the website.</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.body};">Either way, your 14-day free trial is still waiting if you want to try it without paying first.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background-color:${EMAIL_COLORS.brand};">
<a href="${escapeHtml(resumeUrl)}" style="display:inline-block;padding:12px 24px;font-size:16px;color:${EMAIL_COLORS.brandText};text-decoration:none;border-radius:6px;">Resume your trial</a>
</td></tr></table>
<p style="margin:32px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.muted};">— Fayner<br>readplace.com</p>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">If you'd rather not hear from me, just reply STOP.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

	const text = [
		"Hi there,",
		"",
		"I'm Fayner — I built Readplace alone, and I noticed you signed up but didn't make it through checkout. I wanted to ask, gently: was it the price, the flow, or something else?",
		"",
		"I genuinely want to know. A two-line reply would help me more than any analytics dashboard.",
		"",
		"The reason I'm pushing for a paid plan at all is that the $3.99 a month is what pays for the AI summaries on every article you save — and once it lands, the manual Pocket and Instapaper import I'm running by hand for the first members. It's less than a single cup of coffee a month, and there's no investor money behind this — every subscription literally keeps Readplace running for one more month.",
		"",
		"If you want, I can offer you a yearly plan with 20% off — just reply to this email and I'll set it up for you. That's the founder discount, it's not on the website.",
		"",
		"Either way, your 14-day free trial is still waiting if you want to try it without paying first.",
		"",
		"Resume your trial:",
		resumeUrl,
		"",
		"— Fayner",
		"readplace.com",
		"",
		"If you'd rather not hear from me, just reply STOP.",
		"",
	].join("\n");

	return { html, text };
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
