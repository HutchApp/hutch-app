document.addEventListener(
	"keydown",
	(event) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "d") {
			event.preventDefault();
			event.stopPropagation();
			browser.runtime.sendMessage({ type: "save-current-tab-shortcut" }).then((raw) => {
				const result = raw as { ok: boolean; item: { id: string } } | null;
				if (result?.ok) {
					alert('Page saved to Hutch');
				}
			});
		}
	},
	true,
);
