import json, time, os
from pathlib import Path
import requests

# Each tuple = (type, keyword, tag)
# - If 'type' is set, Places uses that.
# - If 'keyword' is set, it's a keyword search.
# - 'tag' is our desired category label for generic responses.
SEARCH_QUERIES = [
    ("bicycle_store", None, "bike_shop"),
    ("cafe",          None, "cafe"),
    ("restaurant",    None, "restaurant"),
    ("park",          None, "park"),
    (None, "water fountain", "water"),
    (None, "drinking fountain", "water"),
    (None, "hydration station", "water"),
]

# Map common Google 'types' to our categories.
TYPE_TO_CAT = {
    "bicycle_store": "bike_shop",
    "bicycle_repair_shop": "bike_shop",   # not always present, but keep
    "cafe": "cafe",
    "bakery": "cafe",
    "coffee_shop": "cafe",                # some datasets use this
    "restaurant": "restaurant",
    "meal_takeaway": "restaurant",
    "meal_delivery": "restaurant",
    "food": "restaurant",
    "park": "park",
    # leave others unmapped (they’ll use tag fallback below)
}

def classify_place(types, name=None, fallback_tag="other"):
    """Return our category, preferring explicit Google types; otherwise fallback to the query tag."""
    tset = set(types or [])
    for t in tset:
        if t in TYPE_TO_CAT:
            return TYPE_TO_CAT[t]
    # Simple name heuristics as a last resort
    label = (name or "").lower()
    if "bike" in label and ("shop" in label or "repair" in label):
        return "bike_shop"
    if any(k in label for k in ["cafe", "coffee"]):
        return "cafe"
    if any(k in label for k in ["restaurant", "pizza", "deli", "eatery", "grill", "bistro"]):
        return "restaurant"
    if "park" in label:
        return "park"
    if ("water" in label and "fountain" in label) or "hydration" in label:
        return "water"
    return fallback_tag or "other"

def _cache_path(cache_dir: Path, rhash: str) -> Path:
    return cache_dir / f"{rhash}.json"

def search_corridor(api_key: str, samples, radius_m=1609, throttle_s=0.0):
    """
    samples: list of (lat, lon)
    return: dict {places: [{place_id,name,lat,lon,vicinity,types[],category}], ...}
    """
    svc_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    seen = set()
    places = []

    for (lat, lon) in samples:
        for ptype, keyword, tag in SEARCH_QUERIES:
            params = {"location": f"{lat},{lon}", "radius": radius_m, "key": api_key}
            if ptype:
                params["type"] = ptype
            if keyword:
                params["keyword"] = keyword

            try:
                resp = requests.get(svc_url, params=params, timeout=15)
                if resp.status_code != 200:
                    continue
                data = resp.json()
            except Exception:
                continue

            for r in data.get("results", []):
                pid = r.get("place_id")
                if not pid or pid in seen:
                    continue
                seen.add(pid)
                geom = r.get("geometry", {}).get("location", {})
                types = r.get("types", []) or []
                category = classify_place(types, r.get("name"), fallback_tag=tag)

                places.append({
                    "place_id": pid,
                    "name": r.get("name"),
                    "lat": geom.get("lat"),
                    "lon": geom.get("lng"),
                    "vicinity": r.get("vicinity"),
                    "types": types,
                    "category": category
                })
            if throttle_s > 0:
                time.sleep(throttle_s)
    return {"places": places}

def get_places_cached(cache_dir: Path, rhash: str, api_key: str, samples):
    p = _cache_path(cache_dir, rhash)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        # Reclassify old cache if it lacks categories
        try:
            cached = json.loads(p.read_text())
            changed = False
            for pl in cached.get("places", []):
                if not pl.get("category"):
                    pl["category"] = classify_place(pl.get("types", []), pl.get("name"), fallback_tag="other")
                    changed = True
            if changed:
                p.write_text(json.dumps(cached))
            cached["cached"] = True
            return cached
        except Exception:
            pass

    if not api_key:
        return {"places": [], "cached": False, "note": "No GOOGLE_MAPS_API_KEY configured."}

    data = search_corridor(api_key, samples)
    data["cached"] = False
    p.write_text(json.dumps(data))
    return data
