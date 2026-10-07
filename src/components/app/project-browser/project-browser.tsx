"use client";

import styles from "./project-browser.module.css";

import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DateRangePickerField } from "@/components/ui/date-range-picker-field";
import { FilterSelect } from "@/components/ui/filter-select";
import { Tabs } from "@/components/ui/tabs";

export type ProjectBrowserItem = {
  project_id: string;
  project_name: string;
  ticket_id_prefix: string;
  description: string;
  status: string;
  priority: string;
  owner_user_id: string;
  members: string[];
  deadline: string;
  /** The server-rendered project card. */
  card: React.ReactNode;
};

type UserOption = { user_id: string; full_name: string };

const ANY = "any";
const ME = "me";

const statusGroups = {
  // "All" means everything still open: completed projects live only in their own tab.
  all: { label: "All", statuses: null },
  active: { label: "Active", statuses: ["Not Started", "In Progress", "Revision"] },
  review: { label: "In review", statuses: ["Waiting for Review", "Approved"] },
  completed: { label: "Completed", statuses: ["Completed"] },
  hold: { label: "On hold", statuses: ["On Hold", "Cancelled"] },
} as const;
type StatusGroup = keyof typeof statusGroups;

const PAGE_SIZE = 6;

const priorityRank: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const sorts = {
  deadline: "Deadline (soonest)",
  name: "Name (A–Z)",
  priority: "Priority (urgent first)",
} as const;
type SortKey = keyof typeof sorts;

// Filters live in the URL (?status=&q=&owner=&member=&priority=&from=&to=&sort=) so they survive
// opening a project and coming back, and can be shared as a link.
const FILTER_KEYS = ["q", "owner", "member", "priority", "from", "to"] as const;

