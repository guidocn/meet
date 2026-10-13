import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  GraduationCap,
  CheckCircle2,
  Search,
  Phone,
  User,
  AlertCircle,
  ArrowLeft,
  Ticket,
  Monitor,
  Palette,
  Handshake,
} from 'lucide-react';
import logoImg from '@client/src/assets/logo.webp';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { Candidate } from '@shared/api.interface';

import { candidates } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Image } from '@client/src/components/ui/image';

const DEPARTMENT_OPTIONS = [
  {
    value: '技术部',
    label: '技术部',
    icon: <Monitor className="w-6 h-6" />,
    desc: '修电脑 · 学技术',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    value: '宣传部',
    label: '宣传部',
    icon: <Palette className="w-6 h-6" />,
    desc: '做设计 · 搞创意',
    color: 'from-pink-500 to-rose-600',
  },
  {
    value: '外联部',
    label: '外联部',
    icon: <Handshake className="w-6 h-6" />,
    desc: '拉赞助 · 拓人脉',
    color: 'from-emerald-500 to-teal-600',
  },
];

type PageState = 'query' | 'found' | 'notFound' | 'checkInSuccess';

interface FormData {
  className: string;
  name: string;
  gender: string;
  firstDepartment: string;
  secondDepartment: string;
  phone: string;
  acceptAdjust: string;
}

interface FormErrors {
  className?: string;
  name?: string;
  gender?: string;
  firstDepartment?: string;
  phone?: string;
  acceptAdjust?: string;
}

const emptyForm = (name = ''): FormData => ({
  className: '',
  name,
  gender: '',
  firstDepartment: '',
  secondDepartment: '',
  phone: '',
  acceptAdjust: '',
});

const statusLabelMap: Record<string, { text: string; color: string }> = {
  pre_registered: { text: '预报名', color: 'bg-slate-100 text-slate-600' },
  waiting: { text: '已签到', color: 'bg-emerald-100 text-emerald-700' },
  interviewing: { text: '面试中', color: 'bg-amber-100 text-amber-700' },
  completed: { text: '已完成', color: 'bg-blue-100 text-blue-700' },
  absent: { text: '缺考', color: 'bg-rose-100 text-rose-700' },
};

const PreRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [queryName, setQueryName] = useState('');
  const [queryError, setQueryError] = useState('');
  const [searching, setSearching] = useState(false);

  const [pageState, setPageState] = useState<PageState>('query');
  const [matchedCandidates, setMatchedCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [checkInResult, setCheckInResult] = useState<Candidate | null>(null);
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const handleSearch = async () => {
    const name = queryName.trim();
    if (!name) {
      setQueryError('请输入姓名');
      return;
    }
    setQueryError('');
    setSearching(true);

    try {
      const results = await candidates.searchByNamePublic({ name });
      if (results.length > 0) {
        setMatchedCandidates(results);
        if (results.length === 1) {
          setSelectedCandidate(results[0]);
        }
        setPageState('found');
      } else {
        setForm(emptyForm(name));
        setPageState('notFound');
      }
    } catch (error: any) {
      logger.error('姓名查询失败', error);
      const msg = error?.response?.data?.message || error?.message || '查询失败，请重试';
      toast.error(msg);
    } finally {
      setSearching(false);
    }
  };

  const handleBackToQuery = () => {
    setPageState('query');
    setQueryName('');
    setQueryError('');
    setMatchedCandidates([]);
    setSelectedCandidate(null);
    setForm(emptyForm());
    setErrors({});
    setCheckInResult(null);
    setIsNewRegistration(false);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.className.trim()) {
      newErrors.className = '请输入班级';
    }
    if (!form.name.trim()) {
      newErrors.name = '请输入姓名';
    }
    if (!form.gender) {
      newErrors.gender = '请选择性别';
    }
    if (!form.firstDepartment) {
      newErrors.firstDepartment = '请选择第一意向部门';
    }
    if (!form.phone.trim()) {
      newErrors.phone = '请输入手机号';
    } else if (!/^1\d{10}$/.test(form.phone.trim())) {
      newErrors.phone = '请输入正确的11位手机号';
    }
    if (!form.acceptAdjust) {
      newErrors.acceptAdjust = '请选择是否服从调剂';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const setField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in errors && (errors as Record<string, string | undefined>)[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleRegisterAndCheckIn = async (force = false) => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const created = await candidates.preRegisterPublic({
        name: form.name.trim(),
        gender: form.gender,
        className: form.className.trim(),
        phone: form.phone.trim(),
        firstDepartment: form.firstDepartment,
        secondDepartment: form.secondDepartment || form.firstDepartment,
        acceptAdjust: form.acceptAdjust,
        force,
      });

      const result = await candidates.checkInPublic({ candidateId: created.id });
      setCheckInResult(result);
      setIsNewRegistration(true);
      setDuplicateDialogOpen(false);
      toast.success('签到成功');
      navigate(`/ticket?id=${result.id}`);
    } catch (error: any) {
      logger.error('报名签到失败', error);
      if (error?.response?.status === 409 || error?.statusCode === 409) {
        setDuplicateDialogOpen(true);
      } else {
        const msg =
          error?.response?.data?.message || error?.message || '提交失败，请重试';
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDuplicate = () => {
    void handleRegisterAndCheckIn(true);
  };

  const handleDirectCheckIn = async (candidate: Candidate) => {
    if (candidate.status !== 'pre_registered') {
      navigate(`/ticket?id=${candidate.id}`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await candidates.checkInPublic({ candidateId: candidate.id });
      setCheckInResult(result);
      setIsNewRegistration(false);
      navigate(`/ticket?id=${result.id}`);
      toast.success('签到成功');
    } catch (error: any) {
      logger.error('签到失败', error);
      const msg =
        error?.response?.data?.message || error?.message || '签到失败，请重试';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAgain = () => {
    handleBackToQuery();
  };

  const renderDeptBadge = (dept: string | null) => {
    if (!dept) return <Badge variant="outline">无</Badge>;
    const found = DEPARTMENT_OPTIONS.find((d) => d.value === dept);
    if (!found) return <Badge variant="outline">{dept}</Badge>;
    return (
      <Badge
        variant="secondary"
        className={`bg-gradient-to-r ${found.color} text-white border-0`}
      >
        {found.label}
      </Badge>
    );
  };

  const renderStatusBadge = (status: string) => {
    const info = statusLabelMap[status] || { text: status, color: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
        {info.text}
      </span>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-6 md:py-10 bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <div className="w-full max-w-xl">
        <Card className="border-0 shadow-xl shadow-indigo-100/50 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
            <CardHeader className="items-center pb-2 pt-6 md:pt-8 text-center">
            <Image src={logoImg} alt="党支部义务电脑维修队" className="w-16 h-16 mb-3 rounded-2xl object-cover shadow-lg shadow-indigo-200" />
            <CardTitle className="text-xl md:text-2xl font-bold text-slate-900">
              党支部义务电脑维修队
            </CardTitle>
            <CardDescription className="text-base text-slate-500 mt-1">
              {pageState === 'query' && '招新面试签到'}
              {pageState === 'found' && '已查到报名信息'}
              {pageState === 'notFound' && '填写信息完成签到'}
              {pageState === 'checkInSuccess' && '签到成功'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {pageState === 'query' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 text-center">
                  请输入姓名，已报名可直接签到，未报名请填写信息
                </p>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={queryName}
                    onChange={(e) => {
                      setQueryName(e.target.value);
                      if (queryError) setQueryError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSearch();
                    }}
                    placeholder="请输入姓名"
                    className={`pl-9 h-14 text-base ${queryError ? 'border-rose-400' : ''}`}
                  />
                </div>
                {queryError && (
                  <p className="text-xs text-rose-500">{queryError}</p>
                )}
                <Button
                  onClick={() => handleSearch()}
                  disabled={searching}
                  className="w-full h-12 text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200"
                >
                  <Search className="w-5 h-5 mr-2" />
                  {searching ? '查询中...' : '查询 / 签到'}
                </Button>
              </div>
            )}

            {pageState === 'found' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm text-emerald-700">
                    已查到 {matchedCandidates.length} 条报名信息
                  </p>
                </div>

                <div className="space-y-3">
                  {matchedCandidates.map((c) => (
                    <Card
                      key={c.id}
                      className={`border-2 transition-all cursor-pointer hover:shadow-md ${
                        selectedCandidate?.id === c.id
                          ? 'border-indigo-500 bg-indigo-50/30'
                          : 'border-slate-200'
                      }`}
                      onClick={() => setSelectedCandidate(c)}
                      role="radio"
                      aria-checked={selectedCandidate?.id === c.id}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            {c.name}
                          </span>
                          {renderStatusBadge(c.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-slate-500">
                            班级：
                            <span className="text-slate-700">{c.className || '-'}</span>
                          </div>
                          <div className="text-slate-500">
                            性别：
                            <span className="text-slate-700">{c.gender || '-'}</span>
                          </div>
                          <div className="text-slate-500 col-span-2">
                            手机号：
                            <span className="text-slate-700">{c.phone || '-'}</span>
                          </div>
                          <div className="text-slate-500 col-span-2 flex items-center gap-2">
                            意向：
                            {renderDeptBadge(c.firstDepartment)}
                            {c.secondDepartment && c.secondDepartment !== c.firstDepartment && (
                              <>
                                <span className="text-slate-400">→</span>
                                {renderDeptBadge(c.secondDepartment)}
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedCandidate && (
                  <Button
                    onClick={() => handleDirectCheckIn(selectedCandidate)}
                    disabled={submitting}
                    className={`w-full h-12 text-base shadow-lg ${
                      selectedCandidate.status === 'pre_registered'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-200'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-200'
                    }`}
                  >
                    {submitting
                      ? '签到中...'
                      : selectedCandidate.status === 'pre_registered'
                        ? '确认签到'
                        : '查看取号信息'}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleBackToQuery}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回重新查询
                </Button>
              </div>
            )}

            {pageState === 'notFound' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    未查到报名信息，请填写以下信息完成签到
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        班级 <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={form.className}
                          onChange={(e) => setField('className', e.target.value)}
                          placeholder="如26网络1班"
                          className={`pl-9 h-11 ${errors.className ? 'border-rose-400' : ''}`}
                        />
                      </div>
                      {errors.className && (
                        <p className="text-xs text-rose-500">{errors.className}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        姓名 <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={form.name}
                          onChange={(e) => setField('name', e.target.value)}
                          placeholder="请输入姓名"
                          className={`pl-9 h-11 ${errors.name ? 'border-rose-400' : ''}`}
                        />
                      </div>
                      {errors.name && (
                        <p className="text-xs text-rose-500">{errors.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      性别 <span className="text-rose-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {['男', '女'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setField('gender', g)}
                          className={`h-12 rounded-lg border-2 text-base font-medium transition-all ${
                            form.gender === g
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {errors.gender && (
                      <p className="text-xs text-rose-500">{errors.gender}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      第一意向部门 <span className="text-rose-500">*</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                      {DEPARTMENT_OPTIONS.map((dept) => {
                        const selected = form.firstDepartment === dept.value;
                        return (
                          <button
                            key={dept.value}
                            type="button"
                            onClick={() => setField('firstDepartment', dept.value)}
                            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all ${
                              selected
                                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                            aria-pressed={selected}
                          >
                            <div
                              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dept.color} flex items-center justify-center text-white`}
                            >
                              {dept.icon}
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                selected ? 'text-indigo-700' : 'text-slate-700'
                              }`}
                            >
                              {dept.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.firstDepartment && (
                      <p className="text-xs text-rose-500">
                        {errors.firstDepartment}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      第二意向部门{' '}
                      <span className="text-slate-400 font-normal">（选填）</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                      {DEPARTMENT_OPTIONS.map((dept) => {
                        const selected = form.secondDepartment === dept.value;
                        return (
                          <button
                            key={dept.value}
                            type="button"
                            onClick={() =>
                              setField(
                                'secondDepartment',
                                selected ? '' : dept.value,
                              )
                            }
                            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all ${
                              selected
                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                            aria-pressed={selected}
                          >
                            <div
                              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${dept.color} flex items-center justify-center text-white`}
                            >
                              {dept.icon}
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                selected ? 'text-emerald-700' : 'text-slate-600'
                              }`}
                            >
                              {dept.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {form.secondDepartment &&
                      form.firstDepartment === form.secondDepartment && (
                        <p className="text-xs text-amber-600">
                          提示：第二意向建议与第一意向不同
                        </p>
                      )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      手机号 <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={form.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        placeholder="请输入手机号"
                        inputMode="tel"
                        maxLength={11}
                        className={`pl-9 h-11 ${errors.phone ? 'border-rose-400' : ''}`}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-rose-500">{errors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      是否服从调剂 <span className="text-rose-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {['是', '否'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setField('acceptAdjust', v)}
                          className={`h-12 rounded-lg border-2 text-base font-medium transition-all ${
                            form.acceptAdjust === v
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    {errors.acceptAdjust && (
                      <p className="text-xs text-rose-500">
                        {errors.acceptAdjust}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={() => handleRegisterAndCheckIn(false)}
                    disabled={submitting}
                    className="w-full h-12 text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 mt-2"
                  >
                    {submitting ? '提交中...' : '提交并签到'}
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={handleBackToQuery}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回重新查询
                </Button>
              </div>
            )}

            {pageState === 'checkInSuccess' && checkInResult && (
              <div className="space-y-4 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2
                      className="w-10 h-10 text-emerald-600"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    签到成功！
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    请到对应候场区等待叫号
                  </p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Ticket className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm text-indigo-600 font-medium">
                      签到序号
                    </span>
                  </div>
                  <div className="text-5xl font-black text-indigo-700 mb-3">
                    {checkInResult.globalNumber}
                  </div>
                  <p className="text-sm text-indigo-600">
                    {checkInResult.name} · {checkInResult.className || '未填写班级'}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 w-20">意向部门</span>
                    {renderDeptBadge(checkInResult.firstDepartment)}
                  </div>
                  {isNewRegistration && (
                    <p className="text-xs text-emerald-600 pt-1">
                      已自动为你创建报名档案
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleAgain}
                  variant="outline"
                  className="w-full h-11"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  继续下一位签到
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-slate-400">
          此系统由义务电脑维修队开发
        </div>
      </div>

      <Dialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重复报名提示</DialogTitle>
            <DialogDescription>
              该手机号已报名，是否直接使用已有信息签到？
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600 space-y-1">
            <p>
              姓名：<span className="font-medium text-slate-900">{form.name}</span>
            </p>
            <p>
              手机号：<span className="font-medium text-slate-900">{form.phone}</span>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmDuplicate}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? '提交中...' : '确认覆盖并签到'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreRegisterPage;
