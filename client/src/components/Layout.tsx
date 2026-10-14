import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import logoImg from '@client/src/assets/logo.webp';

import { Button } from '@client/src/components/ui/button';
import { readSession, type AdminSession } from './ProtectedRoute';
import { Image } from '@client/src/components/ui/image';

// 信息签到页面独立，不显示候场大屏导航（候场大屏是独立页面，通过/display或二维码访问）
const publicNavItems = [
  { path: '/', label: '信息签到', end: true },
];

const adminNavItems = [
  { path: '/checkin', label: '签到分流台' },
  { path: '/interview', label: '面试官工作台' },
  { path: '/results', label: '结果管理' },
];

// 普通角色（流动人员、面试官）：只显示签到分流台和面试官工作台
const normalNavItems = [
  { path: '/checkin', label: '签到分流台' },
  { path: '/interview', label: '面试官工作台' },
];

const ADMIN_PATHS = ['/checkin', '/interview', '/results', '/console'];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);

  const isAdminPath = ADMIN_PATHS.some((p) => location.pathname.startsWith(p));
  const isAdmin = isAdminPath && session;

  useEffect(() => {
    setSession(readSession());
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('admin_session');
    setSession(null);
    navigate('/login', { replace: true });
  };

  // 管理员显示三个控制台，其他角色显示两个（签到分流台+面试官工作台）
  const navItems = !isAdmin 
    ? publicNavItems 
    : session.role === 'admin' 
      ? adminNavItems 
      : normalNavItems;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to={isAdmin ? '/checkin' : '/'} className="flex items-center gap-2">
            <Image src={logoImg} alt="党支部义务电脑维修队" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm md:text-base font-bold text-slate-900">
                党支部义务电脑维修队
              </span>
              {isAdmin && (
                <span className="text-[10px] text-slate-400">管理后台</span>
              )}
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={(item as { end?: boolean }).end ?? false}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                  <User className="w-4 h-4" />
                  <span>{session.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-rose-600 gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">退出登录</span>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <nav className="md:hidden flex items-center justify-around border-t border-slate-100 h-12 bg-white">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={(item as { end?: boolean }).end ?? false}
              className={({ isActive }) =>
                `flex-1 h-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-500'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
