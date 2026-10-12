import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { LogIn, ArrowLeft } from 'lucide-react';
import logoImg from '@client/src/assets/logo.png';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { interviewerLogin } from '@client/src/api/candidates';
import { Image } from '@client/src/components/ui/image';

const SESSION_KEY = 'admin_session';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const redirect = new URLSearchParams(location.search).get('redirect') || '/checkin';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) {
          navigate(redirect, { replace: true });
        }
      }
    } catch (err) {
      logger.warn('读取 admin_session 失败', err);
    }
  }, [navigate, redirect]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入姓名');
      return;
    }
    setLoading(true);
    try {
      const res = await interviewerLogin({ name: name.trim() });
      if (res.success && res.name) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ name: res.name, groupName: res.groupName }),
        );
        toast.success('登录成功');
        navigate(redirect, { replace: true });
        return;
      }
      toast.error(res.message || '姓名不在名单中');
    } catch (err) {
      logger.error('登录请求失败', err);
      toast.error('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
     <div className="min-h-[80vh] flex items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src={logoImg} alt="党支部义务电脑维修队" className="w-14 h-14 rounded-xl object-cover shadow-md" />
          </div>
          <CardTitle className="text-xl md:text-2xl font-bold text-slate-900">
            党支部义务电脑维修队
          </CardTitle>
          <CardDescription className="mt-1">管理控制台登录</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                type="text"
                placeholder="请输入姓名"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
             <Button
               type="submit"
               className="w-full gap-2 h-11 text-base"
               disabled={loading}
             >
              <LogIn className="w-4 h-4" />
              {loading ? '登录中...' : '登录'}
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
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
