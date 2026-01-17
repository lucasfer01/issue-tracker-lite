import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import Projects from './pages/Projects';
import IssuesList from './pages/IssuesList';
import IssueDetail from './pages/IssueDetail';
import { api } from './api/client';

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    api.onUnauthorized = () => navigate('/login');
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:projectId/issues" element={<IssuesList />} />
      <Route path="/issues/:issueId" element={<IssueDetail />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
