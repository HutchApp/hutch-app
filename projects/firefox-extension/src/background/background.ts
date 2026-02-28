import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import type { PopupMessage } from "./messages.types";
import { initSaveCurrentTab } from "./save-current-tab";

const auth = initInMemoryAuth();
const readingList = initInMemoryReadingList();
const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
	const message = raw as PopupMessage;

	const handle = async () => {
		switch (message.type) {
			case "login": {
				return auth.login({ email: message.email, password: message.password });
			}
			case "logout": {
				await auth.logout();
				return { ok: true };
			}
			case "save-current-tab": {
				const guarded = auth.whenLoggedIn(() =>
					saveCurrentTab({ url: message.url, title: message.title }),
				);
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
			case "remove-item": {
				const guarded = auth.whenLoggedIn(() =>
					readingList.removeUrl(message.id),
				);
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
			case "check-url": {
				const guarded = auth.whenLoggedIn(() =>
					readingList.findByUrl(message.url),
				);
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
		}
	};

	handle().then(sendResponse);
	return true;
});
