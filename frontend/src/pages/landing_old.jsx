// src/pages/Landing.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chart } from "chart.js/auto";

/* ---- demo data (unchanged) ---- */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noiseSeries(n, r, s = 6) {
  const a = Array.from({ length: n }, () => r() * 2 - 1),
    o = new Array(n).fill(0),
    w = Math.max(1, s | 0);
  for (let i = 0; i < n; i++) {
    let S = 0,
      c = 0;
    for (let k = -w; k <= w; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      S += a[j];
      c++;
    }
    o[i] = S / c;
  }
  return o;
}
function makeRoutePreview(totalMiles = 86, seed = 13) {
  const rng = mulberry32(seed),
    pts = 1600;
  const miles = Array.from(
    { length: pts },
    (_, i) => (i * totalMiles) / (pts - 1)
  );
  const base = noiseSeries(pts, rng, 18),
    bump = noiseSeries(pts, rng, 5);
  const elev_ft = base.map((b, i) => 60 * b + 25 * bump[i]);
  const grade = new Array(pts).fill(0);
  for (let i = 1; i < pts; i++) {
    const de = elev_ft[i] - elev_ft[i - 1],
      dx = miles[i] - miles[i - 1];
    grade[i] = dx > 0 ? (de / 5280 / dx) * 100 : 0;
  }
  for (let i = 2; i < pts - 2; i++) {
    grade[i] =
      (grade[i - 2] + grade[i - 1] + grade[i] + grade[i + 1] + grade[i + 2]) /
      5;
  }
  const flat_mph = 18.5,
    CdA = 0.3,
    Crr = 0.004,
    mass = 62,
    rho = 1.225,
    g = 9.80665;
  const speed = grade.map((gp, i) => {
    const theta = Math.atan(gp / 100),
      grav = mass * g * Math.sin(theta),
      roll = mass * g * Crr * Math.cos(theta);
    const v_flat = flat_mph * 0.44704;
    const P = v_flat * (mass * g * Crr + 0.5 * rho * CdA * v_flat * v_flat);
    let v = Math.max(2, v_flat + (gp < 0 ? Math.abs(gp) * 0.3 : -gp * 0.25));
    for (let t = 0; t < 6; t++) {
      const aero = 0.5 * rho * CdA * v * v,
        f = v * (grav + roll + aero) - P,
        df = grav + roll + 1.5 * aero;
      v = Math.max(1, v - 0.6 * (f / Math.max(1e-6, df)));
    }
    const dip = i % 180 === 0 ? -6 : i % 310 === 0 ? -10 : 0,
      whoosh = gp < -4 && i % 95 === 0 ? 7 : 0,
      jitter = (rng() - 0.5) * 0.6;
    return Math.max(5, v * 2.23694 + dip + whoosh + jitter);
  });
  return { miles, speed, grade };
}

