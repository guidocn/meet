import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ticket, Clock, CheckCircle2, Hourglass, Award, Loader2, AlertCircle, Monitor, Palette, Handshake, Users, Star, Clock as ClockIcon, Lightbulb, HeartHandshake, Save } from 'lucide-react';
import logoImg from '@client/src/assets/logo.webp';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { Candidate } from '@shared/api.interface';

import { candidates } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Image } from '@client/src/components/ui/image';

const DEPARTMENT_OPTIONS = [
  {
    value: '技术部',
    label: '技术部',
    icon: <Monitor className="w-6 h-6" />,
    desc: '修电脑 · 学技术',
    color: 'from-blue-500 to-indigo-600',
    intro:
      '负责电脑维修、系统安装、网络调试、硬件维护等技术工作，是维修队的核心技术力量，定期开展技术培训，提升全队技术水平。',
  },
  {
    value: '宣传部',
    label: '宣传部',
    icon: <Palette className="w-6 h-6" />,
    desc: '做设计 · 搞创意',
    color: 'from-pink-500 to-rose-600',
    intro:
      '负责维修队活动宣传、公众号运营、海报设计、视频剪辑、活动记录等工作，同时也能参与技术培训学到电脑维修技术。',
  },
  {
    value: '外联部',
    label: '外联部',
    icon: <Handshake className="w-6 h-6" />,
    desc: '拉赞助 · 拓人脉',
    color: 'from-emerald-500 to-teal-600',
    intro:
      '负责对外联络、活动策划、物资管理、场地协调、志愿服务对接等工作，同样可以参加全队技术培训，掌握电脑维修技能。',
  },
];

const TEAM_ADVANTAGES = [
  {
    icon: <Star className="w-6 h-6" />,
    title: '入团入党名额',
    desc: '维修队有专属的入团、入党推荐名额，表现优秀的队员有优先发展机会',
    color: 'text-amber-500',
  },
  {
    icon: <Award className="w-6 h-6" />,
    title: '奖学金名额',
    desc: '队内设有奖学金名额，表彰技术过硬、服务积极的优秀队员',
    color: 'text-indigo-500',
  },
  {
    icon: <ClockIcon className="w-6 h-6" />,
    title: '集体活动领学时',
    desc: '每次组织活动都是整个维修队一起参与，统一领取学时，所有部门一视同仁',
    color: 'text-emerald-500',
  },
  {
    icon: <Lightbulb className="w-6 h-6" />,
    title: '全队技术培训',
    desc: '技术培训面向整个维修队，不是只有技术部才能参加，宣传部和外联部的队员同样能学到电脑维修技术',
    color: 'text-sky-500',
  },
  {
    icon: <HeartHandshake className="w-6 h-6" />,
    title: '志愿服务机会',
    desc: '定期开展校园义务维修活动，积累志愿服务时长和实践经验',
    color: 'text-rose-500',
  },
];

const statusLabelMap: Record<string, { label: string; className: string; desc: string }> = {
  waiting: {
    label: '待面试',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    desc: '请到候场区等待叫号',
  },
  interviewing: {
    label: '面试中',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    desc: '请在面试室外耐心等待结果',
  },
  pending_approval: {
    label: '等待审批',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    desc: '结果即将公布，请稍候',
  },
  completed: {
    label: '已完成面试',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    desc: '感谢您的参与，请关注后续录取通知',
  },
  absent: {
    label: '缺考',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    desc: '本次面试已缺席',
  },
};

const formatNumber = (n: number | null): string => {
  if (n == null) return '-';
  return String(n).padStart(3, '0');
};

const TicketPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get('id');

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [firstDepartment, setFirstDepartment] = useState('');
  const [secondDepartment, setSecondDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  const loadCandidate = async () => {
    if (!candidateId) {
      setError('缺少考生信息');
      setLoading(false);
      return;
    }
    try {
      const data = await candidates.getCandidateById(candidateId);
      setCandidate(data);
      setFirstDepartment(data.firstDepartment || '');
      setSecondDepartment(data.secondDepartment || '');
      setHasChanged(false);
    } catch (err: any) {
      logger.error('获取考生信息失败', err);
      setError('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCandidate();
  }, [candidateId]);

  useEffect(() => {
    if (!candidate) return;
    if (candidate.status !== 'waiting') return;
    const timer = setInterval(() => {
      void loadCandidate();
    }, 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id, candidate?.status]);

  const handleSaveDepartments = async () => {
    if (!candidate) return;
    if (!firstDepartment) {
      toast.error('请选择第一意向部门');
      return;
    }
    setSaving(true);
    try {
      const updated = await candidates.updateDepartmentsPublic({
        candidateId: candidate.id,
        firstDepartment,
        secondDepartment: secondDepartment || undefined,
      });
      setCandidate(updated);
      setHasChanged(false);
      toast.success('意向部门已更新');
    } catch (err: any) {
      logger.error('修改意向部门失败', err);
      const msg = err?.response?.data?.message || err?.message || '保存失败，请重试';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectFirst = (value: string) => {
    setFirstDepartment(value);
    setHasChanged(true);
    if (secondDepartment === value) {
      setSecondDepartment('');
    }
  };

  const handleSelectSecond = (value: string) => {
    if (secondDepartment === value) {
      setSecondDepartment('');
    } else {
      setSecondDepartment(value);
    }
    setHasChanged(true);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {error || '未找到考生信息'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              请返回首页重新查询
            </p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <Link to="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = statusLabelMap[candidate.status] || {
    label: candidate.status,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    desc: '',
  };

  const isWaiting = candidate.status === 'waiting';
  const showDepartmentsEdit = isWaiting;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 py-6 md:py-10 bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <div className="w-full max-w-2xl">
        {/* 取号主卡片 */}
        <Card className="border-0 shadow-xl shadow-indigo-100/50 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
           <CardHeader className="items-center pb-2 pt-6 md:pt-8 text-center">
            <Image src={logoImg} alt="党支部义务电脑维修队" className="w-16 h-16 mb-3 rounded-2xl object-cover shadow-lg shadow-indigo-200" />
            <CardTitle className="text-xl md:text-2xl font-bold text-slate-900">
              党支部义务电脑维修队
            </CardTitle>
            <CardDescription className="text-base text-slate-500 mt-1">
              招新面试 · 取号信息
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {/* 序号与状态 */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Ticket className="w-5 h-5 text-indigo-600" />
                <span className="text-sm text-indigo-600 font-medium">
                  全场签到序号
                </span>
              </div>
              <div className="text-6xl md:text-7xl font-black text-indigo-700 mb-3 tracking-tight">
                {formatNumber(candidate.globalNumber)}
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg font-semibold text-slate-900">
                  {candidate.name}
                </span>
                <Badge variant="outline" className={statusInfo.className}>
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {candidate.className || '未填写班级'}
              </p>
            </div>

            {/* 组别信息 */}
            {candidate.groupName && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">面试组别</span>
                  <Badge
                    variant="default"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-sm px-3 py-1"
                  >
                    {candidate.groupName}组 · {candidate.groupNumber ?? '-'}号
                  </Badge>
                </div>
              </div>
            )}

            {/* 状态描述 */}
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
              {candidate.status === 'interviewing' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-amber-600">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">正在面试中</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {statusInfo.desc}
                  </p>
                </div>
              )}
              {candidate.status === 'pending_approval' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-yellow-600">
                    <Hourglass className="w-5 h-5" />
                    <span className="font-semibold">面试已结束，等待审批</span>
                  </div>
                  <p className="text-sm text-slate-500">{statusInfo.desc}</p>
                </div>
              )}
              {candidate.status === 'completed' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold">已完成一轮面试</span>
                  </div>
                  <p className="text-sm text-slate-500">{statusInfo.desc}</p>
                </div>
              )}
              {candidate.status === 'waiting' && (
                <p className="text-sm text-slate-600">{statusInfo.desc}</p>
              )}
              {candidate.status === 'absent' && (
                <p className="text-sm text-rose-500">{statusInfo.desc}</p>
              )}
            </div>

            {/* 意向部门修改区域 - 仅待面试状态显示 */}
            {showDepartmentsEdit && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">
                    您可以修改意向部门
                  </h4>
                  {hasChanged && (
                    <span className="text-xs text-amber-600">已修改，点击保存生效</span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600">第一意向部门</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <button
                        key={dept.value}
                        type="button"
                        onClick={() => handleSelectFirst(dept.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                          firstDepartment === dept.value
                            ? `border-indigo-500 bg-indigo-50`
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dept.color} flex items-center justify-center text-white`}
                        >
                          {dept.icon}
                        </div>
                        <span className="text-xs font-medium text-slate-700">
                          {dept.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600">
                    第二意向部门 <span className="text-slate-400">（选填）</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPARTMENT_OPTIONS.filter(
                      (dept) => dept.value !== firstDepartment,
                    ).map((dept) => (
                      <button
                        key={dept.value}
                        type="button"
                        onClick={() => handleSelectSecond(dept.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                          secondDepartment === dept.value
                            ? `border-purple-500 bg-purple-50`
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dept.color} flex items-center justify-center text-white opacity-80`}
                        >
                          {dept.icon}
                        </div>
                        <span className="text-xs font-medium text-slate-700">
                          {dept.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleSaveDepartments}
                  disabled={!hasChanged || saving}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? '保存中...' : '保存修改'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 部门介绍 - 仅待面试状态 */}
        {isWaiting && (
          <div className="mt-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">
              三大部门介绍
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DEPARTMENT_OPTIONS.map((dept) => (
                <Card
                  key={dept.value}
                  className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${dept.color}`} />
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center text-white shadow-md`}
                      >
                        {dept.icon}
                      </div>
                      <h4 className="text-base font-bold text-slate-900">
                        {dept.label}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {dept.intro}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 维修队介绍 - 仅待面试状态 */}
        {isWaiting && (
          <div className="mt-8 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                为什么加入党支部义务电脑维修队？
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                加入我们，收获的不只是技术
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {TEAM_ADVANTAGES.map((item, index) => (
                <Card
                  key={index}
                  className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="pt-5 space-y-2">
                    <div className={`${item.color}`}>{item.icon}</div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-slate-400">
          此系统由义务电脑维修队开发
        </div>
      </div>
    </div>
  );
};

export default TicketPage;
