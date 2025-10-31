import React from "react";
import UploadForm from "../components/UploadForm.jsx";

export default function Home() {
  return (
    <div className="row g-4">
      <div className="col-12 col-lg-8">
        <h1 className="mb-2">Plan your route like a pro</h1>
        <p className="text-muted">
          Upload a GPX route. We’ll predict time & speed by elevation, simulate
          profiles, and find restaurants, water sources, and bike shops within a
          mile of your route.
        </p>
        <UploadForm />
      </div>
      <div className="col-12 col-lg-4">
        <div className="p-3 bg-white border rounded">
          <h5>What you’ll get</h5>
          <ul className="mb-0">
            <li>Predicted total time & average speed</li>
            <li>Speed & grade charts</li>
            <li>Physics model toggle (CdA/Crr/Mass/Wind)</li>
            <li>Corridor POIs (cached by route hash)</li>
            <li>Grade-bucket splits & paces</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
