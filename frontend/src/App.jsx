import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { getToken } from './services/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reservoir from './pages/Reservoir.jsx';
import DemandZones from './pages/DemandZones.jsx';
import OptimizationRun from './pages/OptimizationRun.jsx';
import ScenarioLab from './pages/ScenarioLab.jsx';
import FairnessAudit from './pages/FairnessAudit.jsx';
import Evaluation from './pages/Evaluation.jsx';
import PolicySettings from './pages/PolicySettings.jsx';

const Guard = ({ children }) => (getToken() ? children : <Navigate to="/login" replace />);
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="reservoir" element={<Reservoir />} />
        <Route path="zones" element={<DemandZones />} />
        <Route path="optimization" element={<OptimizationRun />} />
        <Route path="scenarios" element={<ScenarioLab />} />
        <Route path="fairness" element={<FairnessAudit />} />
        <Route path="evaluation" element={<Evaluation />} />
        <Route path="policy" element={<PolicySettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
