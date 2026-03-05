document.addEventListener(
	"keydown",
	(event) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "d") {
			event.preventDefault();
			event.stopPropagation();
			browser.runtime.sendMessage({ type: "toggle-current-tab" }).then((raw) => {
				const result = raw as { action: "saved" | "removed" | "not-logged-in" } | null;
				if (result?.action === "saved") {
					/* noop */
				} else if (result?.action === "removed") {
					/* noop */
				}
			});
		}
	},
	true,
);
