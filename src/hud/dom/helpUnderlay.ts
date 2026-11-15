// Help's full-screen canvas backing cannot cover native screen roots above the canvas.
// Keep its newly mounted controls and picture strips visible while covered roots stay hidden.
export function coverHelpUnderlay(layer: HTMLElement): () => void {
  const covered = [...layer.children]
    .filter((element) => !element.classList.contains("adw-bursts"))
    .map((element) => {
      const root = element as HTMLElement;
      const display = root.style.getPropertyValue("display");
      const priority = root.style.getPropertyPriority("display");
      root.style.setProperty("display", "none", "important");
      return { display, priority, root };
    });
  let alive = true;
  return () => {
    if (!alive) {
      return;
    }
    alive = false;
    for (const { display, priority, root } of covered) {
      if (
        root.isConnected &&
        [...layer.children].includes(root) &&
        root.style.getPropertyValue("display") === "none" &&
        root.style.getPropertyPriority("display") === "important"
      ) {
        root.style.setProperty("display", display, priority);
      }
    }
  };
}
