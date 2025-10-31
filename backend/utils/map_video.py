# utils/map_video.py
from __future__ import annotations
import os, math
from typing import Dict, Any, List, Tuple

import numpy as np
from PIL import Image, ImageDraw
from moviepy.editor import VideoClip

# Optional: map tiles via staticmap (recommended). Falls back to plain bg if not present.
try:
    from staticmap import StaticMap, Line
    _HAS_STATICMAP = True
except Exception:
    _HAS_STATICMAP = False


# --------------------------- helpers ---------------------------

def _haversine_miles(a: np.ndarray, b: np.ndarray) -> float:
    Rm = 3958.7613
    la1 = math.radians(a[1]); la2 = math.radians(b[1])
    dlo  = math.radians(b[0] - a[0]); dla = la2 - la1
    h = math.sin(dla/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlo/2)**2
    return 2 * Rm * math.asin(math.sqrt(h))

def _extract_linestring(geojson: Dict[str, Any]) -> np.ndarray:
    """Return Nx2 array of [lon, lat] for LineString/MultiLineString/Feature/FeatureCollection."""
    g = geojson
    if g.get("type") == "FeatureCollection":
        feats = g.get("features") or []
        if not feats:
            raise ValueError("Empty FeatureCollection")
        g = feats[0].get("geometry") or {}
    elif g.get("type") == "Feature" and "geometry" in g:
        g = g["geometry"]

    t = g.get("type")
    if t == "LineString":
        coords = g["coordinates"]
    elif t == "MultiLineString":
        coords = [c for part in g["coordinates"] for c in part]
    else:
        raise ValueError(f"Unsupported geometry type: {t}")

    arr = np.asarray(coords, dtype=float)
    if arr.ndim != 2 or arr.shape[1] < 2:
        raise ValueError("Invalid coordinates")
    return arr[:, :2]  # lon, lat

def _cumdist_miles(lonlat: np.ndarray) -> np.ndarray:
    seg = np.array([_haversine_miles(lonlat[i], lonlat[i+1]) for i in range(len(lonlat)-1)], float)
    return np.insert(np.cumsum(seg), 0, 0.0)

def _world_px(lon: np.ndarray, lat: np.ndarray, z: int) -> Tuple[np.ndarray, np.ndarray]:
    """Spherical mercator to 'world pixels' at zoom z (256px tiles)."""
    S = 256 * (2**z)
    x = (lon + 180.0) / 360.0 * S
    lat_rad = np.radians(lat)
    y = (1.0 - np.log(np.tan(np.pi/4 + lat_rad/2.0)) / np.pi) / 2.0 * S
    return x, y

def _inv_world_px(xw: float, yw: float, z: int) -> Tuple[float, float]:
    """Inverse of _world_px for a single point."""
    S = 256 * (2**z)
    lon = (xw / S) * 360.0 - 180.0
    y = 2.0 * (yw / S) - 1.0
    lat = np.degrees(2.0 * np.arctan(np.exp(-y * np.pi)) - np.pi/2.0)
    return lon, float(lat)


# --------------------------- main ---------------------------

