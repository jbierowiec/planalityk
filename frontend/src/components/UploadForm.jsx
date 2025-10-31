import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

export default function UploadForm() {
  const [file, setFile] = useState(null);
  const [flat, setFlat] = useState(15);
  const [physics, setPhysics] = useState(false);
  const [rider, setRider] = useState(75);
  const [bike, setBike] = useState(10);
  const [cda, setCda] = useState(0.3);
  const [crr, setCrr] = useState(0.004);
  const [wind, setWind] = useState(0);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("gpx", file);
      form.append("flat_mph", String(flat));
      form.append("physics", String(physics));
      form.append("rider_kg", String(rider));
      form.append("bike_kg", String(bike));
      form.append("cda", String(cda));
      form.append("crr", String(crr));
      form.append("wind_mph", String(wind));

      const { data } = await axios.post(`${API}/api/analyze`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      nav(`/result/${encodeURIComponent(data.file_id)}`, { state: data });
    } catch (err) {
      alert(err?.response?.data?.error || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="row gy-3">
      <div className="col-12">
        <label className="form-label">GPX File</label>
        <input
          className="form-control"
          type="file"
          accept=".gpx"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
      </div>

      <div className="col-12 col-md-3">
        <label className="form-label">Flat pace (mph)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={flat}
          onChange={(e) => setFlat(e.target.value)}
        />
      </div>

      <div className="col-12">
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id="physics"
            checked={physics}
            onChange={(e) => setPhysics(e.target.checked)}
          />
          <label htmlFor="physics" className="form-check-label">
            Use physics model
          </label>
        </div>
      </div>

      <div className="col-6 col-md-3">
        <label className="form-label">Rider mass (kg)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={rider}
          onChange={(e) => setRider(e.target.value)}
        />
      </div>
      <div className="col-6 col-md-3">
        <label className="form-label">Bike+gear (kg)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={bike}
          onChange={(e) => setBike(e.target.value)}
        />
      </div>
      <div className="col-6 col-md-3">
        <label className="form-label">CdA</label>
        <input
          className="form-control"
          type="number"
          step="0.01"
          value={cda}
          onChange={(e) => setCda(e.target.value)}
        />
      </div>
      <div className="col-6 col-md-3">
        <label className="form-label">Crr</label>
        <input
          className="form-control"
          type="number"
          step="0.001"
          value={crr}
          onChange={(e) => setCrr(e.target.value)}
        />
      </div>
      <div className="col-6 col-md-3">
        <label className="form-label">Wind (mph, headwind +)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={wind}
          onChange={(e) => setWind(e.target.value)}
        />
      </div>

      <div className="col-12">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Analyzing…" : "Analyze Route"}
        </button>
      </div>
    </form>
  );
}
