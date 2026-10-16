import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getUser, logout } from '../services/api.js';

const links = [['/', 'Command Dashboard'], ['/reservoir', 'Reservoir'], ['/zones', 'Demand Zones'], ['/optimization', 'Allocation Plan'],
  ['/scenarios', 'Scenario Lab'], ['/fairness', 'Fairness Audit'], ['/evaluation', 'Evaluation'], ['/policy', 'Policy & Audit']];

export default function Layout() {
  const u = getUser();
  const [fs, setFs] = React.useState(16);
  React.useEffect(() => { document.documentElement.style.setProperty('--fs', fs + 'px'); }, [fs]);
  const hc = () => document.documentElement.classList.toggle('hc');
  return (<>
    <a className="skip" href="#main">Skip to main content</a>
    <div className="util"><div className="in">
      <span>Decision-support prototype for water-supply operators | Not an official government system</span>
      <span aria-label="Accessibility controls">
        <button onClick={() => setFs(14)} aria-label="Decrease text size">A-</button>
        <button onClick={() => setFs(16)} aria-label="Normal text size">A</button>
        <button onClick={() => setFs(19)} aria-label="Increase text size">A+</button>
        <button onClick={hc} aria-label="Toggle high contrast">High contrast</button>
      </span></div></div>
    <div className="tri" aria-hidden="true" />
    <header className="hdr"><div className="in">
      <div className="mark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8 8 5 11.5 5 15a7 7 0 0014 0c0-3.5-3-7-7-13z"/></svg></div>
      <div><h1><span lang="hi">जलनीती</span>JalNiti AI</h1><p>Risk-aware and fair water distribution | Case study: Chennai, Tamil Nadu (four-lake reservoir system)</p></div>
      <div className="right">{u && <>Signed in as <b>{u.username}</b> ({u.role})<br /><a href="#out" onClick={e => { e.preventDefault(); logout(); }}>Sign out</a></>}</div>
    </div></header>
    <nav className="nav" aria-label="Main navigation"><div className="in">
      {links.map(([to, t]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{t}</NavLink>)}
    </div></nav>
    <main id="main"><Outlet /></main>
    <footer className="foot"><div className="in">
      <span>JalNiti AI v1.0 | Advisory only: every allocation needs human approval.</span>
      <span>Data: illustrative/synthetic unless real files are placed in data/raw (see README).</span>
    </div></footer>
  </>);
}
