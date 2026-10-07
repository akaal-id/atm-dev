import type { MenuHubSection } from "@/components/app/menu-hub";
import { pageCopy, type NavigationItem } from "@/lib/navigation";

/** Menu entries → hub tiles (description from the page copy). Groups become their own section. */
export function hubSections(title: string, items: NavigationItem[]): MenuHubSection[] {
  const tile = (item: NavigationItem) => ({ href: item.href, label: item.label, icon: item.icon, description: pageCopy[item.href]?.description });
  const flat = items.filter((item) => !item.children?.length).map(tile);
  const groups = items.filter((item) => item.children?.length).map((item) => ({ title: item.label, items: (item.children ?? []).map(tile) }));
  return [...(flat.length ? [{ title, items: flat }] : []), ...groups];
}
