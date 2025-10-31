import React from "react";

export default function SplitTable({ rows }) {
  return (
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
          {rows.map((r, i) => (
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
  );
}
