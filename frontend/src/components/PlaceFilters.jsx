import React from "react";

const ALL = ["bike_shop", "cafe", "restaurant", "park", "water", "other"];

export default function PlaceFilters({ selected, onChange }) {
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const allOn = selected.size === ALL.length;
  const noneOn = selected.size === 0;

  return (
    <div className="d-flex flex-wrap gap-2">
      {ALL.map((k) => (
        <div className="form-check form-check-inline" key={k}>
          <input
            className="form-check-input"
            type="checkbox"
            id={`pf-${k}`}
            checked={selected.has(k)}
            onChange={() => toggle(k)}
          />
          <label className="form-check-label" htmlFor={`pf-${k}`}>
            {
              {
                bike_shop: "Bike shops",
                cafe: "Cafés",
                restaurant: "Restaurants",
                park: "Parks",
                water: "Water",
                other: "Other",
              }[k]
            }
          </label>
        </div>
      ))}
      <div className="ms-auto small text-muted">
        {noneOn
          ? "No categories selected"
          : allOn
          ? "All categories"
          : `${selected.size} selected`}
      </div>
    </div>
  );
}
