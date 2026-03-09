export type PasswordResetToken = string & {
	readonly __brand: "PasswordResetToken";
};

export type CreatePasswordResetTokenResult =
	| { ok: true; token: PasswordResetToken }
	| { ok: false; reason: "user-not-found" };

export type ResetPasswordResult =
	| { ok: true }
	| { ok: false; reason: "invalid-or-expired-token" };

export type CreatePasswordResetToken = (email: string) => Promise<CreatePasswordResetTokenResult>;

export type ResetPassword = (params: {
	token: PasswordResetToken;
	newPassword: string;
}) => Promise<ResetPasswordResult>;
