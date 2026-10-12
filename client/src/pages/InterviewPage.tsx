import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { logger } from '@lark-apaas/client-toolkit/logger';
import { candidates } from '@client/src/api/index';
import type {
  Candidate,
  CandidateStatus,
  GroupName,
  InterviewerScore,
} from '@shared/api.interface';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { ScrollArea } from '@client/src/components/ui/scroll-area';
  import {
    RefreshCw,
    Play,
    CheckCircle2,
    User,
    GraduationCap,
    Building2,
    LogOut,
    Clock,
    MessageSquare,
    Shield,
    Eye,
    ChevronDown,
    ChevronUp,
    Phone,
    Users,
    RotateCcw,
  } from 'lucide-react';

const SESSION_KEY = 'admin_session';
const REFRESH_INTERVAL = 5000;
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
const ALL_GROUPS: GroupName[] = ['A', 'B', 'C', 'D'];

type UserRole = 'admin' | 'floating' | 'interviewer';

function getUserRole(name: string): UserRole {
  if (name === ADMIN_NAME) return 'admin';
  if (FLOATING_STAFF.includes(name)) return 'floating';
  return 'interviewer';
}

function getMinScoreRequired(groupName: string | null): number {
  if (groupName === 'D') return 1;
  return 2;
}

function canSubmitApproval(candidate: Candidate): boolean {
  const scored = candidate.scoredCount ?? 0;
  const minRequired = getMinScoreRequired(candidate.groupName);
  return scored >= minRequired;
}

const STATUS_LABEL: Record<string, string> = {
  pre_registered: '预报名',
  waiting: '待面试',
  interviewing: '面试中',
  pending_approval: '待审批',
  completed: '已完成',
};

