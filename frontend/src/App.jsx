import React, { useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";

export default function App() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";

  // Smooth-scroll to #hash targets across the whole app (any route → landing sections)
  useEffect(() => {
    if (!loc.hash) return;
    const id = loc.hash.slice(1);

    // try now, then again on the next frame (ensures Landing sections are mounted)
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    tryScroll();
    const raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, [loc.pathname, loc.hash]);

  const NavLink = ({ hash, label }) =>
    onHome ? (
      <a className="nav-link" href={hash}>
        {label}
      </a>
    ) : (
      <Link className="nav-link" to={"/" + hash}>
        {label}
      </Link>
    );

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom fixed-top">
        <div className="container">
          <Link className="navbar-brand fw-semibold" to="/">
            Planalityk
          </Link>
          <button
            className="navbar-toggler"
            data-bs-toggle="collapse"
            data-bs-target="#nav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div id="nav" className="collapse navbar-collapse">
            <ul className="navbar-nav ms-auto align-items-lg-center">
              <li className="nav-item">
                <NavLink hash="#home" label="Home" />
              </li>
              <li className="nav-item">
                <NavLink hash="#product" label="Product" />
              </li>
              <li className="nav-item">
                <NavLink hash="#peek" label="Sneek Peak" />
              </li>
              <li className="nav-item">
                <NavLink hash="#contact" label="Contact" />
              </li>
              <li className="nav-item ms-lg-3">
                <Link className="btn btn-sm btn-primary" to="/plan">
                  Plan a Route
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main
        className="container flex-grow-1"
        style={{ paddingTop: "80px", paddingBottom: "40px" }}
      >
        <Outlet />
      </main>

      {/* STICKY FOOTER (mt-auto keeps it at bottom) */}
      <footer className="bg-dark text-white py-5 mt-auto">
        <div className="container">
          <div className="row gy-4">
            {/* Brand + Description */}
            <div className="col-md-4 text-md-start text-center">
              <h5 className="fw-semibold mb-3">Planalityk</h5>
              <p className="small text-secondary">
                The smarter way to design and analyze your cycling routes. Draw,
                compare, and plan every detail with precision.
              </p>
            </div>

            {/* Quick Links (work from any route) */}
            <div className="col-md-4 text-md-start text-center">
              <h6 className="fw-semibold mb-3">Explore</h6>
              <ul className="list-unstyled small">
                <li>
                  <Link
                    className="text-secondary text-decoration-none"
                    to="/#home"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-secondary text-decoration-none"
                    to="/#product"
                  >
                    Product
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-secondary text-decoration-none"
                    to="/#peek"
                  >
                    Sneek Peak
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-secondary text-decoration-none"
                    to="/#contact"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact + Social */}
            <div className="col-md-4 text-md-start text-center">
              <h6 className="fw-semibold mb-3">Connect</h6>
              <ul className="list-unstyled small mb-2">
                <li>
                  <a
                    href="mailto:info@planalityk.com"
                    className="text-secondary text-decoration-none"
                  >
                    info@planalityk.com
                  </a>
                </li>
              </ul>
              <div className="d-flex justify-content-md-start justify-content-center gap-3">
                <a
                  href="https://github.com/jbierowiec"
                  className="text-secondary fs-5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-github"></i>
                </a>
                <a
                  href="https://www.linkedin.com/in/jan-bierowiec/"
                  className="text-secondary fs-5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-linkedin"></i>
                </a>
                <a
                  href="https://jbierowiec.github.io"
                  className="text-secondary fs-5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-globe"></i>
                </a>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-top border-secondary mt-4 pt-3 text-center small text-secondary">
            © {new Date().getFullYear()} Planalityk. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
