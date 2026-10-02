"use client";

import styles from "./base-location-card.module.css";

import { Building2, Home, MapPin, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PickedPlace } from "@/components/app/home-location-picker";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { HOME_RADIUS_M } from "@/lib/attendance-location";
import { requestJson } from "@/lib/request-json";

// Leaflet touches `window`, so the picker only loads in the browser, on demand.
const HomeLocationPicker = dynamic(() => import("@/components/app/home-location-picker").then((mod) => mod.HomeLocationPicker), { ssr: false });

type Place = { lat: number | null; lng: number | null; label: string };

function PlaceLink({ place }: { place: Place }) {
  return (
    <a className={styles.place} href={`https://www.google.com/maps?q=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">
      <MapPin aria-hidden />
      <span>{place.label || `${place.lat!.toFixed(5)}, ${place.lng!.toFixed(5)}`}</span>
    </a>
  );
}

/**
 * Where attendance is measured from: the company office (fixed) and the user's home,
 * which they set by address search, map pin, or current location. Read-only on other people's profiles.
 */
export function BaseLocationCard({ office, officeRadius, home, editable }: { office: Place; officeRadius: number; home: Place; editable: boolean }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const homeSet = home.lat !== null && home.lng !== null;

  async function saveHome(place: PickedPlace) {
    setSaving(true);
    try {
      await requestJson("/api/me/base-location", "PATCH", place);
      pushToast({ tone: "success", title: "Home location saved" });
      setPicking(false);
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save location", description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className={styles.title}>Work locations</h2>
        <p className={styles.subtitle}>{!homeSet && editable ? "Set your home before you can clock in." : "Each day is marked WFO, WFH, or Off-site from these."}</p>
      </CardHeader>
      <CardBody className={styles.list}>
        <div className={styles.row}>
          <span className={styles.iconSet} aria-hidden>
            <Building2 />
          </span>
          <div className={styles.text}>
            <p className={styles.name}>Office</p>
            <PlaceLink place={office} />
            <p className={styles.hint}>Within {officeRadius} m counts as WFO. Set by the company.</p>
          </div>
        </div>

        <div className={styles.row}>
          <span className={homeSet ? styles.iconSet : styles.iconMissing} aria-hidden>
            <Home />
          </span>
          <div className={styles.text}>
            <p className={styles.name}>Home</p>
            {homeSet ? <PlaceLink place={home} /> : <p className={styles.missing}>Not set</p>}
            {editable ? <p className={styles.hint}>Within {HOME_RADIUS_M} m counts as WFH.</p> : null}
          </div>
          {editable ? (
            <Button type="button" variant={homeSet ? "outline" : "default"} size="sm" onClick={() => setPicking(true)}>
              <Pencil aria-hidden />
              {homeSet ? "Change" : "Set home"}
            </Button>
          ) : null}
        </div>
      </CardBody>
      {editable && picking ? (
        <HomeLocationPicker
          open
          saving={saving}
          initial={homeSet ? { lat: home.lat!, lng: home.lng!, label: home.label } : null}
          onClose={() => setPicking(false)}
          onSave={(place) => void saveHome(place)}
        />
      ) : null}
    </Card>
  );
}
