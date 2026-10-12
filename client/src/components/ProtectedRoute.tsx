import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
const logger = { warn: console.warn, error: console.error, info: console.log, debug: console.log };

import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';

export const ADMIN_NAME = 'guido';
export const SESSION_KEY = 'admin_session';

export interface AdminSession {
  name: string;
  groupName: string;
}

export function readSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: AdminSession = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string') return parsed;
    return null;
  } catch (err) {
    logger.warn('读取 admin_session 失败', err);
    return null;
  }
}

export function isAdmin(name: string | null | undefined): boolean {
  return name === ADMIN_NAME;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  noPermissionMessage?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  noPermissionMessage = '仅管理员可操作',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    setChecked(true);
    if (!s) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`, { replace: true });
    }
  }, [navigate, location]);

  const handleLogout = (): void => {
    localStorage.removeItem(SESSION_KEY);
    navigate('/login', { replace: true });
  };

  if (!checked) return null;
  if (!session) return null;

  if (requireAdmin && session.name !== ADMIN_NAME) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader className="text-center items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl">无权限访问</CardTitle>
            <CardDescription>{noPermissionMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-slate-500 text-center">
              当前登录用户：{session.name}
            </p>
            <Button onClick={handleLogout} variant="destructive" className="w-full">
              退出登录
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full gap-2"
            >
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
                返回首页
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
