import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Filter,
  RotateCcw,
  Search as SearchIcon,
  Users,
  CheckCircle,
  Trophy,
  BarChart3,
  Eye,
} from 'lucide-react';
const logger = { warn: console.warn, error: console.error, info: console.log, debug: console.log };
const resolveAppUrl = (path: string): string => (path.startsWith('http') ? path : path);
import { toast } from 'sonner';

import { candidates } from '@client/src/api';
import type {
  Candidate,
  CandidateStatus,
  ResultsStats,
  InterviewerScore,
} from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';

const GROUPS = ['A', 'B', 'C', 'D'] as const;
const PAGE_SIZE = 20;

interface FilterState {
  groupName: string;
  minScore: string;
  maxScore: string;
  keyword: string;
}

const DEFAULT_FILTER: FilterState = {
  groupName: '',
  minScore: '',
  maxScore: '',
  keyword: '',
};

function getStatusBadgeVariant(status: CandidateStatus): string {
  switch (status) {
    case 'waiting':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'interviewing':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'pending_approval':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'absent':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getStatusLabel(status: CandidateStatus): string {
  switch (status) {
    case 'pre_registered':
      return '预报名';
    case 'waiting':
      return '待面试';
    case 'interviewing':
      return '面试中';
    case 'pending_approval':
      return '待审批';
    case 'completed':
      return '已完成';
    case 'absent':
      return '缺考';
    default:
      return status;
  }
}

function getSortedScores(scores: InterviewerScore[]): InterviewerScore[] {
  return [...scores].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function formatScoreLabel(score: InterviewerScore): string {
  const name = score.interviewerName === 'guido' ? 'guido(管理员)' : score.interviewerName;
  return `${name}：${score.score.toFixed(1)}分`;
}

const ResultsPage: React.FC = () => {
  const [filterForm, setFilterForm] = useState<FilterState>(DEFAULT_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ResultsStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  const fetchList = useCallback(async (filter: FilterState, currentPage: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: currentPage,
        pageSize: PAGE_SIZE,
      };
      if (filter.keyword) params.keyword = filter.keyword;
      if (filter.groupName) params.groupName = filter.groupName;
      if (filter.minScore !== '') params.minScore = Number(filter.minScore);
      if (filter.maxScore !== '') params.maxScore = Number(filter.maxScore);

      const response = await candidates.searchCandidates(params);
      setItems(response.items);
      setTotal(response.total);
    } catch (error) {
      logger.error('加载面试结果失败', error);
      toast.error('加载面试结果失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (filter: FilterState) => {
    setStatsLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {};
      if (filter.keyword) params.keyword = filter.keyword;
      if (filter.groupName) params.groupName = filter.groupName;
      if (filter.minScore !== '') params.minScore = Number(filter.minScore);
      if (filter.maxScore !== '') params.maxScore = Number(filter.maxScore);

      const data = await candidates.getCandidatesStats(params);
      setStats(data);
    } catch (error) {
      logger.error('加载统计数据失败', error);
      toast.error('加载统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList(appliedFilter, page);
  }, [appliedFilter, page, fetchList]);

  useEffect(() => {
    fetchStats(appliedFilter);
  }, [appliedFilter, fetchStats]);

  const handleSearch = () => {
    if (
      filterForm.minScore !== '' &&
      filterForm.maxScore !== '' &&
      Number(filterForm.minScore) > Number(filterForm.maxScore)
    ) {
      toast.error('最低分不能大于最高分');
      return;
    }
    setPage(1);
    setAppliedFilter(filterForm);
  };

  const handleReset = () => {
    setFilterForm(DEFAULT_FILTER);
    setPage(1);
    setAppliedFilter(DEFAULT_FILTER);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number | undefined> = {};
      if (appliedFilter.keyword) params.keyword = appliedFilter.keyword;
      if (appliedFilter.groupName) params.groupName = appliedFilter.groupName;
      if (appliedFilter.minScore !== '') params.minScore = Number(appliedFilter.minScore);
      if (appliedFilter.maxScore !== '') params.maxScore = Number(appliedFilter.maxScore);
      params.operatorName = 'guido';

      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });

      const res = await fetch(`/api/candidates/export?${query.toString()}`);
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `面试结果_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error) {
      logger.error('导出失败', error);
      toast.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const rankStart = (page - 1) * PAGE_SIZE;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">面试结果管理</h2>
          <p className="text-sm text-slate-500 mt-1">
            全部面试结束后查看、筛选和导出面试结果
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Download className="w-4 h-4 mr-2" />
          {exporting ? '导出中...' : '导出 CSV'}
        </Button>
      </div>

      {/* Filter area */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">筛选条件</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-slate-600">关键词</label>
              <Input
                placeholder="姓名 / 学号"
                value={filterForm.keyword}
                onChange={(e) =>
                  setFilterForm({ ...filterForm, keyword: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-600">组别</label>
              <Select
                value={filterForm.groupName}
                onValueChange={(value) =>
                  setFilterForm({ ...filterForm, groupName: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g} 组
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-600">最低分</label>
              <Input
                type="number"
                placeholder="最低分"
                value={filterForm.minScore}
                onChange={(e) =>
                  setFilterForm({ ...filterForm, minScore: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-600">最高分</label>
              <Input
                type="number"
                placeholder="最高分"
                value={filterForm.maxScore}
                onChange={(e) =>
                  setFilterForm({ ...filterForm, maxScore: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSearch}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <SearchIcon className="w-4 h-4 mr-1.5" />
                查询
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats overview */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        data-ai-section-type="card-stat"
      >
        <StatCard
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          label="总人数"
          value={statsLoading ? '-' : String(stats?.total ?? 0)}
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
          label="已完成面试"
          value={statsLoading ? '-' : String(stats?.completed ?? 0)}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-amber-600" />}
          label="有分人数"
          value={statsLoading ? '-' : String(stats?.scoredCount ?? 0)}
        />
        <StatCard
          icon={<Trophy className="w-5 h-5 text-indigo-600" />}
          label="整体平均分"
          value={
            statsLoading
              ? '-'
              : stats?.averageScore
                ? stats.averageScore.toFixed(2)
                : '0'
          }
        />
      </div>

      {/* Results table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              面试结果列表
            </h3>
            <span className="text-sm text-slate-500">
              共 {total} 条记录，按平均分降序排列
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400">加载中...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-slate-400">暂无符合条件的面试结果</p>
              <p className="text-sm text-slate-300 mt-1">
                请尝试调整筛选条件
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">排名</TableHead>
                      <TableHead className="w-20 text-center">全场序号</TableHead>
                      <TableHead className="w-16 text-center">组别</TableHead>
                      <TableHead className="w-20 text-center">组内序号</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>班级</TableHead>
                      <TableHead className="text-center font-semibold">最终平均分</TableHead>
                      <TableHead className="text-center">打分人数</TableHead>
                      <TableHead className="text-center">打分明细</TableHead>
                      <TableHead className="w-20 text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((candidate, index) => {
                      const sortedScores = getSortedScores(candidate.scores);
                      return (
                        <TableRow key={candidate.id}>
                          <TableCell className="text-center font-semibold text-indigo-600">
                            {candidate.averageScore !== null
                              ? rankStart + index + 1
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {candidate.globalNumber ?? '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {candidate.groupName ? (
                              <Badge variant="outline" className="font-medium">
                                {candidate.groupName} 组
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {candidate.groupNumber ?? '-'}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {candidate.name}
                          </TableCell>
                          <TableCell>{candidate.className ?? '-'}</TableCell>
                          <TableCell className="text-center font-bold text-slate-900">
                            {candidate.averageScore !== null
                              ? candidate.averageScore.toFixed(2)
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {candidate.scoredCount}
                          </TableCell>
                          <TableCell className="text-center">
                            {sortedScores.length > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailCandidate(candidate)}
                                aria-label={`查看${candidate.name}打分明细`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {sortedScores.length}人打分
                              </Button>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={getStatusBadgeVariant(candidate.status)}
                            >
                              {getStatusLabel(candidate.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-4 border-t border-slate-200">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page > 1) setPage(page - 1);
                          }}
                          aria-disabled={page === 1}
                          className={
                            page === 1
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          if (totalPages <= 7) return true;
                          if (p === 1 || p === totalPages) return true;
                          if (Math.abs(p - page) <= 1) return true;
                          return false;
                        })
                        .map((p, idx, arr) => (
                          <div key={p} className="flex items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <PaginationItem>
                                <span className="px-2 text-slate-400">
                                  ...
                                </span>
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                href="#"
                                isActive={p === page}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPage(p);
                                }}
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          </div>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page < totalPages) setPage(page + 1);
                          }}
                          aria-disabled={page === totalPages}
                          className={
                            page === totalPages
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailCandidate !== null} onOpenChange={(o) => !o && setDetailCandidate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailCandidate ? `${detailCandidate.name} · 打分明细` : '打分明细'}
            </DialogTitle>
          </DialogHeader>
          {detailCandidate && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">最终平均分</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {detailCandidate.averageScore !== null
                      ? detailCandidate.averageScore.toFixed(2)
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">打分人数</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {detailCandidate.scoredCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">组别</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {detailCandidate.groupName ?? '-'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {getSortedScores(detailCandidate.scores).length === 0 ? (
                  <p className="text-slate-400 text-center py-4">暂无打分记录</p>
                ) : (
                  getSortedScores(detailCandidate.scores).map((s, idx) => (
                    <div
                      key={s.id}
                      className="p-3 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">
                          {s.interviewerName === 'guido' ? 'guido(管理员)' : s.interviewerName}
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          {s.score.toFixed(1)}分
                        </span>
                      </div>
                      {s.judgeComment && (
                        <p className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-100">
                          {s.judgeComment}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 truncate">{label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ResultsPage;
