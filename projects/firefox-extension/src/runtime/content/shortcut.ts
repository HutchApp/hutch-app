document.addEventListener(
	"keydown",
	(event) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "d") {
			event.preventDefault();
			event.stopPropagation();
			browser.runtime.sendMessage({ type: "toggle-current-tab" }).then((raw) => {
				const result = raw as { action: "saved" | "removed" } | null;
				if (result?.action === "saved") {
					alert("Page saved to Hutch");
				} else if (result?.action === "removed") {
					alert("Page removed from Hutch");
				}
			});
		}
	},
	true,
);
