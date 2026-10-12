import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, ClipboardList, BarChart3, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';
const logger = { warn: console.warn, error: console.error, info: console.log, debug: console.log };

import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';

const SESSION_KEY = 'admin_session';
const ADMIN_NAME = 'guido';
const FLOATING_STAFF: string[] = [
  '梁文燕',
  '李旭涵',
  '郑发',
  '高梓恒',
  '温嘉果',
  '冯梓珊',
  '何承熹',
  '吴梓鑫',
  '梁浩辉',
];

type UserRole = 'admin' | 'floating' | 'interviewer';

function getUserRole(name: string): UserRole {
  if (name === ADMIN_NAME) return 'admin';
  if (FLOATING_STAFF.includes(name)) return 'floating';
  return 'interviewer';
}

interface ConsoleEntry {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

const ConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('interviewer');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
          if (parsed?.name) {
           setAdminName(parsed.name);
           setRole(getUserRole(parsed.name));
         }
      }
    } catch (err) {
      logger.warn('读取 admin_session 失败', err);
    }
  }, []);

  const handleLogout = (): void => {
    localStorage.removeItem(SESSION_KEY);
    navigate('/login', { replace: true });
  };

  const entries: ConsoleEntry[] = [
    {
      title: '签到分流台',
      description: '新生签到、分组分配与队列管理',
      path: '/checkin',
      icon: <Users className="w-6 h-6" />,
    },
    {
      title: '面试官工作台',
      description: '叫号、面试打分与状态流转',
      path: '/interview',
      icon: <ClipboardList className="w-6 h-6" />,
    },
  ];

  if (role === 'admin') {
    entries.push({
      title: '结果管理',
      description: '面试结果筛选、统计与导出',
      path: '/results',
      icon: <BarChart3 className="w-6 h-6" />,
    });
  }

  return (
     <div className="p-4 md:p-6">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
         <h1 className="text-xl md:text-2xl font-bold text-slate-900">管理控制台</h1>
         <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              当前用户：<span className="font-medium text-slate-700">{adminName}</span>
            </span>
            {role === 'admin' && (
             <Badge variant="secondary" className="gap-1 bg-indigo-100 text-indigo-700 border-indigo-200">
               <ShieldCheck className="w-3 h-3" />
               管理员
             </Badge>
           )}
           {role === 'floating' && (
             <Badge variant="secondary" className="gap-1 bg-sky-100 text-sky-700 border-sky-200">
               <ArrowRight className="w-3 h-3" />
               流动人员
             </Badge>
           )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>
        </div>
      </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {entries.map((entry: ConsoleEntry) => (
          <Card key={entry.path} className="flex flex-col hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                {entry.icon}
              </div>
              <CardTitle>{entry.title}</CardTitle>
              <CardDescription>{entry.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Button asChild className="w-full gap-2">
                <Link to={entry.path}>
                  进入
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ConsolePage;
