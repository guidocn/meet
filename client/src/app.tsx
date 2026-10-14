import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// 代码分割：每个页面独立打包，访问时才加载，互不影响
// 信息签到页面（首页）优先加载，轻量快速
const PreRegisterPage = lazy(() => import('./pages/PreRegisterPage'));
// 取号页面
const TicketPage = lazy(() => import('./pages/TicketPage'));
// 签到分流台（后台）
const CheckInPage = lazy(() => import('./pages/CheckInPage'));
// 面试官工作台（后台）
const InterviewPage = lazy(() => import('./pages/InterviewPage'));
// 二面面试官工作台
const SecondRoundPage = lazy(() => import('./pages/SecondRoundPage'));
// 候场大屏（独立页面，重型粒子效果，不影响首页加载）
const DisplayPage = lazy(() => import('./pages/DisplayPage'));
// 结果管理（后台）
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
// 控制台（后台）
const ConsolePage = lazy(() => import('./pages/ConsolePage'));
// 登录页
const LoginPage = lazy(() => import('./pages/LoginPage'));
// 404页面
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

// 页面加载时的轻量占位
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-sm text-slate-400">加载中...</span>
    </div>
  </div>
);

const RoutesComponent = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PreRegisterPage />} />
          <Route path="ticket" element={<TicketPage />} />
          <Route path="checkin" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
          <Route path="interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
          <Route path="second-round" element={<SecondRoundPage />} />
          <Route path="results" element={<ProtectedRoute requireAdmin noPermissionMessage="仅管理员可查看结果"><ResultsPage /></ProtectedRoute>} />
          <Route path="console" element={<ProtectedRoute><ConsolePage /></ProtectedRoute>} />
        </Route>
        {/* 候场大屏独立路由，不使用Layout，完全独立加载 */}
        <Route path="display" element={<DisplayPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default RoutesComponent;
