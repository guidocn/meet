import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import PreRegisterPage from './pages/PreRegisterPage';
import TicketPage from './pages/TicketPage';
import CheckInPage from './pages/CheckInPage';
import InterviewPage from './pages/InterviewPage';
import DisplayPage from './pages/DisplayPage';
import ResultsPage from './pages/ResultsPage';
import ConsolePage from './pages/ConsolePage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PreRegisterPage />} />
        <Route path="ticket" element={<TicketPage />} />
        <Route path="checkin" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
        <Route path="interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
        <Route path="results" element={<ProtectedRoute requireAdmin noPermissionMessage="仅管理员可查看结果"><ResultsPage /></ProtectedRoute>} />
        <Route path="console" element={<ProtectedRoute><ConsolePage /></ProtectedRoute>} />
      </Route>
      <Route path="display" element={<DisplayPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
