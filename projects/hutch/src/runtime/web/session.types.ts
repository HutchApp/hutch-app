import type { UserId } from "../domain/user/user.types";

declare global {
	namespace Express {
		interface Request {
			userId?: UserId;
		}
	}
}
