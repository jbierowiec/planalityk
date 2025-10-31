import React, { useState } from "react";

export default function ParamsForm({ onRecompute, initial }) {
  const [flat, setFlat] = useState(initial.flat_mph ?? 15);
  const [physics, setPhysics] = useState(!!initial.physics);
  const [rider, setRider] = useState(initial.rider_kg ?? 75);
  const [bike, setBike] = useState(initial.bike_kg ?? 10);
  const [cda, setCda] = useState(initial.cda ?? 0.3);
  const [crr, setCrr] = useState(initial.crr ?? 0.004);
  const [wind, setWind] = useState(initial.wind_mph ?? 0);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onRecompute({
        flat_mph: Number(flat),
        physics,
        rider_kg: Number(rider),
        bike_kg: Number(bike),
        cda: Number(cda),
        crr: Number(crr),
        wind_mph: Number(wind),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="row gy-2">
      <div className="col-6">
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
            id="phys2"
            checked={physics}
            onChange={(e) => setPhysics(e.target.checked)}
          />
          <label htmlFor="phys2" className="form-check-label">
            Use physics model
          </label>
        </div>
      </div>
      <div className="col-6">
        <label className="form-label">Rider (kg)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={rider}
          onChange={(e) => setRider(e.target.value)}
        />
      </div>
      <div className="col-6">
        <label className="form-label">Bike+gear (kg)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={bike}
          onChange={(e) => setBike(e.target.value)}
        />
      </div>
      <div className="col-6">
        <label className="form-label">CdA</label>
        <input
          className="form-control"
          type="number"
          step="0.01"
          value={cda}
          onChange={(e) => setCda(e.target.value)}
        />
      </div>
      <div className="col-6">
        <label className="form-label">Crr</label>
        <input
          className="form-control"
          type="number"
          step="0.001"
          value={crr}
          onChange={(e) => setCrr(e.target.value)}
        />
      </div>
      <div className="col-6">
        <label className="form-label">Wind (mph)</label>
        <input
          className="form-control"
          type="number"
          step="0.1"
          value={wind}
          onChange={(e) => setWind(e.target.value)}
        />
      </div>
      <div className="col-12">
        <button className="btn btn-primary w-100" disabled={busy}>
          {busy ? "Recomputing…" : "Recompute"}
        </button>
      </div>
    </form>
  );
}