/** Status tabs, search, and filters for the Projects page. Filtering is client-side over the cards. */
export function ProjectBrowser({ items, users, currentUserId, action }: { items: ProjectBrowserItem[]; users: UserOption[]; currentUserId: string; action?: React.ReactNode }) {
  const params = useSearchParams();
  const read = (key: string, fallback = "") => params.get(key) ?? fallback;

  const status = (read("status", "all") in statusGroups ? read("status", "all") : "all") as StatusGroup;
  const query = read("q");
  const owner = read("owner", ANY);
  const member = read("member", ANY);
  const priority = read("priority", ANY);
  const from = read("from");
  const to = read("to");
  const sort = (read("sort", "deadline") in sorts ? read("sort", "deadline") : "deadline") as SortKey;
  const activeFilterCount = FILTER_KEYS.filter((key) => params.get(key) && params.get(key) !== ANY).length;
  const [panelOpen, setPanelOpen] = useState(activeFilterCount > 0);

  // history.replaceState keeps useSearchParams in sync without a server round-trip (no refetch per keystroke).
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    // Any filter/tab/sort change starts again at page 1.
    if (!("page" in changes)) next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      const isDefault = !value || value === ANY || (key === "status" && value === "all") || (key === "sort" && value === "deadline") || (key === "page" && value === "1");
      if (isDefault) next.delete(key);
      else next.set(key, value);
    }
    const search = next.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }

  function clearFilters() {
    update(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])));
  }

  const userName = useMemo(() => new Map(users.map((user) => [user.user_id, user.full_name])), [users]);

  // Everything except the status tab, so tab counts reflect the other filters.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const memberId = member === ME ? currentUserId : member;
    return items.filter((project) => {
      if (needle) {
        const haystack = [project.project_name, project.ticket_id_prefix, project.description, userName.get(project.owner_user_id) ?? ""].join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (owner !== ANY && project.owner_user_id !== owner) return false;
      if (member !== ANY && project.owner_user_id !== memberId && !project.members.includes(memberId)) return false;
      if (priority !== ANY && project.priority !== priority) return false;
      const deadline = project.deadline.slice(0, 10);
      if (from && (!deadline || deadline < from)) return false;
      if (to && (!deadline || deadline > to)) return false;
      return true;
    });
  }, [items, query, owner, member, priority, from, to, currentUserId, userName]);

  const inGroup = (project: ProjectBrowserItem, group: StatusGroup) => {
    const statuses = statusGroups[group].statuses as readonly string[] | null;
    if (!statuses) return project.status !== "Completed";
    return statuses.includes(project.status);
  };

  const visible = useMemo(() => {
    const list = filtered.filter((project) => inGroup(project, status));
    return [...list].sort((a, b) => {
      if (sort === "name") return a.project_name.localeCompare(b.project_name);
      if (sort === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) || a.project_name.localeCompare(b.project_name);
      // Soonest deadline first; projects without one go last.
      return (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.project_name.localeCompare(b.project_name);
    });
  }, [filtered, status, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(pageCount, Math.max(1, Number(read("page", "1")) || 1));
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const goToPage = (page: number) => {
    update({ page: String(page) });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tabs = (Object.keys(statusGroups) as StatusGroup[]).map((group) => ({
    id: group,
    label: `${statusGroups[group].label} · ${filtered.filter((project) => inGroup(project, group)).length}`,
  }));

  const owners = users.filter((user) => items.some((project) => project.owner_user_id === user.user_id));

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Tabs items={tabs} value={status} onValueChange={(value) => update({ status: value })} aria-label="Project status" />
        <div className={styles.actions}>
          <Button type="button" variant={panelOpen || activeFilterCount ? "default" : "outline"} size="lg" onClick={() => setPanelOpen((open) => !open)} aria-expanded={panelOpen}>
            <Filter className={styles.icon} aria-hidden />
            Filter
            {activeFilterCount ? <span className={styles.count}>{activeFilterCount}</span> : null}
          </Button>
          {action}
        </div>
      </div>

      {panelOpen ? (
        <div className={styles.panel}>
          <label className={styles.searchField}>
            <Search className={styles.searchIcon} aria-hidden />
            <input
              value={query}
              onChange={(event) => update({ q: event.target.value })}
              className={styles.searchInput}
              placeholder="Search project name, ticket code, description, or owner"
              aria-label="Search projects"
            />
          </label>
          <div className={styles.grid}>
            <FilterSelect
              label="Owner"
              value={owner}
              options={[{ value: ANY, label: "Anyone" }, ...owners.map((user) => ({ value: user.user_id, label: user.full_name }))]}
              onValueChange={(value) => update({ owner: value })}
            />
            <FilterSelect
              label="Member"
              value={member}
              options={[{ value: ANY, label: "Anyone" }, { value: ME, label: "Me" }, ...users.map((user) => ({ value: user.user_id, label: user.full_name }))]}
              onValueChange={(value) => update({ member: value })}
            />
            <FilterSelect
              label="Priority"
              value={priority}
              options={[{ value: ANY, label: "Any priority" }, ...["Urgent", "High", "Medium", "Low"].map((value) => ({ value, label: value }))]}
              onValueChange={(value) => update({ priority: value })}
            />
            <DateRangePickerField label="Deadline" value={{ from, to }} onChange={(range) => update({ from: range.from, to: range.to })} />
            <FilterSelect
              label="Sort by"
              value={sort}
              options={(Object.keys(sorts) as SortKey[]).map((value) => ({ value, label: sorts[value] }))}
              onValueChange={(value) => update({ sort: value })}
            />
          </div>
        </div>
      ) : null}

      <div className={styles.summary}>
        <span>
          {visible.length > PAGE_SIZE ? (
            <>
              Showing <strong>{(currentPage - 1) * PAGE_SIZE + 1}–{(currentPage - 1) * PAGE_SIZE + pageItems.length}</strong> of {visible.length} projects
            </>
          ) : (
            <>
              Showing <strong>{visible.length}</strong> of {items.length} projects
            </>
          )}
        </span>
        {activeFilterCount ? (
          <button type="button" className={styles.clear} onClick={clearFilters}>
            <X className={styles.icon} aria-hidden />
            Clear filters
          </button>
        ) : null}
      </div>

      {visible.length ? (
        <div className={styles.cards}>
          {pageItems.map((project) => (
            <div key={project.project_id} className={styles.cardSlot}>
              {project.card}
            </div>
          ))}
        </div>
      ) : null}

      {visible.length > 0 && pageCount > 1 ? (
        <nav className={styles.pager} aria-label="Projects pages">
          <Button type="button" variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
            <ChevronLeft className={styles.icon} aria-hidden />
            Prev
          </Button>
          <div className={styles.pages}>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={page === currentPage ? styles.pageOn : styles.page}
                onClick={() => goToPage(page)}
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`Page ${page}`}
              >
                {page}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount}>
            Next
            <ChevronRight className={styles.icon} aria-hidden />
          </Button>
        </nav>
      ) : null}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>No projects match {activeFilterCount ? "these filters" : "this tab"}.</p>
          {activeFilterCount ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
