export function buildVerificationEmailHtml(verifyUrl: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify your email — Hutch</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F5;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:8px;padding:40px;">
<tr><td>
<h1 style="margin:0 0 16px;font-size:24px;color:#18181B;">Verify your email</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#3F3F46;">Click the button below to verify your email address and activate your Hutch account.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background-color:#18181B;">
<a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 24px;font-size:16px;color:#FFFFFF;text-decoration:none;border-radius:6px;">Verify email</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#71717A;">If you didn't create a Hutch account, you can ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
