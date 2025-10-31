from math import radians, sin, cos, sqrt, atan2
from pathlib import Path
import json, requests

R_EARTH = 6371000.0

def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2-lat1)
    dl = radians(lon2-lon1)
    a = sin(dphi/2)**2 + cos(p1)*cos(p2)*sin(dl/2)**2
    return 2*R_EARTH*atan2(sqrt(a), sqrt(1-a))

def nearest_on_route(route_pts, cum_dists_m, lat, lon):
    """
    Returns (off_route_m, along_route_m, idx_closest)
    - off_route_m: shortest distance from POI to any segment
    - along_route_m: distance from route start to the nearest point on the nearest segment
    """
    best = (1e18, 0.0, 0)  # (off, along, idx)
    for i in range(1, len(route_pts)):
        lat1, lon1, _ = route_pts[i-1]
        lat2, lon2, _ = route_pts[i]
        # project POI onto segment in lat/lon by simple fraction along great circle chord
        # approximate with planar projection good for short segments:
        d12 = haversine_m(lat1, lon1, lat2, lon2) or 1e-9
        d1p = haversine_m(lat1, lon1, lat, lon)
        d2p = haversine_m(lat2, lon2, lat, lon)
        # cosine rule to estimate projection fraction
        # clamp t to [0,1]
        # avoid numeric issues for obtuse triangles
        t = max(0.0, min(1.0, (d12**2 + d1p**2 - d2p**2) / (2*d12**2)))
        # interpolate along segment for along_route distance
        along = cum_dists_m[i-1] + t * d12
        # nearest point off-route distance (to one of triangle sides approx)
        # compute nearest point’s lat/lon (roughly) by choosing closer endpoint if extreme
        # off distance ~ law of cosines residual:
        # d_off^2 = d1p^2 - (t * d12)^2  (when t in [0,1]); clamp at min(d1p, d2p) if out
        if 0.0 < t < 1.0:
            d_off_sq = max(0.0, d1p**2 - (t*d12)**2)
            d_off = d_off_sq**0.5
        else:
            d_off = min(d1p, d2p)
        if d_off < best[0]:
            best = (d_off, along, i-1)
    return best  # meters, meters, idx

def reverse_geocode_neighborhood(lat, lon, api_key: str, cache_dir: Path):
    """
    Get a friendly neighborhood/sublocality/locality string via Google Geocoding API, cached.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = f"{lat:.5f}_{lon:.5f}.json"
    p = cache_dir / key
    if p.exists():
        try:
            data = json.loads(p.read_text())
            return data.get("neighborhood")
        except Exception:
            pass

    if not api_key:
        return None  # no key—skip

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"latlng": f"{lat},{lon}", "key": api_key, "result_type": "neighborhood|sublocality|locality"}
    try:
        r = requests.get(url, params=params, timeout=15)
        if r.status_code == 200:
            j = r.json()
            # walk results to find neighborhoodish component
            name = None
            for res in j.get("results", []):
                for comp in res.get("address_components", []):
                    types = comp.get("types", [])
                    if any(t in types for t in ["neighborhood", "sublocality", "locality"]):
                        name = comp.get("long_name")
                        break
                if name: break
            p.write_text(json.dumps({"neighborhood": name}))
            return name
    except Exception:
        pass
    return None
