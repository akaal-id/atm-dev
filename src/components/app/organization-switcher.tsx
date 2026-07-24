"use client";

import { Check, ChevronDown, Layers, Loader2, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { useToast } from "@/components/ui/toast";
import type { Company, Organization } from "@/lib/types";
import { buildTenantPath, TENANT_ALL } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "./company-switcher.module.css";

type ContextResponse = {
  role_id?: string;
  organization?: Organization | null;
  organizations?: Organization[];
  company?: Company;
  error?: string;
};

/**
 * Super-admin only: switch between organizations (and platform-wide "all").
 * Company switcher then scopes to the selected org.
 */
export function OrganizationSwitcher() {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [active, setActive] = useState<Organization | null>(null);
  const [viewingAll, setViewingAll] = useState(false);
  const [visible, setVisible] = useState(false);

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
      const body = (await response.json()) as ContextResponse;
      if (!response.ok) throw new Error(body.error || "Failed to load organizations");

      const isSuperAdmin = body.role_id === "super_admin";
      setVisible(isSuperAdmin);
      if (!isSuperAdmin) return;

      const orgs = body.organizations || [];
      setOrganizations(orgs);

      if (tenant.orgId === TENANT_ALL) {
        setViewingAll(true);
        setActive(null);
      } else {
        setViewingAll(false);
        const fromUrl = orgs.find((item) => item.id === tenant.orgId);
        setActive(fromUrl || body.organization || orgs[0] || null);
      }
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Could not load organizations",
        description: error instanceof Error ? error.message : "Try refreshing the page.",
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast, tenant.orgId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  async function switchOrganization(organizationId: string) {
    if (!organizationId || switchingId) return;
    const alreadyAll = organizationId === TENANT_ALL && viewingAll;
    const alreadySingle = organizationId !== TENANT_ALL && !viewingAll && organizationId === active?.id;
    if (alreadyAll || alreadySingle) return;

    setSwitchingId(organizationId);
    try {
      const response = await fetch("/api/users/context", {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ organization_id: organizationId }),
      });
      const body = (await response.json()) as {
        error?: string;
        organization?: Organization | null;
        company?: Company;
        viewing_all_organizations?: boolean;
        active_organization_id?: string;
      };
      if (!response.ok) throw new Error(body.error || "Failed to switch organization");

      const nextOrg =
        body.organization ||
        organizations.find((item) => item.id === organizationId) ||
        null;
      const goingAll = Boolean(body.viewing_all_organizations) || organizationId === TENANT_ALL;

      setViewingAll(goingAll);
      setActive(goingAll ? null : nextOrg);
      setOpen(false);
      pushToast({
        tone: "success",
        title: goingAll ? "Viewing all organizations" : "Organization switched",
        description: goingAll
          ? "Platform-wide data is visible."
          : nextOrg
            ? `Now working in ${nextOrg.name}.`
            : "Active organization updated.",
      });

      if (goingAll) {
        navigateToTenant(TENANT_ALL, TENANT_ALL);
      } else if (body.company) {
        navigateToTenant(organizationId, body.company.id);
      } else {
        navigateToTenant(organizationId, TENANT_ALL);
      }
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Switch failed",
        description: error instanceof Error ? error.message : "Could not switch organization.",
      });
    } finally {
      setSwitchingId(null);
    }
  }

  if (!visible && !loading) return null;

  const displayName = loading
    ? "Loading…"
    : viewingAll
      ? "All organizations"
      : active?.name || "Select organization";

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
          <Network className={styles.triggerIcon} aria-hidden />
          <span className={styles.triggerText}>
            <span className={styles.triggerLabel}>Organization</span>
            <span className={styles.triggerValue}>{displayName}</span>
          </span>
          {switchingId ? (
            <Loader2 className={cn(styles.chevron, styles.spin)} aria-hidden />
          ) : (
            <ChevronDown className={styles.chevron} aria-hidden />
          )}
        </button>

        {open ? (
          <div className={styles.menu} role="listbox" aria-label="Organizations">
            <div className={styles.menuHeader}>
              <p className={styles.menuTitle}>Organizations</p>
              <p className={styles.menuHint}>Super admin — switch tenant org</p>
            </div>
            <div className={styles.list}>
              <button
                type="button"
                role="option"
                aria-selected={viewingAll}
                className={cn(styles.item, viewingAll && styles.itemActive)}
                disabled={Boolean(switchingId)}
                onClick={() => void switchOrganization(TENANT_ALL)}
              >
                <span className={styles.itemBody}>
                  <span className={styles.itemName}>
                    <Layers className={styles.inlineIcon} aria-hidden />
                    All organizations
                  </span>
                  <span className={styles.itemMeta}>Platform-wide</span>
                </span>
                {switchingId === TENANT_ALL ? (
                  <Loader2 className={cn(styles.check, styles.spin)} aria-hidden />
                ) : viewingAll ? (
                  <Check className={styles.check} aria-hidden />
                ) : null}
              </button>

              {organizations.length === 0 ? (
                <p className={styles.empty}>No organizations yet.</p>
              ) : (
                organizations.map((organization) => {
                  const isActive = !viewingAll && organization.id === active?.id;
                  const isSwitching = switchingId === organization.id;
                  return (
                    <button
                      key={organization.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={cn(styles.item, isActive && styles.itemActive)}
                      disabled={Boolean(switchingId)}
                      onClick={() => void switchOrganization(organization.id)}
                    >
                      <span className={styles.itemBody}>
                        <span className={styles.itemName}>{organization.name}</span>
                        {organization.slug ? (
                          <span className={styles.itemMeta}>{organization.slug}</span>
                        ) : null}
                      </span>
                      {isSwitching ? <Loader2 className={cn(styles.check, styles.spin)} aria-hidden /> : null}
                      {!isSwitching && isActive ? <Check className={styles.check} aria-hidden /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {open ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close organization menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
