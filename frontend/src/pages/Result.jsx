// src/pages/Result.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import axios from "axios";
import { Chart } from "chart.js/auto";
import * as turf from "@turf/turf";
import MapView from "../components/MapView.jsx";
import ParamsForm from "../components/ParamsForm.jsx";
import PlaceFilters from "../components/PlaceFilters.jsx";

const API = import.meta.env.VITE_API_URL;

export default function Result() {
  const { fileId } = useParams();
  const loc = useLocation();

  const [data, setData] = useState(loc.state || null);
  const [analysis, setAnalysis] = useState(loc.state?.analysis || null);

  const [chart1, setChart1] = useState(null);
  const [chart2, setChart2] = useState(null);

  const [places, setPlaces] = useState(null);
  const [busyPlaces, setBusyPlaces] = useState(false);
  const [filters, setFilters] = useState(
    new Set(["bike_shop", "cafe", "restaurant", "park", "water", "other"])
  );

  // ---- VIDEO STATES ----
  const [videoURL, setVideoURL] = useState(null);
  const [busyVideo, setBusyVideo] = useState(false);
  // -----------------------

  useEffect(() => {
    if (data) return;
    axios
      .get(`${API}/api/result`, { params: { file_id: fileId } })
      .then(({ data }) => {
        setData(data);
        setAnalysis(data.analysis);
      })
      .catch((err) => alert(err?.response?.data?.error || "Load failed"));
  }, [data, fileId]);

  function lineFromRoute(geojson) {
    if (!geojson) return null;
    const feat =
      geojson.type === "FeatureCollection" ? geojson.features?.[0] : geojson;
    if (!feat?.geometry) return null;
    const g = feat.geometry;
    if (g.type === "LineString") return turf.lineString(g.coordinates);
    if (g.type === "MultiLineString")
      return turf.lineString(g.coordinates.flat());
    return null;
  }

  function getLonLat(p) {
    if (p?.lon != null && p?.lat != null) return [Number(p.lon), Number(p.lat)];
    if (p?.lng != null && p?.lat != null) return [Number(p.lng), Number(p.lat)];
    if (p?.location?.lon != null && p?.location?.lat != null)
      return [Number(p.location.lon), Number(p.location.lat)];
    if (p?.location?.lng != null && p?.location?.lat != null)
      return [Number(p.location.lng), Number(p.location.lat)];
    return null;
  }

  function computeMetricsForPlace(line, totalMiles, place) {
    const ll = getLonLat(place);
    if (!line || !ll) return { off_mi: null, to_finish_mi: null };
    const pt = turf.point(ll);

    const snapped = turf.nearestPointOnLine(line, pt, { units: "kilometers" });
    const offMi = turf.distance(pt, snapped, { units: "miles" });
    const alongMi = (snapped.properties?.location ?? 0) * 0.621371;
    const toFinish =
      totalMiles != null ? Math.max(0, totalMiles - alongMi) : null;

    return {
      off_mi: +offMi.toFixed(2),
      to_finish_mi: toFinish != null ? +toFinish.toFixed(2) : null,
    };
  }

  // ---- CHART DRAWING ----
  useEffect(() => {
    if (!analysis) return;

    const dist = analysis.chart.dist_mi;
    const speed = analysis.chart.speed_mph;
    const grade = analysis.chart.grade_pct;

    const speedPts = dist.map((x, i) => ({ x, y: speed[i] }));
    const gradePts = dist.map((x, i) => ({ x, y: grade[i] }));

    const ctx1 = document.getElementById("speedChart");
    const ctx2 = document.getElementById("gradeChart");
    chart1?.destroy();
    chart2?.destroy();

    const commonOptions = {
      responsive: true,
      plugins: { legend: { display: true } },
      parsing: false,
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Distance (mi)" },
          beginAtZero: true,
          ticks: { stepSize: 2 },
        },
      },
    };

    setChart1(
      new Chart(ctx1, {
        type: "line",
        data: { datasets: [{ label: "Speed (mph)", data: speedPts }] },
        options: {
          ...commonOptions,
          scales: {
            ...commonOptions.scales,
            y: { title: { display: true, text: "mph" } },
          },
        },
      })
    );

    setChart2(
      new Chart(ctx2, {
        type: "line",
        data: { datasets: [{ label: "Grade (%)", data: gradePts }] },
        options: {
          ...commonOptions,
          scales: {
            ...commonOptions.scales,
            y: { title: { display: true, text: "%" } },
          },
        },
      })
    );
  }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadReport = async () => {
    try {
      if (!chart1 || !chart2) {
        alert("Charts are not ready yet.");
        return;
      }
      const speed_png = chart1.toBase64Image();
      const grade_png = chart2.toBase64Image();

      await axios.post(`${API}/api/charts`, {
        file_id: fileId,
        speed_png,
        grade_png,
      });

      window.location.href = `${API}/api/report?file_id=${encodeURIComponent(
        fileId
      )}`;
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || "Report failed");
    }
  };

  const onRecompute = async (params) => {
    const { data: resp } = await axios.post(`${API}/api/recompute`, {
      file_id: fileId,
      params,
    });
    setAnalysis(resp.analysis);
  };

  const fetchPlaces = async () => {
    setBusyPlaces(true);
    try {
      const { data: resp } = await axios.get(`${API}/api/places`, {
        params: { file_id: fileId },
      });
      setPlaces(resp);
    } catch (e) {
      alert(e?.response?.data?.error || "Places lookup failed");
    } finally {
      setBusyPlaces(false);
    }
  };

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename; // saves to the browser’s default download folder
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const genVideo = async () => {
    setBusyVideo(true);
    try {
      // 1) render the video
      const { data: resp } = await axios.post(`${API}/api/video`, {
        geojson: data?.geojson,
        dist_mi: analysis?.chart?.dist_mi,
        speed_mph: analysis?.chart?.speed_mph,
        elev_ft: analysis?.chart?.elev_ft,
        route_name: data?.filename || (data?.route_hash ?? fileId),
        map_tiles: true,
        padding: 0.05,
        fps: 30,
        width: 1280,
        height: 720,
        max_seconds: 60,
      });

      const filePath = resp.url; // "/static/videos/abcd.mp4"
      const filename =
        (data?.filename || data?.route_hash || fileId)
          .toString()
          .replace(/\s+/g, "_") + ".mp4";

      // 2) fetch as Blob (fixes “Network Error”: needs CORS enabled – done above)
      const blobResp = await axios.get(`${API}${filePath}`, {
        responseType: "blob",
      });

      // 3) trigger download (no navigation)
      downloadBlob(blobResp.data, filename);

      // optional inline preview
      setVideoURL(filePath);
    } catch (e) {
      alert(
        e?.response?.data?.error || e?.message || "Video generation failed"
      );
    } finally {
      setBusyVideo(false);
    }
  };

  const filteredPlaces = useMemo(() => {
    if (!places?.places) return [];
    return places.places.filter((p) => filters.has(p.category || "other"));
  }, [places, filters]);

  if (!data || !analysis) return <div>Loading…</div>;

  return (
    <div className="row g-3">
      <div className="col-12">
        <a href="/" className="small">
          &larr; New analysis
        </a>
      </div>

      <div className="col-lg-8">
        <div className="bg-white border rounded p-2">
          <MapView geojson={data.geojson} places={filteredPlaces} />
        </div>

        <div className="bg-white border rounded p-3 mt-3">
          <h5>Speed &amp; Grade</h5>
          <canvas id="speedChart" className="chart"></canvas>
          <canvas id="gradeChart" className="chart mt-3"></canvas>
        </div>

        {/* ==== VIDEO PLAYER SECTION ==== */}
        {videoURL && (
          <div className="bg-white border rounded p-3 mt-3">
            <h5>Generated Route Video</h5>
            <video
              src={`${API}${videoURL}`}
              controls
              className="w-100"
              style={{ maxHeight: 480 }}
            />
            <div className="mt-2">
              <a
                href={`${API}${videoURL}`}
                download
                className="btn btn-sm btn-outline-secondary"
              >
                Download MP4
              </a>
            </div>
          </div>
        )}
        {/* ============================== */}
      </div>

      <div className="col-lg-4">
        <div className="bg-white border rounded p-3">
          <div>
            <strong>Distance:</strong> {analysis.distance_mi} mi (
            {analysis.distance_km} km)
          </div>
          <div>
            <strong>Elevation gain:</strong> {analysis.elev_gain_ft} ft
          </div>
          <div>
            <strong>Predicted time:</strong> {analysis.pred_time_h} h
          </div>
          <div>
            <strong>Predicted avg:</strong> {analysis.pred_avg_mph} mph
          </div>
          <div className="mt-2">
            <span className="badge text-bg-secondary">
              {analysis.physics_used ? "Physics model" : "Heuristic model"}
            </span>
          </div>

          <div className="mt-3 d-flex flex-wrap gap-2">
            <a
              className="btn btn-sm btn-outline-secondary"
              href={`${API}/api/download?file_id=${encodeURIComponent(fileId)}`}
            >
              Download GPX
            </a>

            {/*}
            <button
              className="btn btn-sm btn-outline-success"
              onClick={fetchPlaces}
              disabled={busyPlaces}
            >
              {busyPlaces ? "Searching…" : "Find Corridor Services"}
            </button>
            */}
            

            {/* NEW BUTTON FOR VIDEO */}
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={genVideo}
              disabled={busyVideo}
            >
              {busyVideo ? "Generating…" : "Generate Route Video"}
            </button>

            <button
              className="btn btn-sm btn-outline-dark"
              onClick={downloadReport}
            >
              Download Report (DOCX)
            </button>
          </div>
        </div>

        <div className="bg-white border rounded p-3 mt-3">
          <h5>Parameters</h5>
          <ParamsForm
            onRecompute={onRecompute}
            initial={{
              flat_mph: analysis.flat_target_mph,
              physics: analysis.physics_used,
              ...analysis.params_used,
            }}
          />
        </div>
      </div>

      <div className="col-12 col-lg-8">
        <div className="bg-white border rounded p-3">
          <h5>Splits by Grade Bucket</h5>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Grade Bucket</th>
                  <th>Miles</th>
                  <th>Avg mph</th>
                  <th>Pace (min/mi)</th>
                </tr>
              </thead>
              <tbody>
                {analysis.splits.map((r, i) => (
                  <tr key={i}>
                    <td>{r.bucket}</td>
                    <td>{r.miles}</td>
                    <td>{r.avg_mph}</td>
                    <td>{r.pace_min_per_mile ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
