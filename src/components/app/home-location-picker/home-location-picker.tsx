"use client";

import "leaflet/dist/leaflet.css";
import styles from "./home-location-picker.module.css";

import type { Map as LeafletMap, Marker } from "leaflet";
import { Loader2, LocateFixed, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DEFAULT_OFFICE } from "@/lib/attendance-location";

export type PickedPlace = { lat: number; lng: number; label: string };
type SearchResult = PickedPlace;

async function reverseLabel(lat: number, lng: number) {
  const body = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`)
    .then((response) => response.json() as Promise<{ data?: { label?: string } }>)
    .catch(() => null);
  const label = body?.data?.label ?? "";
  return label === "Open in Google Maps" ? "" : label;
}

function PickerBody({ initial, saving, onCancel, onSave }: { initial: PickedPlace | null; saving: boolean; onCancel: () => void; onSave: (place: PickedPlace) => void }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [status, setStatus] = useState<"" | "searching" | "locating" | "naming">("");
  const [error, setError] = useState("");

  /** Move the pin (creating it on first use) and optionally centre the map there. */
  function placePin(lat: number, lng: number, pan: boolean) {
    setPoint({ lat, lng });
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }

  async function nameSpot(lat: number, lng: number) {
    setStatus("naming");
    setLabel(await reverseLabel(lat, lng));
    setStatus("");
  }

  // Create the map once; clicks and drags move the pin.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapNode.current) return;
      const start = initial ?? DEFAULT_OFFICE;
      const map = L.map(mapNode.current, { zoomControl: true }).setView([start.lat, start.lng], initial ? 17 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({ className: styles.pin, iconSize: [22, 22], iconAnchor: [11, 22] });
      const marker = L.marker([start.lat, start.lng], { draggable: true, icon, opacity: initial ? 1 : 0 }).addTo(map);
      const drop = (lat: number, lng: number) => {
        marker.setOpacity(1);
        marker.setLatLng([lat, lng]);
        setPoint({ lat, lng });
        void nameSpot(lat, lng);
      };
      marker.on("dragend", () => drop(marker.getLatLng().lat, marker.getLatLng().lng));
      map.on("click", (event) => drop(event.latlng.lat, event.latlng.lng));
      mapRef.current = map;
      markerRef.current = marker;
      // The modal animates in; recompute the size once it has settled.
      window.setTimeout(() => map.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Mount-only: the map owns its DOM after creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setStatus("searching");
    setError("");
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`);
      const body = (await response.json()) as { data?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Search failed.");
      setResults(body.data ?? []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setStatus("");
    }
  }

  function choose(result: SearchResult) {
    markerRef.current?.setOpacity(1);
    placePin(result.lat, result.lng, true);
    setLabel(result.label);
    setResults(null);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return setError("This browser has no location access.");
    setStatus("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        markerRef.current?.setOpacity(1);
        placePin(coords.latitude, coords.longitude, true);
        void nameSpot(coords.latitude, coords.longitude);
      },
      () => {
        setStatus("");
        setError("Allow location access, or search / tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const busy = status !== "" || saving;

  return (
    <div className={styles.body}>
      <form className={styles.searchRow} onSubmit={search}>
        <input className="input" placeholder="Search your address, e.g. Jl. Melati 5, Depok" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" variant="outline" disabled={busy || query.trim().length < 3} aria-label="Search address">
          {status === "searching" ? <Loader2 className={styles.spin} aria-hidden /> : <Search className={styles.icon} aria-hidden />}
        </Button>
      </form>
      {results ? (
        <ul className={styles.results}>
          {results.length === 0 ? <li className={styles.hint}>No match. Try a shorter address, or tap the map.</li> : null}
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button type="button" className={styles.result} onClick={() => choose(result)}>
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.mapWrap}>
        <div ref={mapNode} className={styles.map} />
        <Button type="button" variant="outline" size="sm" className={styles.locate} onClick={useCurrentLocation} disabled={busy}>
          {status === "locating" ? <Loader2 className={styles.spin} aria-hidden /> : <LocateFixed className={styles.icon} aria-hidden />}
          My location
        </Button>
      </div>
      <p className={styles.hint}>Tap the map or drag the pin to your exact home. Clock-ins within 500 m count as WFH.</p>

      <label className={styles.field}>
        <span className={styles.label}>Address label</span>
        <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={status === "naming" ? "Finding address…" : "Home address"} maxLength={160} />
      </label>
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={() => point && onSave({ ...point, label: label.trim() })} disabled={!point || busy}>
          {saving ? <Loader2 className={styles.spin} aria-hidden /> : null}
          Save home
        </Button>
      </div>
    </div>
  );
}

/** Modal to set the home location by address search, map pin, or current GPS position. */
export function HomeLocationPicker({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: PickedPlace | null;
  saving: boolean;
  onClose: () => void;
  onSave: (place: PickedPlace) => void;
}) {
  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Set home location" eyebrow="Attendance" className={styles.panel}>
      <PickerBody initial={initial} saving={saving} onCancel={onClose} onSave={onSave} />
    </Modal>
  );
}