const STATUS_BADGE_VARIANT: Record<string, string> = {
  pre_registered: 'bg-slate-100 text-slate-700 border-slate-200',
  waiting: 'bg-slate-100 text-slate-700 border-slate-200',
  interviewing: 'bg-amber-100 text-amber-700 border-amber-200',
  pending_approval: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface InterviewerSession {
  name: string;
  groupName: GroupName;
}

const InterviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewerSession | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupName>('A');

  const isAdmin = session?.name === ADMIN_NAME;
  const role = session?.name ? getUserRole(session.name) : 'interviewer';
  const canViewAllGroups = role === 'admin' || role === 'floating';
  const canOperate = role === 'admin' || role === 'interviewer';
   const canEditScore = (candidate: Candidate | null): boolean => {
     if (!candidate) return false;
     if (candidate.status === 'completed' || candidate.status === 'pending_approval') return isAdmin;
     return canOperate;
   };

  // 队列数据
  const [queue, setQueue] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );

  // 打分表单
  const [scoreInput, setScoreInput] = useState<string>('');
  const [judgeComment, setJudgeComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 初始化：从 localStorage 恢复会话（由 ProtectedRoute 保证已登录）
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed: InterviewerSession = JSON.parse(stored);
        if (parsed.name && parsed.groupName) {
          setSession({ name: parsed.name, groupName: parsed.groupName as GroupName });
        }
      } catch (error) {
        logger.error('解析本地会话失败', error);
        localStorage.removeItem(SESSION_KEY);
        navigate('/login', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const fetchQueue = useCallback(async (group: GroupName, isSilent = false) => {
    try {
      // 静默刷新（定时轮询）时不显示loading，避免页面闪烁
      if (!isSilent) setLoading(true);
      const data: Candidate[] = await candidates.getGroupQueue(
        group,
        session?.name,
      );
      const sorted = [...data].sort(
        (a: Candidate, b: Candidate) =>
          (a.groupNumber ?? 0) - (b.groupNumber ?? 0),
      );
      setQueue(sorted);
    } catch (error) {
      logger.error('获取分组队列失败', error);
      if (!isSilent) toast.error('获取队列失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const currentGroup: GroupName = canViewAllGroups ? activeGroup : (session?.groupName ?? 'A');

  type QueueViewMode = 'active' | 'completed';
  const [queueViewMode, setQueueViewMode] = useState<QueueViewMode>('active');

  const activeQueue = useMemo(
    () =>
      queue.filter(
        (c: Candidate) =>
          c.status === 'waiting' ||
          c.status === 'interviewing' ||
          c.status === 'pending_approval',
      ),
    [queue],
  );

  const completedQueue = useMemo(
    () =>
      queue.filter(
        (c: Candidate) =>
          c.status === 'completed' || c.status === 'absent',
      ),
    [queue],
  );

  const displayedQueue =
    queueViewMode === 'active' ? activeQueue : completedQueue;

  // 分页：每页最多5个面试者
  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(displayedQueue.length / PAGE_SIZE));
  const pagedQueue = displayedQueue.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // 切换视图模式时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [queueViewMode, currentGroup]);

  // 登录后加载队列
  useEffect(() => {
    if (session) {
      setActiveGroup(session.groupName);
      void fetchQueue(session.groupName);
    }
  }, [session, fetchQueue]);

  // 自动刷新（静默刷新，不显示loading，保持页面状态）
  useEffect(() => {
    if (!session) return;
    const intervalId = setInterval(() => {
      void fetchQueue(currentGroup, true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [session, fetchQueue, currentGroup]);

  const handleGroupChange = (group: GroupName) => {
    setActiveGroup(group);
    setSelectedCandidateId(null);
    void fetchQueue(group);
  };

  const currentInterviewing = useMemo(
    () => queue.find((c: Candidate) => c.status === 'interviewing' || c.status === 'pending_approval') ?? null,
    [queue],
  );

  const selectedCandidate = useMemo(() => {
    if (selectedCandidateId) {
      return queue.find((c: Candidate) => c.id === selectedCandidateId) ?? null;
    }
    return currentInterviewing;
  }, [selectedCandidateId, queue, currentInterviewing]);

  // 当前面试官的已有打分
  const myScoreRecord = useMemo<InterviewerScore | null>(() => {
    if (!selectedCandidate || !session) return null;
    return (
      selectedCandidate.scores?.find(
        (s: InterviewerScore) => s.interviewerName === session.name,
      ) ?? null
    );
  }, [selectedCandidate, session]);

  // 选中考生时回填打分表单
  useEffect(() => {
    if (myScoreRecord) {
      setScoreInput(String(myScoreRecord.score));
      setJudgeComment(myScoreRecord.judgeComment ?? '');
    } else {
      setScoreInput('');
      setJudgeComment('');
    }
  }, [myScoreRecord?.id]);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    navigate('/login', { replace: true });
    toast.info('已退出登录');
  };

  const handleRefresh = () => {
    if (session) {
      void fetchQueue(currentGroup);
    }
  };

  const handleStartInterview = async () => {
    if (!selectedCandidate || !session) return;
    try {
      await candidates.updateStatus(
        selectedCandidate.id,
        'interviewing',
        session.name,
      );
      toast.success(`已开始面试：${selectedCandidate.name}`);
      void fetchQueue(currentGroup);
    } catch (error) {
      logger.error('开始面试失败', error);
      toast.error('开始面试失败');
    }
  };

  const handleCompleteInterview = async () => {
    if (!selectedCandidate || !session) return;
    const scored = selectedCandidate.scoredCount ?? 0;
    const minRequired = getMinScoreRequired(selectedCandidate.groupName);
    if (scored < minRequired) {
      toast.error(`至少需要 ${minRequired} 位面试官评分才能提交审批（当前 ${scored} 人）`);
      return;
    }
    try {
      await candidates.updateStatus(
        selectedCandidate.id,
        'pending_approval',
        session.name,
      );
      toast.success(`已提交审批：${selectedCandidate.name}，请等待签到人员审批`);
      void fetchQueue(currentGroup);
    } catch (error) {
      logger.error('提交审批失败', error);
      toast.error('提交审批失败');
    }
  };

   const handleSubmitScore = async () => {
     if (!selectedCandidate || !session) return;

    const score = Number(scoreInput);
    if (Number.isNaN(score) || score < 0 || score > 10) {
      toast.error('请输入 0-10 之间的综合分');
      return;
    }

    try {
      setSubmitting(true);
      await candidates.submitScore(
        selectedCandidate.id,
        score,
        session.name,
        judgeComment || undefined,
      );
      toast.success(
        myScoreRecord ? '打分已更新' : '打分提交成功',
      );
      void fetchQueue(currentGroup);
    } catch (error) {
      logger.error('提交打分失败', error);
      toast.error('提交打分失败');
    } finally {
      setSubmitting(false);
    }
   };

   // 手机端操作函数（使用candidateId直接操作）
   const handleStartInterviewMobile = async (candidateId: string) => {
     if (!session) return;
     try {
       await candidates.updateStatus(
         candidateId,
         'interviewing',
         session.name,
       );
       toast.success('已开始面试');
       void fetchQueue(currentGroup);
     } catch (error) {
       logger.error('开始面试失败', error);
       toast.error('开始面试失败');
     }
   };

    const handleCompleteInterviewMobile = async (candidateId: string) => {
      if (!session) return;
      const cand = queue.find((c: Candidate) => c.id === candidateId);
      if (cand) {
        const scored = cand.scoredCount ?? 0;
        const minRequired = getMinScoreRequired(cand.groupName);
        if (scored < minRequired) {
          toast.error(`至少需要 ${minRequired} 位面试官评分才能提交审批（当前 ${scored} 人）`);
          return;
        }
      }
      try {
        await candidates.updateStatus(
          candidateId,
          'pending_approval',
          session.name,
        );
        toast.success('已提交审批，等待签到人员审批');
        void fetchQueue(currentGroup);
      } catch (error) {
        logger.error('提交审批失败', error);
        toast.error('提交审批失败');
      }
    };

   const handleSubmitScoreMobile = async (candidateId: string) => {
     if (!session) return;
     const score = Number(scoreInput);
     if (Number.isNaN(score) || score < 0 || score > 10) {
       toast.error('请输入 0-10 之间的综合分');
       return;
     }
     try {
       setSubmitting(true);
       await candidates.submitScore(
         candidateId,
         score,
         session.name,
         judgeComment || undefined,
       );
       toast.success('打分提交成功');
       void fetchQueue(currentGroup);
     } catch (error) {
       logger.error('提交打分失败', error);
       toast.error('提交打分失败');
     } finally {
       setSubmitting(false);
     }
   };

   if (!session) {
    return <div className="p-6 text-slate-500">加载中...</div>;
  }

  // 工作台
  return (
    <div className="flex flex-col gap-4">
      {/* 顶部标题和用户信息 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">面试官工作台</h2>
          <p className="text-sm text-slate-500 mt-1">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              面试官：{session.name}（{role === 'floating' ? '流动人员' : `${session.groupName}组`}）
              {isAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                  <Shield className="h-3.5 w-3.5" />
                  管理员模式
                </span>
              )}
              {role === 'floating' && (
                <span className="ml-2 inline-flex items-center gap-1 text-sky-600 font-medium">
                  <Eye className="h-3.5 w-3.5" />
                  流动人员·查看模式
                </span>
              )}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            手动刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2 text-slate-600"
          >
            <LogOut className="h-4 w-4" />
            退出
          </Button>
        </div>
      </div>

      {/* 组别切换（管理员 + 流动人员可切换） */}
       {canViewAllGroups && (
         <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
           {ALL_GROUPS.map((g: GroupName) => (
             <button
               key={g}
               type="button"
               onClick={() => handleGroupChange(g)}
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                 activeGroup === g
                   ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                   : 'text-slate-600 hover:text-slate-900'
               }`}
             >
               {g}组
             </button>
           ))}
         </div>
       )}

       {/* 队列状态切换 */}
       <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
         <button
           type="button"
           onClick={() => setQueueViewMode('active')}
           className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
             queueViewMode === 'active'
               ? 'bg-white text-indigo-600 shadow-sm font-semibold'
               : 'text-slate-600 hover:text-slate-900'
           }`}
         >
           待面试 · {activeQueue.length}
         </button>
         <button
           type="button"
           onClick={() => setQueueViewMode('completed')}
           className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
             queueViewMode === 'completed'
               ? 'bg-white text-indigo-600 shadow-sm font-semibold'
               : 'text-slate-600 hover:text-slate-900'
           }`}
         >
           已完成 · {completedQueue.length}
         </button>
       </div>

      {/* 主体布局 */}
       {/* 桌面端：左右双栏 */}
       <div className="hidden lg:flex lg:flex-row gap-4">
        {/* 左侧：考生队列 */}
        <div className="w-full lg:w-1/3">
          <Card className="h-[calc(100vh-220px)] min-h-[500px] flex flex-col">
            <CardHeader className="pb-3">
               <CardTitle className="text-lg">
                 {currentGroup} 组{queueViewMode === 'active' ? '待面试' : '已完成'}队列
               </CardTitle>
                <CardDescription>
                  共 {displayedQueue.length} 人
                  {currentInterviewing && queueViewMode === 'active' && (
                    <span className="ml-2 text-amber-600">
                      · {currentInterviewing.status === 'pending_approval' ? '待审批' : '面试中'} 1 人
                    </span>
                  )}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full">
                <div className="px-4 pb-4 space-y-2">
                   {displayedQueue.length === 0 && !loading && (
                     <div className="text-center text-slate-400 py-12">
                       {queueViewMode === 'active' ? '暂无待面试考生' : '暂无已完成考生'}
                     </div>
                   )}
                   {pagedQueue.map((candidate: Candidate) => {
                    const isSelected =
                      selectedCandidate?.id === candidate.id;
                    const isInterviewing =
                      candidate.status === 'interviewing';
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        } ${isInterviewing ? 'ring-2 ring-amber-400' : ''}`}
                      >
                         <div className="flex items-start justify-between gap-2">
                           <div className="flex items-center gap-2">
                             <span className="text-lg font-bold text-slate-700 w-8">
                               {candidate.groupNumber ?? '-'}
                             </span>
                             <div>
                               <div className="font-medium text-slate-900">
                                 {candidate.name}
                               </div>
                               <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                 <GraduationCap className="h-3 w-3" />
                                 {candidate.className || '未填写'}
                               </div>
                               <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                 <Building2 className="h-3 w-3" />
                                 {candidate.firstDepartment || '未填写'}
                               </div>
                               {queueViewMode === 'completed' && candidate.status === 'completed' && (
                                 <div className="text-xs text-emerald-600 font-semibold mt-1">
                                   最终得分：{candidate.averageScore !== null ? candidate.averageScore.toFixed(1) : '-'}
                                 </div>
                               )}
                             </div>
                           </div>
                          <Badge
                            variant="outline"
                            className={`${STATUS_BADGE_VARIANT[candidate.status]} text-xs whitespace-nowrap`}
                          >
                            {STATUS_LABEL[candidate.status]}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                  <span className="text-sm text-slate-500">
                    第 {currentPage}/{totalPages} 页 · 共 {displayedQueue.length} 人
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded-md border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded-md border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：详情 + 打分面板 */}
        <div className="w-full lg:w-2/3 space-y-4">
          {!selectedCandidate ? (
            <Card className="h-[calc(100vh-220px)] min-h-[500px] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>请从左侧选择一位考生</p>
              </div>
            </Card>
          ) : (
            <>
              {/* 考生基本信息卡片 */}
                <Card
                  className={`${
                    selectedCandidate.status === 'interviewing' || selectedCandidate.status === 'pending_approval'
                      ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30'
                      : ''
                  }`}
                >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-black text-indigo-600">
                        {selectedCandidate.groupNumber ?? '-'}
                      </span>
                      <span className="text-2xl font-bold text-slate-900">
                        {selectedCandidate.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-sm px-3 py-1 ${STATUS_BADGE_VARIANT[selectedCandidate.status]}`}
                    >
                      {STATUS_LABEL[selectedCandidate.status]}
                    </Badge>
                  </div>
                   <CardDescription className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                     <span className="flex items-center gap-1 text-slate-600">
                       <Users className="h-3.5 w-3.5" />
                       {selectedCandidate.gender || '未填写'}
                     </span>
                     <span className="flex items-center gap-1 text-slate-600">
                       <GraduationCap className="h-3.5 w-3.5" />
                       {selectedCandidate.className || '未填写'}
                     </span>
                     <span className="flex items-center gap-1 text-slate-600">
                       <Phone className="h-3.5 w-3.5" />
                       {selectedCandidate.phone || '未填写'}
                     </span>
                     {selectedCandidate.firstDepartment && (
                       <Badge
                         variant="outline"
                         className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal"
                       >
                         第一意向：{selectedCandidate.firstDepartment}
                       </Badge>
                     )}
                     {selectedCandidate.secondDepartment && (
                       <Badge
                         variant="outline"
                         className="bg-violet-50 text-violet-700 border-violet-200 font-normal"
                       >
                         第二意向：{selectedCandidate.secondDepartment}
                       </Badge>
                     )}
                     <Badge
                       variant="outline"
                       className={`font-normal ${
                         selectedCandidate.acceptAdjust === '是'
                           ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                           : 'bg-slate-50 text-slate-600 border-slate-200'
                       }`}
                     >
                       服从调剂：{selectedCandidate.acceptAdjust || '未填写'}
                     </Badge>
                   </CardDescription>
                </CardHeader>
              </Card>

              {/* 已有打分情况 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">打分情况</CardTitle>
                  <CardDescription>
                     已打分 {selectedCandidate.scoredCount}/{selectedCandidate.groupInterviewerCount || 0} 人
                     {selectedCandidate.groupName === 'D' ? null : (
                       <span className="text-slate-400">（至少{getMinScoreRequired(selectedCandidate.groupName)}人可提交）</span>
                     )}
                     {canSubmitApproval(selectedCandidate) ? (
                       <span className="text-emerald-600 font-medium ml-2">已满足提交条件</span>
                     ) : null}
                     <span className="text-indigo-600 font-semibold ml-2">
                       当前平均分{' '}
                       {selectedCandidate.averageScore !== null
                         ? selectedCandidate.averageScore.toFixed(1)
                         : '-'}
                     </span>
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  {(selectedCandidate.scores?.length ?? 0) === 0 ? (
                    <div className="text-center text-slate-400 py-6">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无面试官打分</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCandidate.scores?.map(
                        (s: InterviewerScore) => (
                          <div
                            key={s.id}
                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                          >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <User className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-900">
                                  {s.interviewerName}
                                </span>
                                <span className="text-xl font-bold text-indigo-600">
                                  {s.score.toFixed(1)}
                                </span>
                              </div>
                              {s.judgeComment && (
                                <p className="text-sm text-slate-600 mt-1 flex items-start gap-1">
                                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                                  <span className="break-words">
                                    {s.judgeComment}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 打分面板 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {myScoreRecord ? '修改我的打分' : '我的打分'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 综合分 */}
                  <div className="space-y-2">
                    <Label htmlFor="score-input" className="flex justify-between">
                      <span>综合分</span>
                      <span className="text-slate-400">满分 10 分</span>
                    </Label>
                     <Input
                       id="score-input"
                       type="number"
                       min={0}
                       max={10}
                       step={0.1}
                       value={scoreInput}
                       onChange={(e) => setScoreInput(e.target.value)}
                       placeholder="请输入 0-10 的分数，如 8.5"
                       className="text-2xl font-bold text-center h-14"
                       disabled={
                         !canEditScore(selectedCandidate)
                       }
                     />
                  </div>

                  {/* 备注 */}
                  <div className="space-y-2">
                    <Label htmlFor="judge-comment">备注</Label>
                   <Textarea
                       id="judge-comment"
                       placeholder="请输入备注..."
                       rows={4}
                       value={judgeComment}
                       onChange={(e) => setJudgeComment(e.target.value)}
                       disabled={!canEditScore(selectedCandidate)}
                     />
                  </div>

                  {/* 状态操作按钮 */}
                  <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
                   {selectedCandidate.status === 'waiting' && canOperate && (
                       <Button
                         onClick={handleStartInterview}
                         className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                         disabled={!!currentInterviewing}
                       >
                         <Play className="h-4 w-4" />
                         叫号（开始面试）
                       </Button>
                     )}
                      {selectedCandidate.status === 'interviewing' && canOperate && (
                        <Button
                          onClick={handleCompleteInterview}
                          className="bg-amber-600 hover:bg-amber-700 gap-2"
                          disabled={!canSubmitApproval(selectedCandidate)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          提交审批
                        </Button>
                       )}
                      {selectedCandidate.status === 'pending_approval' && (
                        <Badge
                          variant="outline"
                          className="text-sm px-3 py-1.5 bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                          等待审批中，请等待签到人员审批
                        </Badge>
                      )}
                      {canEditScore(selectedCandidate) && (
                       <Button
                         onClick={handleSubmitScore}
                         disabled={submitting}
                         className="bg-indigo-600 hover:bg-indigo-700 gap-2 ml-auto"
                       >
                         <CheckCircle2 className="h-4 w-4" />
                         {submitting
                           ? '提交中...'
                           : myScoreRecord
                             ? '更新打分'
                             : '提交打分'}
                       </Button>
                     )}
                     {!canOperate && (
                       <Badge
                         variant="outline"
                         className="text-sm px-3 py-1.5 bg-sky-50 text-sky-700 border-sky-200"
                       >
                         <Eye className="h-3.5 w-3.5 mr-1" />
                         流动人员·仅查看
                       </Badge>
                     )}
                    {selectedCandidate.status === 'absent' && (
                      <Badge
                        variant="outline"
                        className="text-sm px-3 py-1.5"
                      >
                        已缺考，不可打分
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
             </>
           )}
         </div>
       </div>

       {/* 手机端：卡片列表 + 展开详情 */}
       <div className="lg:hidden space-y-3">
         <div className="flex items-center justify-between px-1">
           <span className="text-sm font-medium text-slate-700">
             {currentGroup} 组 · 共 {displayedQueue.length} 人
           </span>
           {currentInterviewing && queueViewMode === 'active' && (
             <span className="text-xs text-amber-600 font-medium">
               · 面试中 1 人
             </span>
           )}
         </div>
         {loading && (
           <div className="text-center py-8 text-slate-400">加载中...</div>
         )}
         {!loading && displayedQueue.length === 0 && (
           <div className="text-center py-12 text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
             <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
             <p>{queueViewMode === 'active' ? '暂无待面试考生' : '暂无已完成考生'}</p>
           </div>
         )}
         {!loading &&
           pagedQueue.map((candidate: Candidate) => {
             const isExpanded = selectedCandidateId === candidate.id;
             const isInterviewing = candidate.status === 'interviewing';
             const myScore = candidate.scores?.find(
               (s: InterviewerScore) => s.interviewerName === session.name,
             ) ?? null;
             return (
               <div
                 key={candidate.id}
                 className={`bg-white border rounded-lg overflow-hidden transition-all ${
                   isInterviewing
                     ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30'
                     : 'border-slate-200'
                 }`}
               >
                 <button
                   type="button"
                   onClick={() =>
                     setSelectedCandidateId(isExpanded ? null : candidate.id)
                   }
                   className="w-full text-left p-3 flex items-start gap-3"
                 >
                   <span className="text-2xl font-black text-indigo-600 w-10 text-center">
                     {String(candidate.groupNumber ?? '-').padStart(2, '0')}
                   </span>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between gap-2">
                       <span className="font-bold text-slate-900 text-base">
                         {candidate.name}
                       </span>
                       <Badge
                         variant="outline"
                         className={`${STATUS_BADGE_VARIANT[candidate.status]} text-xs whitespace-nowrap`}
                       >
                         {STATUS_LABEL[candidate.status]}
                       </Badge>
                     </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {candidate.gender || '未填写'}
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {candidate.className || '未填写'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {candidate.firstDepartment || '未填写'}
                        </span>
                        {queueViewMode === 'completed' && candidate.status === 'completed' && (
                          <span className="text-emerald-600 font-semibold">
                            最终得分：{candidate.averageScore !== null ? candidate.averageScore.toFixed(1) : '-'}
                          </span>
                        )}
                      </div>
                   </div>
                   <div className="text-slate-400 pt-1">
                     {isExpanded ? (
                       <ChevronUp className="h-5 w-5" />
                     ) : (
                       <ChevronDown className="h-5 w-5" />
                     )}
                   </div>
                 </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                      {/* 考生基本信息 */}
                      <div className="space-y-2">
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {candidate.gender || '未填写'}
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {candidate.className || '未填写'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {candidate.phone || '未填写'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.firstDepartment && (
                            <Badge
                              variant="outline"
                              className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-normal"
                            >
                              第一意向：{candidate.firstDepartment}
                            </Badge>
                          )}
                          {candidate.secondDepartment && (
                            <Badge
                              variant="outline"
                              className="bg-violet-50 text-violet-700 border-violet-200 text-xs font-normal"
                            >
                              第二意向：{candidate.secondDepartment}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal ${
                              candidate.acceptAdjust === '是'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            服从调剂：{candidate.acceptAdjust || '未填写'}
                          </Badge>
                        </div>
                      </div>

                      {/* 已有打分情况 */}
                     <div className="space-y-2">
                        <div className="text-xs text-slate-500">
                          已打分 {candidate.scoredCount}/{candidate.groupInterviewerCount || 0} 人
                          {candidate.groupName === 'D' ? null : (
                            <span className="text-slate-400">（至少{getMinScoreRequired(candidate.groupName)}人可提交）</span>
                          )}
                          {canSubmitApproval(candidate) && (
                            <span className="text-emerald-600 font-medium ml-1">已满足</span>
                          )}
                          <span className="text-indigo-600 font-semibold ml-2">
                            平均分{' '}
                            {candidate.averageScore !== null
                              ? candidate.averageScore.toFixed(1)
                              : '-'}
                          </span>
                        </div>
                       {(candidate.scores?.length ?? 0) > 0 && (
                         <div className="space-y-2">
                           {candidate.scores?.map((s: InterviewerScore) => (
                             <div
                               key={s.id}
                               className="flex items-start gap-2 p-2 bg-slate-50 rounded-md"
                             >
                               <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                 <User className="h-4 w-4 text-indigo-600" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between">
                                   <span className="text-sm font-medium text-slate-900">
                                     {s.interviewerName}
                                   </span>
                                   <span className="text-lg font-bold text-indigo-600">
                                     {s.score.toFixed(1)}
                                   </span>
                                 </div>
                                 {s.judgeComment && (
                                   <p className="text-xs text-slate-600 mt-0.5 break-words">
                                     {s.judgeComment}
                                   </p>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>

                      {/* 打分区 */}
                      {canEditScore(candidate) && (
                       <div className="space-y-3 pt-2 border-t border-slate-100">
                         <div className="space-y-1.5">
                           <Label
                             htmlFor={`score-input-${candidate.id}`}
                             className="text-sm flex justify-between"
                           >
                             <span>综合分</span>
                             <span className="text-slate-400 text-xs">满分 10 分</span>
                           </Label>
                           <Input
                             id={`score-input-${candidate.id}`}
                             type="number"
                             min={0}
                             max={10}
                             step={0.1}
                             inputMode="decimal"
                             value={
                               selectedCandidateId === candidate.id
                                 ? scoreInput
                                 : myScore
                                   ? String(myScore.score)
                                   : ''
                             }
                             onChange={(e) => {
                               setSelectedCandidateId(candidate.id);
                               setScoreInput(e.target.value);
                             }}
                             onFocus={() => setSelectedCandidateId(candidate.id)}
                             placeholder="请输入分数"
                             className="text-xl font-bold text-center h-12"
                           />
                         </div>
                         <div className="space-y-1.5">
                           <Label
                             htmlFor={`judge-${candidate.id}`}
                             className="text-sm"
                           >
                             备注
                           </Label>
                           <Textarea
                             id={`judge-${candidate.id}`}
                             placeholder="请输入备注..."
                             rows={3}
                             value={
                               selectedCandidateId === candidate.id
                                 ? judgeComment
                                 : myScore?.judgeComment ?? ''
                             }
                             onChange={(e) => {
                               setSelectedCandidateId(candidate.id);
                               setJudgeComment(e.target.value);
                             }}
                           />
                         </div>
                         <div className="flex flex-wrap gap-2">
                           {candidate.status === 'waiting' && (
                             <Button
                               onClick={() =>
                                 handleStartInterviewMobile(candidate.id)
                               }
                               className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700"
                             >
                               <Play className="h-4 w-4" />
                               叫号入场
                             </Button>
                           )}
                           {candidate.status === 'interviewing' && (
                              <Button
                                onClick={() =>
                                  handleCompleteInterviewMobile(candidate.id)
                                }
                                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700"
                                disabled={!canSubmitApproval(candidate)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                提交审批
                              </Button>
                           )}
                           <Button
                             onClick={() =>
                               handleSubmitScoreMobile(candidate.id)
                             }
                             disabled={submitting}
                             className="w-full h-11 bg-indigo-600 hover:bg-indigo-700"
                           >
                             <CheckCircle2 className="h-4 w-4" />
                             {submitting
                               ? '提交中...'
                               : myScore
                                 ? '更新打分'
                                 : '提交打分'}
                           </Button>
                         </div>
                       </div>
                     )}

                      {!canEditScore(candidate) && candidate.status !== 'waiting' && candidate.status !== 'interviewing' && (
                        <div className="flex items-center justify-center py-2">
                          <Badge
                            variant="outline"
                            className="bg-sky-50 text-sky-700 border-sky-200"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            仅查看
                          </Badge>
                        </div>
                      )}

                     {candidate.status === 'absent' && (
                       <div className="text-center py-2">
                         <Badge variant="outline" className="text-sm">
                           已缺考
                         </Badge>
                       </div>
                     )}
                   </div>
                 )}
               </div>
             );
           })}
           {/* 移动端分页控件 */}
           {totalPages > 1 && (
             <div className="flex items-center justify-between px-2 py-3 mt-2">
               <span className="text-sm text-slate-500">
                 第 {currentPage}/{totalPages} 页 · 共 {displayedQueue.length} 人
               </span>
               <div className="flex gap-2">
                 <button
                   type="button"
                   onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="px-3 py-1.5 text-sm rounded-md border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                 >
                   上一页
                 </button>
                 <button
                   type="button"
                   onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   className="px-3 py-1.5 text-sm rounded-md border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                 >
                   下一页
                 </button>
               </div>
             </div>
           )}
       </div>
     </div>
   );
 };

export default InterviewPage;