export default function Landing() {
  const navigate = useNavigate();
  const peekSpeedRef = useRef(null);
  const peekGradeRef = useRef(null);
  const preview = useMemo(() => makeRoutePreview(85, 1337), []);

  useEffect(() => {
    if (peekSpeedRef.current) {
      new Chart(peekSpeedRef.current, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Speed (mph)",
              data: preview.miles.map((x, i) => ({ x, y: preview.speed[i] })),
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          parsing: false,
          scales: { x: { type: "linear", ticks: { stepSize: 2 } }, y: {} },
        },
      });
    }
    if (peekGradeRef.current) {
      new Chart(peekGradeRef.current, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Grade (%)",
              data: preview.miles.map((x, i) => ({ x, y: preview.grade[i] })),
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          parsing: false,
          scales: { x: { type: "linear", ticks: { stepSize: 2 } }, y: {} },
        },
      });
    }
  }, [preview]);

  const goPlan = () => navigate("/plan");
  const goDraw = () => navigate("/draw");

  return (
    <div>
      {/* HERO */}
      <section id="home">
        <div className="container text-center">
          <h1 className="fw-bold mb-2">
            Draw. Plan. Ride. <span className="text-primary">Smarter.</span>
          </h1>
          <p className="lead text-muted mb-4">
            Sketch your ideal route, save it as a GPX, and get realistic time &
            effort—elevation, wind, rider, and bike included.
          </p>
          <div className="d-flex gap-2 justify-content-center mb-4">
            <button className="btn btn-primary btn-lg" onClick={goDraw}>
              Draw a route
            </button>
            <button
              className="btn btn-outline-secondary btn-lg"
              onClick={goPlan}
            >
              Upload GPX
            </button>
          </div>
          <div
            className="ratio ratio-16x9 rounded-4 shadow-lg border overflow-hidden mx-auto"
            style={{ maxWidth: 980 }}
          >
            <video
              src="/media/hero.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-100 h-100"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {/* TWO FOCUS CARDS: simple & tidy */}
      <section id="product">
        <div className="container">
          <h2 className="text-center mb-4">What you get</h2>
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="h-100 p-4 rounded-4 border shadow-sm">
                <h5 className="mb-3">Design your route</h5>
                <ul className="text-muted mb-3">
                  <li>
                    Click-to-draw editor with undo/redo; snap to roads & bike
                    paths
                  </li>
                  <li>Real-time distance & elevation gain</li>
                  <li>Export to GPX with one click</li>
                </ul>
                <button className="btn btn-primary" onClick={goDraw}>
                  Open route editor
                </button>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="h-100 p-4 rounded-4 border shadow-sm">
                <h5 className="mb-3">Get the details</h5>
                <ul className="text-muted mb-3">
                  <li>Physics-aware ETAs (grade, wind, CdA, Crr, mass)</li>
                  <li>
                    Service overlay: cafés, water, parks, restrooms, bike shops
                  </li>
                  <li>
                    Speed/grade charts, split breakdowns, printable cue sheet
                  </li>
                </ul>
                <button className="btn btn-outline-primary" onClick={goPlan}>
                  Analyze a GPX
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON: compact, checkbox list */}
      <section id="compare">
        <div className="container">
          <h2 className="text-center mb-1">Why we’re better</h2>
          <p className="text-center text-muted mb-4">
            Feature checklist vs Garmin and Strava
          </p>
          <div className="row g-4">
            {[
              {
                title: "Our Planner",
                items: [
                  "Draw route & export GPX",
                  "Physics-aware ETAs (grade, wind, CdA, Crr)",
                  "Service overlays (cafés, water, parks, shops)",
                  "Grade-bucket & split analytics",
                  "Printable cue sheets",
                  "Offline-friendly route page",
                ],
                state: (t) => true,
              },
              {
                title: "Garmin",
                items: [
                  ["Draw route & export GPX", true],
                  ["Physics-aware ETAs (grade, wind, CdA, Crr)", false],
                  ["Service overlays (cafés, water, parks, shops)", "partial"],
                  ["Grade-bucket & split analytics", "partial"],
                  ["Printable cue sheets", true],
                  ["Offline-friendly route page", false],
                ],
              },
              {
                title: "Strava",
                items: [
                  ["Draw route & export GPX", true],
                  ["Physics-aware ETAs (grade, wind, CdA, Crr)", false],
                  ["Service overlays (cafés, water, parks, shops)", "partial"],
                  ["Grade-bucket & split analytics", "partial"],
                  ["Printable cue sheets", false],
                  ["Offline-friendly route page", false],
                ],
              },
            ].map((col, i) => (
              <div className="col-lg-4" key={i}>
                <div className="h-100 p-4 rounded-4 border shadow-sm">
                  <h5 className="mb-3">{col.title}</h5>
                  {col.state
                    ? col.items.map((t) => (
                        <label
                          key={t}
                          className="d-flex align-items-center gap-2 mb-2"
                        >
                          <input type="checkbox" checked readOnly disabled />
                          <span>{t}</span>
                        </label>
                      ))
                    : col.items.map(([t, v]) => (
                        <label
                          key={t}
                          className="d-flex align-items-center gap-2 mb-2"
                        >
                          <input
                            type="checkbox"
                            checked={v === true}
                            readOnly
                            disabled
                          />
                          <span>
                            {t}{" "}
                            {v === "partial" && (
                              <em className="text-muted">(limited)</em>
                            )}
                          </span>
                        </label>
                      ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sneak peek charts (clean block) */}
      <section id="peek">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="p-3 rounded-4 border shadow-sm">
                <h6 className="mb-2">Speed preview</h6>
                <div className="ratio ratio-16x9">
                  <canvas ref={peekSpeedRef} />
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="p-3 rounded-4 border shadow-sm">
                <h6 className="mb-2">Grade preview</h6>
                <div className="ratio ratio-16x9">
                  <canvas ref={peekGradeRef} />
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <Link to="/plan" className="btn btn-primary btn-lg">
              Try your route
            </Link>
          </div>
        </div>
      </section>

      {/* Contact (unchanged basics) */}
      <section id="contact">
        <div className="container">
          <h2 className="text-center mb-4">Contact</h2>
          <form className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                type="text"
                placeholder="Your name"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                type="email"
                placeholder="you@example.com"
              />
            </div>
            <div className="col-12">
              <label className="form-label">Message</label>
              <textarea
                className="form-control"
                rows="5"
                placeholder="How can we help?"
              />
            </div>
            <div className="col-12 text-end">
              <button className="btn btn-primary">Send</button>
            </div>
          </form>
        </div>
      </section>

      {/* Back-to-top button */}
      <button
        className="back-to-top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        title="Back to top"
      >
        ↑
      </button>
    </div>
  );
}
