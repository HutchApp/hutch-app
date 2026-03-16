// Chrome also doesn't reliably allow extensions to override Cmd+D via the
// commands API when it conflicts with native browser shortcuts.
// We intercept Cmd+D at the DOM level to block the native bookmark dialog,
// then message the background which opens the popup in a window via windows.create().
document.addEventListener(
	"keydown",
	(event) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "d") {
			event.preventDefault();
			event.stopPropagation();
			chrome.runtime.sendMessage({ type: "shortcut-pressed" });
		}
	},
	true,
);
