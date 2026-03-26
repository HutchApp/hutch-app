export type ReadingListItemId = string & {
	readonly __brand: "ReadingListItemId";
};

export interface ReadingListItem {
	id: ReadingListItemId;
	url: string;
	title: string;
	savedAt: Date;
	readUrl?: string;
}
