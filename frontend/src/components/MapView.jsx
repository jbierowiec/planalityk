import React, { useEffect, useRef } from "react";
import L from "leaflet";

function iconFor(category) {
  const color = {
    bike_shop: "#0d6efd", // blue
    cafe: "#fd7e14", // orange
    restaurant: "#dc3545", // red
    park: "#198754", // green
    water: "#20c997", // teal
    other: "#6c757d", // gray
  }[category || "other"];

  return L.divIcon({
    html: `<span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function MapView({ geojson, places }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const lineRef = useRef(null);
  const placesLayer = useRef(null);

  // init map once
  useEffect(() => {
    if (!ref.current) return;
    if (mapRef.current) return;
    mapRef.current = L.map(ref.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM contributors",
    }).addTo(mapRef.current);
  }, []);

  // draw / update route line
  useEffect(() => {
    if (!mapRef.current || !geojson) return;

    if (lineRef.current) {
      mapRef.current.removeLayer(lineRef.current);
      lineRef.current = null;
    }

    const coords = geojson.features[0].geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );
    lineRef.current = L.polyline(coords, { color: "blue", weight: 3 }).addTo(
      mapRef.current
    );
    mapRef.current.fitBounds(lineRef.current.getBounds(), {
      padding: [10, 10],
    });
  }, [geojson]);

  // draw / update places layer
  useEffect(() => {
    if (!mapRef.current) return;

    if (placesLayer.current) {
      mapRef.current.removeLayer(placesLayer.current);
      placesLayer.current = null;
    }

    placesLayer.current = L.layerGroup().addTo(mapRef.current);
    if (!places || !places.length) return;

    places.forEach((p) => {
      L.marker([p.lat, p.lon], { icon: iconFor(p.category) })
        .addTo(placesLayer.current)
        .bindPopup(
          `<strong>${p.name ?? "Unknown"}</strong><br/>${p.vicinity ?? ""}<br/>
           <span class="badge text-bg-light">${p.category || "other"}</span>`
        );
    });
  }, [places]);

  return <div id="map" ref={ref} />;
}
