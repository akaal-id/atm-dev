"use client";

import styles from "./project-social-dashboard.module.css";

import { CalendarRange, ExternalLink, Pencil, Plus, UserRound } from "lucide-react";
import { useState } from "react";

import { SocialCampaignModal } from "@/components/app/project-dashboard/social-campaign-modal";
import { SocialPersonaModal } from "@/components/app/project-dashboard/social-persona-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { countBy } from "@/lib/content-matrix";
import { campaignStatus, splitList } from "@/lib/social-hub";
import type { Project } from "@/lib/types";
import type { ContentItem, ProjectHubData } from "@/lib/types/project-hub";
import type { AudiencePersona, Campaign, CampaignStatus } from "@/lib/types/social-hub";
import { cn, formatDate } from "@/lib/utils";

type PeriodKey = "project" | "month" | "all";

function monthRange(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

/** Content whose publication date falls in [start, end]; undated rows only count for "all time". */
function inPeriod(items: ContentItem[], range: { start: string; end: string } | null) {
  if (!range) return items;
  return items.filter((item) => item.publication_date && item.publication_date >= range.start && item.publication_date <= range.end);
}

const percentOf = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

const statusColumns: Array<{ status: CampaignStatus; label: string; tone: "blue" | "green" | "neutral" }> = [
  { status: "upcoming", label: "Upcoming", tone: "blue" },
  { status: "running", label: "Running", tone: "green" },
  { status: "done", label: "Done", tone: "neutral" },
];

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function ProjectSocialDashboard({ project, hub, canEdit }: { project: Project; hub: ProjectHubData; canEdit: boolean }) {
  const hasProjectPeriod = Boolean(project.period_start && project.period_end);
  const [period, setPeriod] = useState<PeriodKey>(hasProjectPeriod ? "project" : "month");
  const [personaEditing, setPersonaEditing] = useState<AudiencePersona | "new" | null>(null);
  const [campaignEditing, setCampaignEditing] = useState<Campaign | "new" | null>(null);

  const range =
    period === "all" ? null : period === "project" && hasProjectPeriod ? { start: project.period_start!, end: project.period_end! } : monthRange();
  const periodContent = inPeriod(hub.content, range);
  const periodLabel = range ? `${formatDate(range.start)} – ${formatDate(range.end)}` : "All time";

  const funnelStages = hub.strategy.filter((option) => option.type === "funnel");
  const funnelCounts = countBy(periodContent, "funnel");
  const funnelTotal = funnelStages.reduce((sum, stage) => sum + (funnelCounts.get(stage.label) ?? 0), 0);

  const pillars = hub.strategy.filter((option) => option.type === "pillar");
  const pillarCounts = countBy(periodContent, "pillar");
  const pillarTotal = pillars.reduce((sum, pillar) => sum + (pillarCounts.get(pillar.label) ?? 0), 0);

  const channels = hub.strategy.filter((option) => option.type === "channel").map((option) => option.label);

  return (
    <div className={styles.root}>
      <div className={styles.periodBar}>
        <CalendarRange className={styles.icon} aria-hidden />
        <span className={styles.periodText}>
          Period: <strong>{periodLabel}</strong> · {periodContent.length} content
        </span>
        <FormSelect
          name="period"
          fullWidth={false}
          value={period}
          onValueChange={(value) => setPeriod(value as PeriodKey)}
          options={[
            ...(hasProjectPeriod ? [{ value: "project", label: "Project period" }] : []),
            { value: "month", label: "This month" },
            { value: "all", label: "All time" },
          ]}
        />
      </div>

      <div className={styles.chartGrid}>
        <Card>
          <CardHeader>
            <h2 className={styles.title}>Funnel this period</h2>
            <p className={styles.subtitle}>Content per funnel stage, from the content matrix</p>
          </CardHeader>
          <CardBody>
            {funnelStages.length === 0 ? (
              <p className={styles.empty}>No funnel stages yet — add them in Overview → Strategy.</p>
            ) : (
              <ol className={styles.pyramid} aria-label="Funnel pyramid">
                {funnelStages.map((stage, index) => {
                  const count = funnelCounts.get(stage.label) ?? 0;
                  const share = percentOf(count, funnelTotal);
                  // Width narrows per stage (pyramid shape); shade deepens down the funnel.
                  const width = 100 - (index * 60) / Math.max(1, funnelStages.length - 1 || 1);
                  const shade = 25 + (index * 55) / Math.max(1, funnelStages.length - 1 || 1);
                  return (
                    <li key={stage.option_id} className={styles.level} title={`${stage.label}: ${count} content (${share}%)`}>
                      <div className={styles.levelShapeWrap}>
                        <div
                          className={styles.levelShape}
                          style={{ width: `${width}%`, background: `color-mix(in srgb, var(--primary) ${shade}%, var(--card))` }}
                        />
                      </div>
                      <div className={styles.levelLabel}>
                        <span className={styles.levelName}>
                          {stage.label}
                          {stage.description ? <span className={styles.muted}> · {stage.description}</span> : null}
                        </span>
                        <span className={styles.levelValue}>
                          {count} <span className={styles.muted}>({share}%)</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className={styles.title}>Content pillars</h2>
            <p className={styles.subtitle}>Actual share this period vs target (marker)</p>
          </CardHeader>
          <CardBody>
            {pillars.length === 0 ? (
              <p className={styles.empty}>No content pillars yet — add them in Overview → Strategy.</p>
            ) : (
              <ul className={styles.pillars}>
                {pillars.map((pillar) => {
                  const count = pillarCounts.get(pillar.label) ?? 0;
                  const share = percentOf(count, pillarTotal);
                  const target = pillar.target_share;
                  const gap = target === null ? null : share - target;
                  return (
                    <li key={pillar.option_id} className={styles.pillar} title={`${pillar.label}: ${share}% actual${target === null ? "" : `, ${target}% target`} (${count} content)`}>
                      <div className={styles.pillarHead}>
                        <span className={styles.pillarName}>{pillar.label}</span>
                        <span className={styles.pillarValue}>
                          {share}%
                          {target !== null ? <span className={styles.muted}> / target {target}%</span> : null}
                        </span>
                      </div>
                      <div className={styles.track} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-label={`${pillar.label} share`}>
                        <div className={styles.bar} style={{ width: `${share}%` }} />
                        {target !== null ? <span className={styles.marker} style={{ left: `${Math.min(100, target)}%` }} aria-hidden /> : null}
                      </div>
                      {gap !== null && pillarTotal > 0 && Math.abs(gap) >= 10 ? (
                        <span className={styles.gap}>{gap > 0 ? `${gap} pts over target` : `${-gap} pts under target`}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Audience personas · {hub.personas.length}</h2>
            <p className={styles.subtitle}>Who the content is made for</p>
          </div>
          {canEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setPersonaEditing("new")}>
              <Plus className={styles.icon} aria-hidden />
              Add persona
            </Button>
          ) : null}
        </CardHeader>
        <CardBody>
          {hub.personas.length === 0 ? (
            <p className={styles.empty}>No personas yet.</p>
          ) : (
            <ul className={styles.personaGrid}>
              {hub.personas.map((persona) => {
                const facts = [persona.age_range, persona.gender, persona.location, persona.occupation].filter(Boolean);
                return (
                  <li key={persona.persona_id} className={styles.persona}>
                    <div className={styles.personaHead}>
                      <span className={styles.personaAvatar} aria-hidden>
                        <UserRound className={styles.icon} />
                      </span>
                      <div className={styles.personaTitle}>
                        <p className={styles.personaName}>{persona.name}</p>
                        {facts.length ? <p className={styles.muted}>{facts.join(" · ")}</p> : null}
                      </div>
                      {canEdit ? (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPersonaEditing(persona)} aria-label={`Edit ${persona.name}`}>
                          <Pencil className={styles.icon} />
                        </Button>
                      ) : null}
                    </div>
                    {persona.description ? <p className={styles.personaText}>{persona.description}</p> : null}
                    {persona.interests ? (
                      <div className={styles.chips}>
                        {splitList(persona.interests).map((interest) => (
                          <span key={interest} className={styles.chip}>
                            {interest}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <dl className={styles.personaFacts}>
                      {persona.pain_points ? (
                        <div>
                          <dt>Pain points</dt>
                          <dd>{persona.pain_points}</dd>
                        </div>
                      ) : null}
                      {persona.goals ? (
                        <div>
                          <dt>Goals</dt>
                          <dd>{persona.goals}</dd>
                        </div>
                      ) : null}
                      {persona.channels ? (
                        <div>
                          <dt>Channels</dt>
                          <dd>{splitList(persona.channels).join(", ")}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Campaigns · {hub.campaigns.length}</h2>
            <p className={styles.subtitle}>Upcoming, running, and finished — by their dates</p>
          </div>
          {canEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setCampaignEditing("new")}>
              <Plus className={styles.icon} aria-hidden />
              Add campaign
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className={styles.campaignBoard}>
          {statusColumns.map((column) => {
            const items = hub.campaigns.filter((campaign) => campaignStatus(campaign) === column.status);
            return (
              <section key={column.status} className={styles.campaignColumn} aria-label={`${column.label} campaigns`}>
                <h3 className={styles.columnTitle}>
                  <Badge tone={column.tone}>{column.label}</Badge>
                  <span className={styles.muted}>{items.length}</span>
                </h3>
                {items.length === 0 ? <p className={styles.empty}>None</p> : null}
                {items.map((campaign) => (
                  <article key={campaign.campaign_id} className={cn(styles.campaign, column.status === "done" && styles.campaignDone)}>
                    <div className={styles.campaignHead}>
                      <p className={styles.campaignName}>{campaign.name}</p>
                      {canEdit ? (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCampaignEditing(campaign)} aria-label={`Edit ${campaign.name}`}>
                          <Pencil className={styles.icon} />
                        </Button>
                      ) : null}
                    </div>
                    <p className={styles.muted}>
                      {campaign.start_date ? formatDate(campaign.start_date) : "No start"} – {campaign.end_date ? formatDate(campaign.end_date) : "no end"}
                      {campaign.channel ? ` · ${campaign.channel}` : ""}
                    </p>
                    {campaign.objective ? <p className={styles.campaignText}>{campaign.objective}</p> : null}
                    <div className={styles.campaignFoot}>
                      {campaign.budget !== null ? <span className={styles.budget}>{rupiah.format(campaign.budget)}</span> : <span />}
                      {campaign.brief_url ? (
                        <a href={campaign.brief_url} target="_blank" rel="noreferrer" className={styles.link}>
                          <ExternalLink className={styles.linkIcon} aria-hidden />
                          Brief
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </CardBody>
      </Card>

      {personaEditing ? (
        <SocialPersonaModal
          projectId={project.project_id}
          persona={personaEditing === "new" ? null : personaEditing}
          nextSortOrder={hub.personas.length}
          onClose={() => setPersonaEditing(null)}
        />
      ) : null}
      {campaignEditing ? (
        <SocialCampaignModal
          projectId={project.project_id}
          campaign={campaignEditing === "new" ? null : campaignEditing}
          channels={channels}
          onClose={() => setCampaignEditing(null)}
        />
      ) : null}
    </div>
  );
}
