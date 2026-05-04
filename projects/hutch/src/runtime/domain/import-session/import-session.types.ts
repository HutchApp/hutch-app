import type { UserId } from "../user/user.types";
import type { ImportSessionId } from "./import-session.schema";

export interface ImportSession {
	readonly id: ImportSessionId;
	readonly userId: UserId;
	readonly createdAt: string;
	readonly expiresAt: number;
	readonly totalUrls: number;
	readonly totalFoundInFile: number;
	readonly truncated: boolean;
	readonly deselected: ReadonlySet<number>;
}

export interface ImportSessionPage {
	readonly session: ImportSession;
	readonly pageUrls: readonly string[];
	readonly page: number;
	readonly pageSize: number;
}

export type CreateImportSession = (params: {
	userId: UserId;
	urls: readonly string[];
	truncated: boolean;
	totalFoundInFile: number;
}) => Promise<ImportSession>;

export type FindImportSession = (params: {
	id: ImportSessionId;
	userId: UserId;
}) => Promise<ImportSession | undefined>;

export type LoadImportSessionPage = (params: {
	id: ImportSessionId;
	userId: UserId;
	page: number;
	pageSize: number;
}) => Promise<ImportSessionPage | undefined>;

export type LoadAllImportSessionUrls = (params: {
	id: ImportSessionId;
	userId: UserId;
}) => Promise<readonly string[] | undefined>;

export type ToggleImportSelection = (params: {
	id: ImportSessionId;
	userId: UserId;
	index: number;
	checked: boolean;
}) => Promise<void>;

export type DeleteImportSession = (params: {
	id: ImportSessionId;
	userId: UserId;
}) => Promise<void>;

export interface ImportSessionStore {
	createImportSession: CreateImportSession;
	findImportSession: FindImportSession;
	loadImportSessionPage: LoadImportSessionPage;
	loadAllImportSessionUrls: LoadAllImportSessionUrls;
	toggleImportSelection: ToggleImportSelection;
	deleteImportSession: DeleteImportSession;
}
