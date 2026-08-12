"use client";

import { Building2, Check, ChevronDown, Layers, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useToast } from "@/components/ui/toast";
import type { Company, Organization } from "@/lib/types";
import { ALL_COMPANIES_COOKIE, buildTenantPath, TENANT_ALL } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "./company-switcher.module.css";

type ContextResponse = {
  active_company_id: string;
  company: Company;
  organization?: Organization | null;
  organizations?: Organization[];
  companies: Company[];
  can_manage_organization?: boolean;
  can_view_all_companies?: boolean;
  viewing_all_companies?: boolean;
  error?: string;
};

type CompanyGroup = {
  organizationId: string;
  organizationName: string;
  companies: Company[];
};

export function CompanySwitcher() {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [active, setActive] = useState<Company | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const [viewingAll, setViewingAll] = useState(false);
  const [roleId, setRoleId] = useState<string>("");

  const navigateToTenant = useCallback(
    (orgId: string, companyId: string) => {
      const path = tenant.rest || "/dashboard";
      router.push(buildTenantPath({ orgId, companyId, path }));
    },
    [router, tenant.rest],
  );

  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/context", { cache: "no-store" });
      const body = (await response.json()) as ContextResponse & { role_id?: string };
      if (!response.ok) throw new Error(body.error || "Failed to load companies");
      setActive(body.company);
      setOrganization(body.organization || null);
      setOrganizations(body.organizations || []);
      setCompanies(body.companies || []);
      setCanManage(Boolean(body.can_manage_organization));
      setCanViewAll(Boolean(body.can_view_all_companies));
      setViewingAll(Boolean(body.viewing_all_companies));
      setRoleId(String(body.role_id || ""));

      // Prefer company from the URL tenant segment so a manual deep-link isn't overwritten
      // by a stale context fallback in the switcher label.
      if (tenant.companyId && tenant.companyId !== TENANT_ALL) {
        const fromUrl =
          body.companies?.find((item) => item.id === tenant.companyId) ||
          (body.company?.id === tenant.companyId ? body.company : null);
        if (fromUrl) {
          setActive(fromUrl);
          setViewingAll(false);
        }
      } else if (tenant.companyId === TENANT_ALL) {
        setViewingAll(true);
      }
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Could not load companies",
        description: error instanceof Error ? error.message : "Try refreshing the page.",
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast, tenant.companyId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const companyGroups: CompanyGroup[] = (() => {
    const orgNameById = new Map(organizations.map((item) => [item.id, item.name]));
    if (organization?.id) orgNameById.set(organization.id, organization.name);

    const scopedOrgId =
      roleId === "super_admin" && tenant.orgId && tenant.orgId !== TENANT_ALL
        ? tenant.orgId
        : null;

    const visibleCompanies = scopedOrgId
      ? companies.filter((company) => company.organization_id === scopedOrgId)
      : companies;

    const byOrg = new Map<string, Company[]>();
    for (const company of visibleCompanies) {
      const orgId = company.organization_id || "unknown";
      const list = byOrg.get(orgId) || [];
      list.push(company);
      byOrg.set(orgId, list);
    }

    const currentOrgId =
      scopedOrgId ||
      active?.organization_id ||
      organization?.id ||
      "";

    return [...byOrg.entries()]
      .map(([organizationId, orgCompanies]) => ({
        organizationId,
        organizationName: orgNameById.get(organizationId) || organizationId,
        companies: orgCompanies,
      }))
      .sort((left, right) => {
        if (left.organizationId === currentOrgId) return -1;
        if (right.organizationId === currentOrgId) return 1;
        return left.organizationName.localeCompare(right.organizationName);
      });
  })();

  const allCompaniesHint =
    roleId === "super_admin" && tenant.orgId && tenant.orgId !== TENANT_ALL
      ? "Semua perusahaan di organisasi ini"
      : roleId === "super_admin"
        ? "Semua perusahaan di platform"
        : "Semua perusahaan di organisasi aktif";

  const showOrgGroupLabels = companyGroups.length > 1 && !(roleId === "super_admin" && tenant.orgId !== TENANT_ALL);

  async function switchCompany(companyId: string) {
    if (!companyId || switchingId) return;
    const alreadyAll = companyId === ALL_COMPANIES_COOKIE && viewingAll;
    const alreadySingle = companyId !== ALL_COMPANIES_COOKIE && !viewingAll && companyId === active?.id;
    if (alreadyAll || alreadySingle) return;

    setSwitchingId(companyId);
    try {
      const response = await fetch("/api/users/context", {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const body = (await response.json()) as {
        error?: string;
        company?: Company;
        viewing_all_companies?: boolean;
      };
      if (!response.ok) throw new Error(body.error || "Failed to switch company");

      const next = body.company || companies.find((item) => item.id === companyId) || null;
      if (next) setActive(next);
      setViewingAll(Boolean(body.viewing_all_companies));
      setOpen(false);
      pushToast({
        tone: "success",
        title: body.viewing_all_companies ? "Viewing all companies" : "Company switched",
        description: body.viewing_all_companies
          ? "Organization-wide data is visible."
          : next
            ? `Now working in ${next.name}.`
            : "Active company updated.",
      });

      if (body.viewing_all_companies) {
        const orgId =
          roleId === "super_admin"
            ? tenant.orgId && tenant.orgId !== TENANT_ALL
              ? tenant.orgId
              : TENANT_ALL
            : organization?.id || tenant.orgId || TENANT_ALL;
        navigateToTenant(orgId, TENANT_ALL);
      } else if (next) {
        navigateToTenant(next.organization_id || organization?.id || tenant.orgId, next.id);
      }
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Switch failed",
        description: error instanceof Error ? error.message : "Could not switch company.",
      });
    } finally {
      setSwitchingId(null);
    }
  }

  async function createCompany(event: React.FormEvent) {
    event.preventDefault();
    const name = companyName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name, switch_to: true }),
      });
      const body = (await response.json()) as { error?: string; data?: Company };
      if (!response.ok) throw new Error(body.error || "Failed to create company");

      const created = body.data;
      if (created) {
        setCompanies((current) => {
          if (current.some((item) => item.id === created.id)) return current;
          return [...current, created].sort((left, right) => left.name.localeCompare(right.name));
        });
        setActive(created);
        setViewingAll(false);
      }
      setCompanyName("");
      setCreateOpen(false);
      setOpen(false);
      pushToast({
        tone: "success",
        title: "Company created",
        description: created ? `${created.name} is ready — you are now in this company.` : "Company created.",
      });
      if (created) {
        navigateToTenant(created.organization_id || organization?.id || tenant.orgId, created.id);
      }
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Create failed",
        description: error instanceof Error ? error.message : "Could not create company.",
      });
    } finally {
      setCreating(false);
    }
  }

  const displayName = loading ? "Loading…" : viewingAll ? "All companies" : active?.name || "Select company";

  return (
    <>
      <div className={styles.wrap}>
        <button
          type="button"
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Building2 className={styles.triggerIcon} aria-hidden />
          <span className={styles.triggerText}>
            <span className={styles.triggerLabel}>Company</span>
            <span className={styles.triggerValue}>{displayName}</span>
          </span>
          {switchingId ? (
            <Loader2 className={cn(styles.chevron, styles.spin)} aria-hidden />
          ) : (
            <ChevronDown className={styles.chevron} aria-hidden />
          )}
        </button>

        {open ? (
          <div className={styles.menu} role="listbox" aria-label="Companies">
            <div className={styles.menuHeader}>
              <p className={styles.menuTitle}>My companies</p>
              <p className={styles.menuHint}>Switch without signing out</p>
            </div>
            <div className={styles.list}>
              {canViewAll ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={viewingAll}
                  className={cn(styles.item, viewingAll && styles.itemActive)}
                  disabled={Boolean(switchingId)}
                  onClick={() => void switchCompany(ALL_COMPANIES_COOKIE)}
                >
                  <span className={styles.itemBody}>
                    <span className={styles.itemName}>
                      <Layers className={styles.inlineIcon} aria-hidden />
                      All companies
                    </span>
                    <span className={styles.itemMeta}>{allCompaniesHint}</span>
                  </span>
                  {switchingId === ALL_COMPANIES_COOKIE ? (
                    <Loader2 className={cn(styles.check, styles.spin)} aria-hidden />
                  ) : viewingAll ? (
                    <Check className={styles.check} aria-hidden />
                  ) : null}
                </button>
              ) : null}

              {companyGroups.length === 0 ? (
                <p className={styles.empty}>No companies yet.</p>
              ) : (
                companyGroups.map((group) => (
                  <div key={group.organizationId} className={styles.group}>
                    {showOrgGroupLabels ? (
                      <p className={styles.groupLabel}>{group.organizationName}</p>
                    ) : null}
                    {group.companies.map((company) => {
                      const isActive = !viewingAll && company.id === active?.id;
                      const isSwitching = switchingId === company.id;
                      return (
                        <button
                          key={company.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={cn(styles.item, isActive && styles.itemActive)}
                          disabled={Boolean(switchingId)}
                          onClick={() => void switchCompany(company.id)}
                        >
                          <span className={styles.itemBody}>
                            <span className={styles.itemName}>{company.name}</span>
                          </span>
                          {isSwitching ? <Loader2 className={cn(styles.check, styles.spin)} aria-hidden /> : null}
                          {!isSwitching && isActive ? <Check className={styles.check} aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            {canManage ? (
              <div className={styles.menuFooter}>
                <button type="button" className={styles.createButton} onClick={() => setCreateOpen(true)}>
                  <Plus className={styles.createIcon} aria-hidden />
                  Create company
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {open ? (
        <button type="button" className={styles.backdrop} aria-label="Close company menu" onClick={() => setOpen(false)} />
      ) : null}

      {createOpen ? (
        <ModalPortal>
          <div className={styles.modalBackdrop}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-company-title">
              <div className={styles.modalHeader}>
                <div>
                  <p className={styles.modalEyebrow}>Organization</p>
                  <h2 id="create-company-title" className={styles.modalTitle}>
                    Create company
                  </h2>
                </div>
                <button type="button" className={styles.modalClose} aria-label="Close" onClick={() => setCreateOpen(false)}>
                  <X className={styles.createIcon} />
                </button>
              </div>
              <form onSubmit={createCompany} className={styles.modalBody}>
                <label className={styles.field}>
                  <span className={styles.caption}>Company name</span>
                  <input
                    className="input"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="e.g. Akaal Ops"
                    required
                    autoFocus
                  />
                </label>
                <p className={styles.fieldHint}>You will be added as admin and switched into the new company.</p>
                <div className={styles.modalActions}>
                  <Button type="button" variant="outline" size="lg" className="h-10 font-normal" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="lg" className="h-10 font-normal" disabled={creating || !companyName.trim()}>
                    {creating ? "Creating…" : "Create & switch"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
