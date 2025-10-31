import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import App from "./App.jsx"
import Landing from "./pages/Landing.jsx"
import Planner from "./pages/Planner.jsx"
import Result from "./pages/Result.jsx"
import "./styles.css"

const rootEl = document.getElementById("root")
const root = createRoot(rootEl)

root.render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        <Route path="/" element={<Landing />} />
        <Route path="/plan" element={<Planner />} />
        <Route path="/result/:fileId" element={<Result />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
