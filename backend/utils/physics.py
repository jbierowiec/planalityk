import math

G = 9.80665
RHO = 1.225  # kg/m^3 @ sea level ~15°C

def infer_power_from_flat(v_flat_mps, m_total_kg, cda, crr, eff=0.97):
    """
    Infer rider power from a desired flat-ground speed (0% grade).
    P_rider = [ v * (m g crr + 0.5 rho cda v^2) ] / eff
    """
    roll = m_total_kg * G * crr
    aero = 0.5 * RHO * cda * (v_flat_mps ** 2)
    return v_flat_mps * (roll + aero) / eff


def speed_from_power(
    P_watts,
    grade,                  # grade as rise/run (e.g., -0.06 for -6%)
    m_total_kg,
    cda,
    crr,
    wind_mps=0.0,           # + = headwind, - = tailwind
    eff=0.97,
    v_min=0.0,
    v_max=40.0,             # 40 m/s ≈ 89.5 mph
    tol=1e-4,
    iters=80,
):
    """
    Solve steady-state speed v (m/s) from the power balance:
        P_rider * eff = v * ( m g sinθ + m g crr cosθ )  +  0.5 rho cda (v + wind)^2 * v
    where θ = atan(grade). Negative grade -> downhill -> sinθ < 0 -> gravity assists (faster).

    Uses robust bisection with bracket expansion (no Newton needed).
    """
    # clamp to non-negative (coasting modeled with P=0)
    P = max(0.0, float(P_watts)) * float(eff)

    theta = math.atan(grade)               # radians
    mg = m_total_kg * G

    # coefficients
    A = mg * math.sin(theta)               # grade term (can be negative on descents)
    B = mg * crr * math.cos(theta)         # rolling term (always opposes motion)
    C = 0.5 * RHO * cda                    # aero coefficient

    # residual f(v) = 0
    # f(v) = C*(v+wind)^2 * v + (A+B)*v - P
    def f(v: float) -> float:
        v_rel = v + wind_mps
        return C * (v_rel * v_rel) * v + (A + B) * v - P

    # Initial bracket
    a, b = max(0.0, v_min), max(v_min, v_max)
    fa, fb = f(a), f(b)

    # Expand upper bracket if needed (e.g., steep downhill/tailwind)
    tries = 0
    while fb < 0.0 and b < 120.0 and tries < 8:
        b *= 1.8
        fb = f(b)
        tries += 1

    # If both ends have same sign (can happen in extreme cases), return the upper bound
    if (fa > 0.0 and fb > 0.0) or (fa < 0.0 and fb < 0.0):
        return max(0.0, b)

    # Bisection
    for _ in range(iters):
        m = 0.5 * (a + b)
        fm = f(m)
        if abs(fm) < tol or (b - a) < tol:
            return max(0.0, m)
        if fa * fm <= 0.0:
            b, fb = m, fm
        else:
            a, fa = m, fm

    # Fallback
    return max(0.0, 0.5 * (a + b))


def grade_split_buckets():
    # (min%, max%, label)
    return [
        (-100.0, -6.0,  "≤ -6%"),
        (-6.0,  -4.0,   "-6% to -4%"),
        (-4.0,  -2.0,   "-4% to -2%"),
        (-2.0,   0.0,   "-2% to 0%"),
        (0.0,    2.0,   "0% to 2%"),
        (2.0,    4.0,   "2% to 4%"),
        (4.0,    6.0,   "4% to 6%"),
        (6.0,  100.0,  "≥ 6%"),
    ]


def summarize_by_buckets(dists_m, grades, speeds_mps):
    """
    Build per-grade-bucket stats weighted by distance.
    grades: grade as rise/run (e.g., -0.06 for -6%)
    """
    buckets = grade_split_buckets()
    sums = [{"label": b[2], "dist_m": 0.0, "time_s": 0.0} for b in buckets]
    for d, g, v in zip(dists_m, grades, speeds_mps):
        gpct = g * 100.0
        for idx, (lo, hi, lab) in enumerate(buckets):
            if lo <= gpct < hi:
                sums[idx]["dist_m"] += d
                sums[idx]["time_s"] += d / max(v, 0.1)
                break
    # format output
    out = []
    for s in sums:
        mi = s["dist_m"] / 1609.34
        mph = (s["dist_m"]/1609.34) / (s["time_s"]/3600.0) if s["time_s"] > 0 else 0.0
        pace_min_per_mi = (60.0 / mph) if mph > 0 else 0.0
        out.append({
            "bucket": s.get("label"),
            "miles": round(mi, 2),
            "avg_mph": round(mph, 2),
            "pace_min_per_mile": round(pace_min_per_mi, 1) if mph > 0 else None
        })
    return out
