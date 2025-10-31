import xml.etree.ElementTree as ET
from math import radians, sin, cos, sqrt, atan2

R_EARTH = 6371000.0  # meters

def haversine(lat1, lon1, lat2, lon2):
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dl = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dl/2)**2
    c = 2*atan2(sqrt(a), sqrt(1-a))
    return R_EARTH * c

def parse_gpx(path):
    tree = ET.parse(path)
    root = tree.getroot()
    pts = []
    for trk in root.findall(".//{*}trk"):
        for seg in trk.findall(".//{*}trkseg"):
            for pt in seg.findall(".//{*}trkpt"):
                lat = float(pt.get("lat"))
                lon = float(pt.get("lon"))
                ele_el = pt.find("{*}ele")
                ele = float(ele_el.text) if ele_el is not None else None
                pts.append((lat, lon, ele))
    return pts

def route_dists_grades(points):
    dists, grades = [], []
    elev_gain = elev_loss = 0.0
    for i in range(1, len(points)):
        lat1, lon1, ele1 = points[i-1]
        lat2, lon2, ele2 = points[i]
        d = haversine(lat1, lon1, lat2, lon2)
        if ele1 is None or ele2 is None:
            g = 0.0
        else:
            rise = ele2 - ele1
            elev_gain += max(0.0, rise)
            elev_loss += max(0.0, -rise)
            g = rise / max(d, 1e-6)  # unitless grade
        dists.append(d)
        grades.append(g)
    return dists, grades, elev_gain, elev_loss

def geojson_from_points(points, step=1):
    coords = [[lon, lat] for (lat, lon, _) in points[::step]]
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature",
             "geometry": {"type": "LineString", "coordinates": coords},
             "properties": {"name": "route"}}
        ]
    }