def generate_route_video(
    *,
    geojson: Dict[str, Any],
    dist_mi: List[float],
    speed_mph: List[float],
    out_path: str,
    fps: int = 30,
    width: int = 1280,
    height: int = 720,
    max_seconds: int = 60,
    map_tiles: bool = True,
    padding: float = 0.05,         # padding used for the final full-route view
    follow_zoom: int = 14,         # how close the follow-cam is (14–16 typical)
    zoom_out_seconds: float = 2.0, # duration of the reveal
    hold_at_finish_seconds: float = 0.6,  # pause on the final dot before zooming
    elev_ft: list[float] | None = None,
    final_summary_hold_seconds: float = 1.2,
) -> None:
    """
    Follow-cam from start→finish (dot centered), then hold, then zoom-out to show entire route.
    Timeline is paced by predicted speed (dist_mi / speed_mph).
    """

    # ---------- inputs & motion along predicted timeline ----------
    dist  = np.asarray(dist_mi, float)
    speed = np.asarray(speed_mph, float)
    if len(dist) != len(speed) or len(dist) < 2:
        raise ValueError("dist_mi and speed_mph must be same length >= 2")
    if elev_ft is not None:
        elev = np.asarray(elev_ft, float)
    else:
        elev = None

    lonlat = _extract_linestring(geojson)     # shape (M,2) [lon,lat]
    if len(lonlat) < 2:
        raise ValueError("Route too short")

    cum_gpx = _cumdist_miles(lonlat)
    total_mi = float(cum_gpx[-1])
    dist = np.clip(dist, 0, max(total_mi, 1e-6))

    # interpolate lon/lat at each analysis distance (so speed timing matches the path)
    pts_ll = []
    j = 0
    for d in dist:
        while j < len(cum_gpx)-2 and cum_gpx[j+1] < d:
            j += 1
        d0, d1 = cum_gpx[j], cum_gpx[j+1]
        t = 0.0 if d1 == d0 else (d - d0) / (d1 - d0)
        pts_ll.append(lonlat[j]*(1-t) + lonlat[j+1]*t)
    pts_ll = np.vstack(pts_ll)  # (N,2)

    # durations per predicted speed
    dd = np.diff(dist, prepend=dist[0]); dd[0] = max(dd[1] if len(dd)>1 else 1e-3, 1e-3)
    seg_sec = np.maximum(dd / np.maximum(speed, 0.1) * 3600.0, 0.01)
    T = float(np.sum(seg_sec))
    if T > max_seconds:
        seg_sec *= (max_seconds / T)
    frames_per_seg = np.clip(np.round(seg_sec * fps).astype(int), 1, 10**6)

    # expand to per-frame lon/lat (smooth)
    frame_ll = []
    for i in range(len(pts_ll)-1):
        n = int(frames_per_seg[i])
        for k in range(n):
            t = (k + 1) / n
            frame_ll.append(pts_ll[i]*(1-t) + pts_ll[i+1]*t)
    frame_ll.append(pts_ll[-1])
    frame_ll = np.vstack(frame_ll)   # (F,2)
    F = len(frame_ll)

    # ---------- stitched basemap: ensure a centered crop fits for ALL frames, and
    # also ensure final dot-centered "fit whole route" zoom is possible ----------
    MAX_SIDE = 7000
    EXTRA = 0.20  # extra beyond exact half-viewport so we never clamp

    zx = follow_zoom
    while True:
        # world px of every frame at this zoom
        xw_all, yw_all = _world_px(frame_ll[:,0], frame_ll[:,1], zx)

        # follow phase requirement (centered width×height crop at ANY frame)
        margin_x_follow = width  * (0.5 + EXTRA)
        margin_y_follow = height * (0.5 + EXTRA)
        req_w_follow = (xw_all.max() - xw_all.min()) + 2*margin_x_follow
        req_h_follow = (yw_all.max() - yw_all.min()) + 2*margin_y_follow

        # final zoom-out requirement (centered on LAST DOT, must fit entire route)
        xw_route, yw_route = _world_px(lonlat[:,0], lonlat[:,1], zx)
        rx_min, rx_max = float(xw_route.min()), float(xw_route.max())
        ry_min, ry_max = float(yw_route.min()), float(yw_route.max())
        cx_last, cy_last = float(xw_all[-1]), float(yw_all[-1])

        dx_left  = cx_last - rx_min
        dx_right = rx_max  - cx_last
        dy_up    = cy_last - ry_min
        dy_down  = ry_max  - cy_last

        pad_px_x = width  * padding
        pad_px_y = height * padding
        req_w_final = 2 * max(dx_left, dx_right) + 2 * pad_px_x
        req_h_final = 2 * max(dy_up,   dy_down)  + 2 * pad_px_y

        req_w = max(req_w_follow, req_w_final)
        req_h = max(req_h_follow, req_h_final)

        if req_w <= MAX_SIDE and req_h <= MAX_SIDE:
            break
        zx -= 1
        if zx < 4:
            break

    # stitched image size & center
    w_map = int(min(max(width,  req_w), MAX_SIDE))
    h_map = int(min(max(height, req_h), MAX_SIDE))

    cx_w = (xw_all.min() + xw_all.max()) / 2.0
    cy_w = (yw_all.min() + yw_all.max()) / 2.0
    center_ll = _inv_world_px(cx_w, cy_w, zx)

    # ---------- render the big map once ----------
    if map_tiles and _HAS_STATICMAP:
        key = os.environ.get("MAPTILER_KEY", "").strip()
        tile_url = (f"https://api.maptiler.com/maps/streets/256/{{z}}/{{x}}/{{y}}.png?key={key}"
                    if key else "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png")
        m = StaticMap(w_map, h_map, url_template=tile_url)
        # faint base route under the trail
        m.add_line(Line([tuple(p) for p in lonlat.tolist()], 'blue', 2))
        base_map = m.render(zoom=zx, center=center_ll)  # PIL.Image
        # attribution
        d0 = ImageDraw.Draw(base_map)
        tag = "© OpenStreetMap • © MapTiler"
        tw = 7*len(tag)//2 + 16
        d0.rectangle((w_map - tw - 8, h_map - 28, w_map - 8, h_map - 8), fill=(255,255,255))
        d0.text((w_map - tw - 4, h_map - 24), tag, fill=(0,0,0))
    else:
        base_map = Image.new("RGB", (w_map, h_map), (242,245,248))

    # world→bigmap pixel transform
    wx0 = cx_w - w_map/2.0
    wy0 = cy_w - h_map/2.0
    def w2p(xw: np.ndarray, yw: np.ndarray) -> np.ndarray:
        return np.stack([xw - wx0, yw - wy0], axis=1)

    route_xy  = w2p(*_world_px(lonlat[:,0], lonlat[:,1], zx))
    frames_xy = w2p(*_world_px(frame_ll[:,0], frame_ll[:,1], zx))

    # final full-route fit (center at route center, not at the dot)
    rx_min, ry_min = route_xy.min(axis=0)
    rx_max, ry_max = route_xy.max(axis=0)
    fit_cx = (rx_min + rx_max)/2.0
    fit_cy = (ry_min + ry_max)/2.0
    bbox_w = rx_max - rx_min
    bbox_h = ry_max - ry_min
    fit_w = int(min(w_map, max(width,  int(bbox_w * (1 + 2*padding)))))
    fit_h = int(min(h_map, max(height, int(bbox_h * (1 + 2*padding)))))

    # HUD interpolation arrays
    dist_for_frame  = np.interp(np.linspace(0,1,F), np.linspace(0,1,len(dist)),  dist)
    speed_for_frame = np.interp(np.linspace(0,1,F), np.linspace(0,1,len(speed)), speed)
    
    # NEW: elevation per frame (if provided)
    if elev is not None and len(elev) == len(dist):
        elev_for_frame = np.interp(np.linspace(0,1,F), np.linspace(0,1,len(elev)), elev)
        has_elev = True
    else:
        elev_for_frame = np.full(F, np.nan)
        has_elev = False
        
    total_dist = float(dist_for_frame[-1])
    avg_speed = float(np.nanmean(speed_for_frame))
    avg_elev  = float(np.nanmean(elev_for_frame)) if has_elev else float("nan")

    # helpers
    def crop_center(cx: float, cy: float, vw: int, vh: int) -> Tuple[Image.Image, int, int]:
        x0 = int(round(cx - vw/2)); y0 = int(round(cy - vh/2))
        x0 = max(0, min(x0, w_map - vw))
        y0 = max(0, min(y0, h_map - vh))
        return base_map.crop((x0, y0, x0+vw, y0+vh)), x0, y0

    def draw_trail(img: Image.Image, idx: int, x0: int, y0: int):
        if idx <= 0:
            return
        seg = frames_xy[:idx+1]
        pts = [(float(px - x0), float(py - y0)) for px,py in seg]
        ImageDraw.Draw(img).line(pts, fill=(14,165,233), width=6)

    def draw_dot(img: Image.Image, dot_xy: Tuple[float,float]):
        dr = ImageDraw.Draw(img)
        x, y = dot_xy
        r = 6
        dr.ellipse((x-r, y-r, x+r, y+r), fill=(220,38,38), outline=(255,255,255), width=2)

    def draw_hud(img: Image.Image, idx: int, *, summary: bool = False):
        dr = ImageDraw.Draw(img)

        if not summary:
            # live stats, each on its own line
            mph = float(speed_for_frame[idx])
            mi  = float(dist_for_frame[idx])
            lines = [
                f"Distance: {mi:.2f} mi",
                f"Speed: {mph:.1f} mph",
            ]
            if has_elev and not np.isnan(elev_for_frame[idx]):
                lines.append(f"Elevation: {float(elev_for_frame[idx]):.0f} ft")
        else:
            # summary shown during/after zoom-out
            lines = ["Summary",
                     f"Total distance: {total_dist:.2f} mi",
                     f"Average Speed: {avg_speed:.1f} mph"]
            if has_elev and not np.isnan(avg_elev):
                lines.append(f"Average Elevation: {avg_elev:.0f} ft")

        # simple sizing using the longest line
        longest = max(len(s) for s in lines)
        line_h  = 18
        pad_x, pad_y = 10, 8
        box_w = int(7.2 * longest) + pad_x*2
        box_h = line_h * len(lines) + pad_y*2

        dr.rectangle((10, 10, 10 + box_w, 10 + box_h), fill=(255,255,255), outline=(0,0,0))
        y = 10 + pad_y
        for s in lines:
            dr.text((10 + pad_x, y), s, fill=(0,0,0))
            y += line_h

    zoom_frames = max(1, int(round(zoom_out_seconds * fps)))
    hold_frames = max(0, int(round(hold_at_finish_seconds * fps)))
    final_hold_frames = max(0, int(round(final_summary_hold_seconds * fps)))  # NEW

    total_frames = F + hold_frames + zoom_frames + final_hold_frames

    def make_frame(t):
        idx = min(int(t*fps), total_frames - 1)

        if idx < F:
            # FOLLOW (dot centered)
            cx, cy = frames_xy[idx]
            crop, x0, y0 = crop_center(cx, cy, width, height)
            draw_trail(crop, idx, x0, y0)
            dx, dy = frames_xy[idx][0] - x0, frames_xy[idx][1] - y0
            draw_dot(crop, (dx, dy))
            draw_hud(crop, idx, summary=False)
            return np.asarray(crop)

        if idx < F + hold_frames:
            # HOLD at finish (still live stats)
            cx, cy = frames_xy[-1]
            crop, x0, y0 = crop_center(cx, cy, width, height)
            draw_trail(crop, F-1, x0, y0)
            dx, dy = frames_xy[-1][0] - x0, frames_xy[-1][1] - y0
            draw_dot(crop, (dx, dy))
            draw_hud(crop, F-1, summary=False)
            return np.asarray(crop)

        if idx < F + hold_frames + zoom_frames:
            # ZOOM-OUT (scale-only) — show summary averages during the zoom
            k  = idx - (F + hold_frames)
            a  = (k + 1) / max(1, zoom_frames)
            ae = 1 - (1 - a)*(1 - a)   # ease-out

            cx, cy = frames_xy[-1]  # lock center at finish dot

            dx_left  = cx - rx_min; dx_right = rx_max - cx
            dy_up    = cy - ry_min; dy_down  = ry_max - cy
            pad_px_x = width  * padding
            pad_px_y = height * padding
            target_w = int(min(w_map, max(width,  2*max(dx_left, dx_right) + 2*pad_px_x)))
            target_h = int(min(h_map, max(height, 2*max(dy_up,   dy_down)  + 2*pad_px_y)))

            vw = int(round((1 - ae) * width  + ae * target_w))
            vh = int(round((1 - ae) * height + ae * target_h))

            crop, x0, y0 = crop_center(cx, cy, vw, vh)
            crop = crop.resize((width, height), Image.BICUBIC)

            draw_trail(crop, F-1, x0, y0)
            dx, dy = frames_xy[-1][0] - x0, frames_xy[-1][1] - y0
            draw_dot(crop, (dx, dy))
            draw_hud(crop, F-1, summary=True)   # << averages during zoom-out
            return np.asarray(crop)

        # FINAL SUMMARY HOLD (completely still; keep averages on screen)
        cx, cy = frames_xy[-1]
        dx_left  = cx - rx_min; dx_right = rx_max - cx
        dy_up    = cy - ry_min; dy_down  = ry_max - cy
        pad_px_x = width  * padding; pad_px_y = height * padding
        vw = int(min(w_map, max(width,  2*max(dx_left, dx_right) + 2*pad_px_x)))
        vh = int(min(h_map, max(height, 2*max(dy_up,   dy_down)  + 2*pad_px_y)))

        crop, x0, y0 = crop_center(cx, cy, vw, vh)
        crop = crop.resize((width, height), Image.BICUBIC)

        draw_trail(crop, F-1, x0, y0)
        dx, dy = frames_xy[-1][0] - x0, frames_xy[-1][1] - y0
        draw_dot(crop, (dx, dy))
        draw_hud(crop, F-1, summary=True)       # << keep averages visible on last frame
        return np.asarray(crop)

    duration = (F + hold_frames + zoom_frames) / float(fps)
    clip = VideoClip(make_frame, duration=duration)
    clip.write_videofile(
        out_path,
        fps=int(fps),
        codec="libx264",
        audio=False,
        preset="medium",
        threads=os.cpu_count() or 2,
        ffmpeg_params=["-pix_fmt", "yuv420p"],
    )
    clip.close()
