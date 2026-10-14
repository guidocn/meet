import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  Upload,
  GraduationCap,
  Users,
  Phone,
  AlertCircle,
  X,
  UserPlus,
} from 'lucide-react';
import { debounce } from 'lodash';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { candidates } from '@client/src/api';
import type {
  BatchImportResponse,
  Candidate,
  GroupName,
  PreRegisterCreateRequest,
  GroupCountInfo,
} from '@shared/api.interface';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';

const PAGE_SIZE = 20;
const GROUP_OPTIONS: GroupName[] = ['A', 'B', 'C', 'D'];
const REFRESH_INTERVAL = 10000; // 10秒刷新一次，响应更快

// 分组按钮颜色映射，方便快速区分不同组
const GROUP_COLORS: Record<GroupName, { bg: string; hover: string; border: string; text: string }> = {
  A: { bg: 'bg-cyan-600', hover: 'hover:bg-cyan-700', border: 'border-cyan-500', text: 'text-cyan-600' },
  B: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', border: 'border-emerald-500', text: 'text-emerald-600' },
  C: { bg: 'bg-orange-600', hover: 'hover:bg-orange-700', border: 'border-orange-500', text: 'text-orange-600' },
  D: { bg: 'bg-violet-600', hover: 'hover:bg-violet-700', border: 'border-violet-500', text: 'text-violet-600' },
};
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

type StatusFilter =
  | 'all'
  | 'pre_registered'
  | 'checked_in'
  | 'waiting'
  | 'interviewing'
  | 'completed';
type GroupFilter = 'all' | 'A' | 'B' | 'C' | 'D' | 'none';
type InterviewStatusFilter =
  | 'all'
  | 'waiting'
  | 'interviewing'
  | 'pending_approval'
  | 'completed';

interface ManualCheckInForm {
  name: string;
  gender: string;
  className: string;
  phone: string;
  department: string;
  acceptAdjust: string;
}

const emptyManualForm: ManualCheckInForm = {
  name: '',
  gender: '',
  className: '',
  phone: '',
  department: '',
  acceptAdjust: '否',
};

interface ManualAddForm {
  name: string;
  gender: string;
  className: string;
  phone: string;
  firstDepartment: string;
  secondDepartment: string;
  acceptAdjust: string;
}

const emptyManualAddForm: ManualAddForm = {
  name: '',
  gender: '',
  className: '',
  phone: '',
  firstDepartment: '',
  secondDepartment: '',
  acceptAdjust: '否',
};

const DEPARTMENT_OPTIONS = ['技术部', '宣传部', '外联部'];

const CheckInPage = () => {
  const [session, setSession] = useState<{ name: string; groupName: string; isAdmin?: boolean } | null>(null);
  const isAdmin = session?.name === ADMIN_NAME;
  const role = session?.name ? getUserRole(session.name) : 'interviewer';
  const canOperateFlow = role === 'admin' || role === 'floating';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSession(parsed);
      }
    } catch (err) {
      logger.warn('读取面试官会话失败', err);
    }
  }, []);

  // --- Filters ---
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [interviewStatusFilter, setInterviewStatusFilter] = useState<InterviewStatusFilter>('all');
  const [page, setPage] = useState(1);

   // --- List data ---
   const [items, setItems] = useState<Candidate[]>([]);
   const [total, setTotal] = useState(0);
   const [loading, setLoading] = useState(false);
   const [groupCounts, setGroupCounts] = useState<GroupCountInfo[]>([]);


  // --- Check-in dialog ---
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkInMode, setCheckInMode] = useState<'search' | 'manual'>('search');
  const [checkInSearchInput, setCheckInSearchInput] = useState('');
  const [checkInSearchResults, setCheckInSearchResults] = useState<Candidate[]>([]);
  const [checkInSearching, setCheckInSearching] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [manualForm, setManualForm] = useState<ManualCheckInForm>(emptyManualForm);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // --- Manual add dialog ---
  const [manualAddDialogOpen, setManualAddDialogOpen] = useState(false);
  const [manualAddForm, setManualAddForm] = useState<ManualAddForm>(emptyManualAddForm);
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false);

  // --- Reassign dialog ---
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignCandidate, setReassignCandidate] = useState<Candidate | null>(
    null,
  );
  const [reassignGroup, setReassignGroup] = useState<GroupName>('A');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  const handleApprove = async (candidateId: string) => {
    if (!canOperateFlow) {
      toast.error('无权限操作，仅管理员和流动人员可审批');
      return;
    }
    try {
      await candidates.approveCandidate(candidateId, session?.name ?? '');
      toast.success('已审批通过');
      void loadList(true);
      void loadGroupCounts();
    } catch (error) {
      logger.error('审批失败', error);
      toast.error('审批失败，请重试');
    }
  };

  // 推进到二面（一面完成 → 二面待面试）
  const handleMoveToSecond = async (candidateId: string) => {
    if (!canOperateFlow) {
      toast.error('无权限操作，仅管理员和流动人员可操作');
      return;
    }
    try {
      await candidates.moveToSecondRound(candidateId, session?.name ?? '');
      toast.success('二面签到成功');
      void loadList(true);
      void loadGroupCounts();
    } catch (error) {
      logger.error('二面签到失败', error);
      toast.error('二面签到失败，请重试');
    }
  };

  // 二面分配组别（E/F组）
  const handleAssignSecondGroup = async (candidateId: string, groupName: string) => {
    if (!canOperateFlow) {
      toast.error('无权限操作，仅管理员和流动人员可操作');
      return;
    }
    try {
      await candidates.assignSecondGroup(candidateId, groupName, session?.name ?? '');
      toast.success(`已分配到${groupName}组`);
      void loadList(true);
      void loadGroupCounts();
    } catch (error) {
      logger.error('二面分配失败', error);
      toast.error('二面分配失败，请重试');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

   const totalPages = useMemo(
     () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
     [total],
   );

    const getGroupCount = (groupName: string): number => {
      const g = groupCounts.find((item: GroupCountInfo) => item.groupName === groupName);
      return g?.waiting ?? 0;
    };

    const getNextWaiting = (groupName: string | null): GroupCountInfo['nextWaiting'] => {
      if (!groupName) return null;
      const g = groupCounts.find((item: GroupCountInfo) => item.groupName === groupName);
      return g?.nextWaiting ?? null;
    };

   const minGroupCount = useMemo(() => {
     if (groupCounts.length === 0) return 0;
     return Math.min(...groupCounts.map((g: GroupCountInfo) => g.waiting));
   }, [groupCounts]);

   const isRecommendedGroup = (groupName: string): boolean => {
     if (groupCounts.length === 0) return false;
     const count = getGroupCount(groupName);
     const minGroups = groupCounts
       .filter((g: GroupCountInfo) => g.waiting === minGroupCount)
       .map((g: GroupCountInfo) => g.groupName);
     return minGroups.includes(groupName) && minGroups.length <= 2;
   };


  // --- Load list ---
  const loadList = useCallback(async (isSilent = false) => {
    // 静默刷新（定时轮询）时不显示loading，避免页面闪烁和滚动位置丢失
    if (!isSilent) setLoading(true);
    try {
      const params: {
        keyword?: string;
        status?: string;
        groupName?: string;
        page: number;
        pageSize: number;
      } = {
        page,
        pageSize: PAGE_SIZE,
      };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (statusFilter === 'pre_registered') {
        params.status = 'pre_registered';
      } else if (statusFilter === 'checked_in') {
        // Filter out pre_registered on client side since API has no "not equal"
        // We'll fetch all and filter below
      }

      if (interviewStatusFilter !== 'all') {
        params.status = interviewStatusFilter;
      }
      // 选择"全部"时显示所有状态，后端三级排序：待操作→未签到→已完成
      if (groupFilter === 'none') {
        // Empty group - no param, we filter client side
      } else if (groupFilter !== 'all') {
        params.groupName = groupFilter;
      }

      const res = await candidates.searchCandidates({
        ...params,
        sortBy: 'globalNumber',
        sortOrder: 'asc',
      });

      let filteredItems: Candidate[] = res.items;

      if (statusFilter === 'checked_in') {
        filteredItems = filteredItems.filter(
          (item: Candidate) => item.status !== 'pre_registered',
        );
      }

      if (groupFilter === 'none') {
        filteredItems = filteredItems.filter(
          (item: Candidate) => !item.groupName,
        );
      }

      setItems(filteredItems);
      setTotal(res.total);
    } catch (error) {
      logger.error('加载考生列表失败', error);
      toast.error('加载列表失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, groupFilter, interviewStatusFilter, page]);

   useEffect(() => {
     void loadList();
   }, [loadList]);

   // --- Load group counts ---
   const loadGroupCounts = useCallback(async () => {
     try {
       const counts = await candidates.getGroupCounts();
       setGroupCounts(counts);
     } catch (error) {
       logger.error('加载分组人数失败', error);
     }
   }, []);

   useEffect(() => {
     void loadGroupCounts();
   }, [loadGroupCounts]);

     useEffect(() => {
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const startPolling = () => {
        if (intervalId) return;
        intervalId = setInterval(() => {
          // 定时静默刷新，只更新数据，不显示loading，保持页面状态和滚动位置
          void loadList(true);
          void loadGroupCounts();
        }, REFRESH_INTERVAL);
      };

      const stopPolling = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      // 页面可见时才轮询，隐藏时暂停，减少D1读取
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          startPolling();
        } else {
          stopPolling();
        }
      };

      startPolling();
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [loadList, loadGroupCounts]);

  // --- Handlers ---
  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const handleGroupChange = (value: string) => {
    setGroupFilter(value as GroupFilter);
    setPage(1);
  };

  const handleInterviewStatusChange = (value: string) => {
    setInterviewStatusFilter(value as InterviewStatusFilter);
    setPage(1);
  };

  const handleRefresh = () => {
    void loadList();
    void loadGroupCounts();
  };

  // --- Check in ---
  const handleCheckIn = async (candidateId: string) => {
    try {
       await candidates.checkInById(candidateId, session?.name);
       toast.success('签到成功');
       void loadList(true);
       void loadGroupCounts();
    } catch (error) {
      logger.error('签到失败', error);
      toast.error('签到失败，请重试');
    }
  };

  // --- Assign group ---
  const handleAssignGroup = async (
    candidateId: string,
    groupName: GroupName,
  ) => {
    try {
       await candidates.assignGroup(candidateId, groupName, session?.name);
       toast.success(`已分配到 ${groupName} 组`);
       void loadList(true);
       void loadGroupCounts();
    } catch (error) {
      logger.error('分配组别失败', error);
      toast.error('分配组别失败，请重试');
    }
  };

  // --- Reassign group ---
  const openReassignDialog = (candidate: Candidate) => {
    setReassignCandidate(candidate);
    setReassignGroup((candidate.groupName as GroupName) || 'A');
    setReassignDialogOpen(true);
  };

  const handleReassignConfirm = async () => {
    if (!reassignCandidate) return;
    setReassignSubmitting(true);
    try {
      await candidates.reassignGroup(reassignCandidate.id, reassignGroup, session?.name);
       toast.success(`已改派到 ${reassignGroup} 组`);
       setReassignDialogOpen(false);
       setReassignCandidate(null);
       void loadList(true);
       void loadGroupCounts();
    } catch (error) {
      logger.error('改派组别失败', error);
      toast.error('改派失败，请重试');
    } finally {
      setReassignSubmitting(false);
    }
  };

  // --- Check-in dialog: search ---
  const performCheckInSearch = useCallback(
    debounce(async (kw: string) => {
      if (!kw.trim()) {
        setCheckInSearchResults([]);
        setCheckInSearching(false);
        return;
      }
      setCheckInSearching(true);
      try {
        const res = await candidates.searchCandidates({
          keyword: kw.trim(),
          pageSize: 20,
        });
        setCheckInSearchResults(res.items);
      } catch (error) {
        logger.error('签到搜索考生失败', error);
        setCheckInSearchResults([]);
      } finally {
        setCheckInSearching(false);
      }
    }, 300),
    [],
  );

  const handleCheckInSearchChange = (value: string) => {
    setCheckInSearchInput(value);
    setSelectedCandidate(null);
    if (checkInMode === 'manual') {
      setCheckInMode('search');
    }
    void performCheckInSearch(value);
  };

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setCheckInSearchResults([]);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedCandidate) return;
    setCheckInSubmitting(true);
    try {
      await candidates.checkInById(selectedCandidate.id, session?.name);
      toast.success(`${selectedCandidate.name} 签到成功`);
      closeCheckInDialog();
      void loadList(true);
      void loadGroupCounts();
    } catch (error) {
      logger.error('签到失败', error);
      toast.error('签到失败，请重试');
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const switchToManualMode = () => {
    setCheckInMode('manual');
    setCheckInSearchResults([]);
    setSelectedCandidate(null);
    setManualForm({
      ...emptyManualForm,
      name: checkInSearchInput.trim(),
    });
  };

  // --- Check-in dialog: manual register ---
  const handleManualCheckInSubmit = async () => {
    if (!manualForm.name.trim()) {
      toast.error('请输入姓名');
      return;
    }
    if (!manualForm.gender) {
      toast.error('请选择性别');
      return;
    }
    if (!manualForm.className.trim()) {
      toast.error('请输入班级');
      return;
    }
    if (!manualForm.phone.trim()) {
      toast.error('请输入联系电话');
      return;
    }
    if (!manualForm.department) {
      toast.error('请选择意向部门');
      return;
    }
    if (!manualForm.acceptAdjust) {
      toast.error('请选择是否服从调剂');
      return;
    }

    setCheckInSubmitting(true);
    try {
      const body: PreRegisterCreateRequest = {
        name: manualForm.name.trim(),
        gender: manualForm.gender,
        className: manualForm.className.trim(),
        phone: manualForm.phone.trim(),
        firstDepartment: manualForm.department,
        secondDepartment: manualForm.department,
        acceptAdjust: manualForm.acceptAdjust,
      };
      const created = await candidates.createPreRegister(body);
      await candidates.checkInById(created.id, session?.name);
      toast.success(`${manualForm.name} 登记并签到成功`);
      closeCheckInDialog();
      void loadList(true);
      void loadGroupCounts();
    } catch (error) {
      logger.error('手动登记签到失败', error);
      toast.error('登记签到失败，请重试');
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const openCheckInDialog = () => {
    if (!canOperateFlow) {
      toast.error('无权限操作，仅管理员和流动人员可执行');
      return;
    }
    setCheckInMode('search');
    setCheckInSearchInput('');
    setCheckInSearchResults([]);
    setSelectedCandidate(null);
    setManualForm(emptyManualForm);
    setCheckInDialogOpen(true);
  };

  const closeCheckInDialog = () => {
    setCheckInDialogOpen(false);
    setCheckInSearchInput('');
    setCheckInSearchResults([]);
    setSelectedCandidate(null);
    setManualForm(emptyManualForm);
    setCheckInMode('search');
  };

  // --- Manual add ---
  const handleManualAddSubmit = async () => {
    if (!manualAddForm.name.trim()) {
      toast.error('请输入姓名');
      return;
    }
    if (!manualAddForm.gender) {
      toast.error('请选择性别');
      return;
    }
    if (!manualAddForm.className.trim()) {
      toast.error('请输入班级');
      return;
    }
    if (!manualAddForm.phone.trim()) {
      toast.error('请输入手机号');
      return;
    }
    if (!manualAddForm.firstDepartment) {
      toast.error('请选择第一意向部门');
      return;
    }
    if (!manualAddForm.acceptAdjust) {
      toast.error('请选择是否服从调剂');
      return;
    }

    setManualAddSubmitting(true);
    try {
      const secondDept = manualAddForm.secondDepartment || manualAddForm.firstDepartment;
      const body: PreRegisterCreateRequest = {
        name: manualAddForm.name.trim(),
        gender: manualAddForm.gender,
        className: manualAddForm.className.trim(),
        phone: manualAddForm.phone.trim(),
        firstDepartment: manualAddForm.firstDepartment,
        secondDepartment: secondDept,
        acceptAdjust: manualAddForm.acceptAdjust,
      };
      await candidates.createPreRegister(body);
      toast.success(`${manualAddForm.name} 添加成功，已进入待分配队列`);
      setManualAddDialogOpen(false);
      setManualAddForm(emptyManualAddForm);
      void loadList(true);
      void loadGroupCounts();
    } catch (error) {
      logger.error('手动添加失败', error);
      toast.error('添加失败，请重试');
    } finally {
      setManualAddSubmitting(false);
    }
  };

  const openManualAddDialog = () => {
    if (!canOperateFlow) {
      toast.error('无权限操作，仅管理员和流动人员可执行');
      return;
    }
    setManualAddForm(emptyManualAddForm);
    setManualAddDialogOpen(true);
  };

  const closeManualAddDialog = () => {
    setManualAddDialogOpen(false);
    setManualAddForm(emptyManualAddForm);
  };

  // --- CSV import ---
  const handleImportCsv = () => {
    if (!isAdmin) {
      toast.error('无权限操作，仅管理员可执行');
      return;
    }
    fileInputRef.current?.click();
  };

  const parseCsvRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim() !== '');
      if (lines.length === 0) {
        toast.error('CSV 文件为空');
        return;
      }

      const headerRow = parseCsvRow(lines[0]);
      const headerMap = new Map<string, number>();
      headerRow.forEach((h: string, idx: number) => {
        headerMap.set(h.trim(), idx);
      });

      const findIdx = (names: string[]): number => {
        for (const name of names) {
          if (headerMap.has(name)) return headerMap.get(name)!;
        }
        return -1;
      };

      const nameIdx = findIdx(['姓名', 'name', 'Name']);
      const genderIdx = findIdx(['性别', 'gender', 'Gender']);
      const classIdx = findIdx(['班级', 'className', '班级名称']);
      const phoneIdx = findIdx(['联系电话', '电话', '手机', 'phone', 'Phone']);
      const firstDeptIdx = findIdx([
        '第一意向部门',
        '意向部门',
        'firstDepartment',
      ]);
      const secondDeptIdx = findIdx([
        '第二意向部门',
        'secondDepartment',
      ]);
      const acceptAdjustIdx = findIdx([
        '是否服从调剂',
        '服从调剂',
        'acceptAdjust',
      ]);

      const importItems: PreRegisterCreateRequest[] = [];
      for (let i = 1; i < lines.length; i += 1) {
        const cells = parseCsvRow(lines[i]);
        const name = nameIdx >= 0 ? cells[nameIdx]?.trim() : '';
        if (!name) continue;

        const item: PreRegisterCreateRequest = { name };
        if (genderIdx >= 0 && cells[genderIdx])
          item.gender = cells[genderIdx].trim();
        if (classIdx >= 0 && cells[classIdx])
          item.className = cells[classIdx].trim();
        if (phoneIdx >= 0 && cells[phoneIdx])
          item.phone = cells[phoneIdx].trim();
        if (firstDeptIdx >= 0 && cells[firstDeptIdx])
          item.firstDepartment = cells[firstDeptIdx].trim();
        if (secondDeptIdx >= 0 && cells[secondDeptIdx])
          item.secondDepartment = cells[secondDeptIdx].trim();
        if (acceptAdjustIdx >= 0 && cells[acceptAdjustIdx]) {
          const val = cells[acceptAdjustIdx].trim();
          item.acceptAdjust = val === '是' ? '是' : '否';
        }

        importItems.push(item);
      }

      if (importItems.length === 0) {
        toast.error('未解析到有效数据');
        return;
      }

      const result: BatchImportResponse =
        await candidates.batchImportCandidates(importItems, session?.name);
      toast.success(`成功导入 ${result.success} 条，失败 ${result.failed} 条`);
      if (result.errors.length > 0) {
        logger.warn('CSV 导入部分失败', result.errors);
      }
      void loadList(true);
    } catch (error) {
      logger.error('CSV 导入失败', error);
      toast.error('导入失败，请重试');
    } finally {
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Render helpers ---
  const renderStatusBadge = (status: string) => {
    const isCheckedIn = status !== 'pre_registered';
    if (isCheckedIn) {
      return (
        <Badge
          variant="secondary"
          className="bg-emerald-500/15 text-emerald-700 border-emerald-200"
        >
          已签到
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="bg-slate-500/15 text-slate-700 border-slate-200"
      >
        未签到
      </Badge>
    );
  };

  const renderInterviewStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pre_registered: {
        label: '未签到',
        className: 'bg-slate-100 text-slate-600 border-slate-200',
      },
      waiting: {
        label: '待面试',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
      },
      interviewing: {
        label: '面试中',
        className: 'bg-amber-100 text-amber-700 border-amber-200',
      },
       pending_approval: {
         label: '待审批',
         className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
       },
       first_completed: {
         label: '等待二面签到',
         className: 'bg-green-100 text-green-700 border-green-200',
       },
       completed: {
         label: '等待二面签到',
         className: 'bg-green-100 text-green-700 border-green-200',
       },
       second_waiting: {
         label: '二面待分配',
         className: 'bg-blue-100 text-blue-700 border-blue-200',
       },
       second_interviewing: {
         label: '二面中',
         className: 'bg-purple-100 text-purple-700 border-purple-200',
       },
       final_admitted: {
         label: '录取',
         className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
       },
       final_rejected: {
         label: '淘汰',
         className: 'bg-red-100 text-red-700 border-red-200',
       },
       completed: {
         label: '已完成',
         className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
       },
     };
    const info = map[status] ?? map.pre_registered;
    return (
      <Badge variant="outline" className={info.className}>
        {info.label}
      </Badge>
    );
  };

  const renderGroupBadge = (groupName: string | null) => {
    if (!groupName) {
      return (
        <Badge
          variant="outline"
          className="text-slate-500"
        >
          未分配
        </Badge>
      );
    }
    return <Badge variant="default">{groupName}组</Badge>;
  };

  const renderActions = (candidate: Candidate) => {
    if (candidate.status === 'pre_registered') {
      return (
        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
          待签到
        </Badge>
      );
    }

     if (candidate.status === 'waiting' && !candidate.groupName) {
       return (
         <div className="flex gap-1">
           {GROUP_OPTIONS.map((g: GroupName) => {
             const count = getGroupCount(g);
             const recommended = isRecommendedGroup(g);
             const color = GROUP_COLORS[g];
             return (
               <TooltipProvider key={g}>
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button
                       size="sm"
                       onClick={() => handleAssignGroup(candidate.id, g)}
                       aria-label={`分配 ${candidate.name} 到 ${g} 组，当前${count}人待面试`}
                       className={`min-w-14 px-2 text-white font-semibold ${color.bg} ${color.hover} ${recommended ? 'ring-2 ring-offset-1 ring-yellow-400' : ''}`}
                       disabled={!canOperateFlow}
                     >
                       {g}({count})
                     </Button>
                   </TooltipTrigger>
                   <TooltipContent>
                     <p>{g}组当前 {count} 人待面试{recommended ? ' · 推荐' : ''}</p>
                   </TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             );
           })}
         </div>
       );
     }

     if (candidate.status !== 'waiting' && !candidate.groupName) {
       return renderInterviewStatusBadge(candidate.status);
     }

    if (candidate.groupName && candidate.status === 'waiting') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {candidate.groupName}组 · {candidate.groupNumber || '-'}号
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openReassignDialog(candidate)}
            aria-label={`改派 ${candidate.name} 的组别`}
            disabled={!canOperateFlow}
          >
            <ArrowRightLeft className="h-3 w-3" />
            改派
          </Button>
        </div>
      );
    }

    if (candidate.groupName && candidate.status === 'pending_approval') {
      const next = getNextWaiting(candidate.groupName);
      return (
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {candidate.groupName}组 · {candidate.groupNumber || '-'}号
            </span>
            {renderInterviewStatusBadge(candidate.status)}
            {canOperateFlow && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                onClick={() => handleApprove(candidate.id)}
                aria-label={`审批通过 ${candidate.name}`}
              >
                <Check className="h-3 w-3" />
                审批通过
              </Button>
            )}
          </div>
          <div className="text-xs flex items-center gap-1">
            <span className="text-slate-400">下一位：</span>
            {next ? (
              <span className="text-sky-600 font-medium">
                {next.globalNumber?.toString().padStart(3, '0') ?? '-'} {next.name}
              </span>
            ) : (
              <span className="text-slate-400">该组队列已空</span>
            )}
          </div>
        </div>
      );
    }

    // 一面完成 → 二面签到
    if (candidate.status === 'first_completed' || candidate.status === 'completed') {
      return (
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">等待二面签到</span>
            {renderInterviewStatusBadge(candidate.status)}
            {canOperateFlow && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 gap-1"
                onClick={() => handleMoveToSecond(candidate.id)}
                aria-label={`二面签到 ${candidate.name}`}
              >
                <ArrowRight className="h-3 w-3" />
                二面签到
              </Button>
            )}
          </div>
        </div>
      );
    }

    // 二面待分配 → 分配E/F组
    if (candidate.status === 'second_waiting') {
      return (
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">二面待分配</span>
            {renderInterviewStatusBadge(candidate.status)}
            {canOperateFlow && (
              <>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 gap-1"
                  onClick={() => handleAssignSecondGroup(candidate.id, 'E')}
                  aria-label={`分配到E组 ${candidate.name}`}
                >
                  E组
                </Button>
                <Button
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700 gap-1"
                  onClick={() => handleAssignSecondGroup(candidate.id, 'F')}
                  aria-label={`分配到F组 ${candidate.name}`}
                >
                  F组
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (candidate.groupName && candidate.status !== 'waiting') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {candidate.groupName}组 · {candidate.groupNumber || '-'}号
          </span>
          {renderInterviewStatusBadge(candidate.status)}
        </div>
      );
    }

    return <span className="text-slate-400 text-sm">-</span>;
  };

  // --- Pagination render ---
  const renderPagination = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);
    for (let i = startPage; i <= endPage; i += 1) {
      pages.push(i);
    }

    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (page > 1) setPage(page - 1);
              }}
              aria-disabled={page === 1}
              className={page === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {pages.map((p: number) => (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === page}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setPage(p);
                }}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (page < totalPages) setPage(page + 1);
              }}
              aria-disabled={page === totalPages}
              className={
                page === totalPages ? 'pointer-events-none opacity-50' : ''
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

   return (
     <div className="p-4 md:p-6 space-y-4">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
         <h2 className="text-xl md:text-2xl font-bold text-slate-900">签到分流台</h2>
         {role === 'interviewer' && (
           <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700 text-sm">
             <Eye className="h-4 w-4" />
             查看模式，仅管理员和流动人员可操作
           </div>
         )}
         {role === 'floating' && (
           <div className="flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-sky-700 text-sm">
             <ArrowRightLeft className="h-4 w-4" />
             流动人员模式：可签到/派号/改派
           </div>
         )}
       </div>

       {/* Top action bar */}
       <div className="flex flex-col sm:flex-row sm:items-center gap-3">
         <div className="relative flex-1 min-w-0 max-w-md">
           <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
           <Input
              placeholder="搜索姓名、班级、手机号..."
             value={searchInput}
             onChange={(e) => setSearchInput(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') handleSearch();
             }}
             className="pl-9"
           />
         </div>
          <div className="hidden md:flex items-center gap-2">
             <Button variant="default" onClick={openManualAddDialog} disabled={!canOperateFlow}>
               <UserPlus className="h-4 w-4" />
               手动添加
             </Button>
             <Button variant="outline" onClick={handleImportCsv} disabled={!isAdmin}>
               <Upload className="h-4 w-4" />
               导入CSV
             </Button>
             <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
              手动刷新
            </Button>
          </div>
         <div className="flex md:hidden items-center gap-2">
           <Button variant="outline" onClick={handleRefresh} size="sm">
             <RefreshCw className="h-4 w-4" />
             刷新
           </Button>
         </div>
         <input
           ref={fileInputRef}
           type="file"
           accept=".csv"
           className="hidden"
           onChange={handleFileSelected}
         />
       </div>

       {/* Filter bar */}
       <div className="flex flex-wrap items-center gap-2 md:gap-4">
         <div className="flex items-center gap-2 flex-1 min-w-[120px]">
           <Label className="text-sm text-slate-600 whitespace-nowrap">签到：</Label>
           <Select value={statusFilter} onValueChange={handleStatusChange}>
             <SelectTrigger className="w-full min-w-0">
               <SelectValue placeholder="全部" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">全部</SelectItem>
               <SelectItem value="pre_registered">未签到</SelectItem>
               <SelectItem value="checked_in">已签到</SelectItem>
             </SelectContent>
           </Select>
         </div>
         <div className="flex items-center gap-2 flex-1 min-w-[120px]">
           <Label className="text-sm text-slate-600 whitespace-nowrap">组别：</Label>
           <Select value={groupFilter} onValueChange={handleGroupChange}>
             <SelectTrigger className="w-full min-w-0">
               <SelectValue placeholder="全部" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">全部</SelectItem>
               <SelectItem value="A">A组</SelectItem>
               <SelectItem value="B">B组</SelectItem>
               <SelectItem value="C">C组</SelectItem>
               <SelectItem value="D">D组</SelectItem>
               <SelectItem value="none">未分组</SelectItem>
             </SelectContent>
           </Select>
         </div>
         <div className="flex items-center gap-2 flex-1 min-w-[120px]">
           <Label className="text-sm text-slate-600 whitespace-nowrap">面试：</Label>
           <Select
             value={interviewStatusFilter}
             onValueChange={handleInterviewStatusChange}
           >
             <SelectTrigger className="w-full min-w-0">
               <SelectValue placeholder="全部" />
             </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="waiting">待面试</SelectItem>
                <SelectItem value="interviewing">面试中</SelectItem>
                <SelectItem value="pending_approval">待审批</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
           </Select>
         </div>
       </div>

       {/* 四组人数概览条 */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-wrap">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            各组待面试人数
          </span>
          {GROUP_OPTIONS.map((g: GroupName) => {
            const count = getGroupCount(g);
            const recommended = isRecommendedGroup(g);
            return (
              <span
                key={g}
                className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded ${
                  recommended
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
                title={recommended ? `${g}组当前${count}人待面试（推荐分配）` : `${g}组当前${count}人待面试`}
              >
                <span>{g}组</span>
                <span className={recommended ? 'text-emerald-600' : 'text-slate-500'}>
                  {count}
                </span>
                {recommended && (
                  <span className="text-xs font-normal text-emerald-600">· 推荐</span>
                )}
              </span>
            );
          })}
        </div>

       {/* Table - 仅桌面端 */}
       <div className="hidden md:block rounded-md border bg-white overflow-x-auto">
         <Table>
           <TableHeader>
              <TableRow>
                <TableHead className="w-16">全场序号</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>性别</TableHead>
                <TableHead>班级</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>签到状态</TableHead>
                <TableHead>分配组别</TableHead>
                <TableHead className="w-20">组内序号</TableHead>
                <TableHead>面试状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
           </TableHeader>
           <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                      colSpan={10}
                      className="text-center py-8 text-slate-400"
                    >
                      加载中...
                    </TableCell>
                </TableRow>
              )}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell
                      colSpan={10}
                      className="text-center py-8 text-slate-400"
                    >
                      暂无数据
                    </TableCell>
                </TableRow>
              )}
              {!loading &&
                items.map((item: Candidate) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-slate-500 font-mono">
                      {item.globalNumber ?? '-'}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.gender || '-'}</TableCell>
                    <TableCell>{item.className || '-'}</TableCell>
                    <TableCell>{item.phone || '-'}</TableCell>
                    <TableCell>{renderStatusBadge(item.status)}</TableCell>
                    <TableCell>{renderGroupBadge(item.groupName)}</TableCell>
                    <TableCell className="font-mono">
                      {item.groupNumber || '-'}
                    </TableCell>
                    <TableCell>{renderInterviewStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        {renderActions(item)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
           </TableBody>
         </Table>
       </div>

      {/* Mobile card list - 手机端 */}
      <div className="md:hidden space-y-3">
        {loading && (
          <div className="text-center py-8 text-slate-400">加载中...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center py-8 text-slate-400">暂无数据</div>
        )}
        {!loading &&
          items.map((item: Candidate) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-lg p-3 space-y-2"
            >
               <div className="flex items-start justify-between gap-2">
                 <div className="flex items-center gap-2">
                   {item.globalNumber && (
                     <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                       #{item.globalNumber}
                     </span>
                   )}
                   <span className="text-lg font-bold text-slate-900">
                     {item.name}
                   </span>
                 </div>
                 {renderInterviewStatusBadge(item.status)}
               </div>
               <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                 <span className="flex items-center gap-1">
                   <Users className="h-3 w-3" />
                   {item.gender || '未填写'}
                 </span>
                 <span className="flex items-center gap-1">
                   <GraduationCap className="h-3 w-3" />
                   {item.className || '未填写'}
                 </span>
                 <span className="flex items-center gap-1">
                   <Phone className="h-3 w-3" />
                   {item.phone || '未填写'}
                 </span>
               </div>
              {/* 手机端操作区 */}
              <div className="pt-2 border-t border-slate-100">
                 {item.status === 'pre_registered' && (
                   <div className="text-center text-xs text-slate-400 py-2">
                     待签到 · 请到首页完成签到
                   </div>
                 )}
                {item.status === 'waiting' && !item.groupName && (
                    <div className="grid grid-cols-2 gap-2">
                      {GROUP_OPTIONS.map((g: GroupName) => {
                        const count = getGroupCount(g);
                        const recommended = isRecommendedGroup(g);
                        return (
                          <Button
                            key={g}
                            variant={recommended ? 'default' : 'outline'}
                            className={`h-14 flex flex-col gap-0.5 ${recommended ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                            onClick={() => handleAssignGroup(item.id, g)}
                            disabled={!canOperateFlow}
                          >
                            <span className="text-base font-semibold leading-tight">
                              {g}组
                            </span>
                            <span className="text-xs opacity-80 leading-tight">
                              {count}人待面{recommended ? ' · 推荐' : ''}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  {item.status !== 'waiting' && !item.groupName && item.status !== 'pre_registered' && (
                    <div className="flex justify-center py-1">
                      {renderInterviewStatusBadge(item.status)}
                    </div>
                  )}
                 {item.groupName && item.status === 'waiting' && (
                   <div className="flex items-center justify-between">
                     <span className="text-sm text-slate-600">
                       {item.groupName}组 · <span className="font-medium">{item.groupNumber || '-'}</span>号
                     </span>
                     <Button
                       variant="outline"
                       size="sm"
                       className="h-9"
                       onClick={() => openReassignDialog(item)}
                       disabled={!canOperateFlow}
                     >
                       <ArrowRightLeft className="h-4 w-4" />
                       改派
                     </Button>
                   </div>
                 )}
                  {item.groupName && item.status === 'pending_approval' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">
                          {item.groupName}组 · <span className="font-medium">{item.groupNumber || '-'}</span>号
                        </span>
                        {renderInterviewStatusBadge(item.status)}
                      </div>
                      <div className="text-xs flex items-center gap-1">
                        <span className="text-slate-400">下一位：</span>
                        {getNextWaiting(item.groupName) ? (
                          <span className="text-sky-600 font-medium">
                            {getNextWaiting(item.groupName)?.globalNumber?.toString().padStart(3, '0') ?? '-'} {getNextWaiting(item.groupName)?.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">该组队列已空</span>
                        )}
                      </div>
                      {canOperateFlow && (
                        <Button
                          size="sm"
                          className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => handleApprove(item.id)}
                        >
                          <Check className="h-4 w-4" />
                          审批通过
                        </Button>
                      )}
                    </div>
                  )}
                  {item.groupName && item.status !== 'waiting' && item.status !== 'pending_approval' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {item.groupName}组 · <span className="font-medium">{item.groupNumber || '-'}</span>号
                      </span>
                      {renderInterviewStatusBadge(item.status)}
                    </div>
                  )}
                 {!canOperateFlow && item.status === 'waiting' && !item.groupName && (
                   <div className="text-center text-xs text-slate-400 py-1">
                     仅管理员和流动人员可操作
                   </div>
                 )}
              </div>
            </div>
          ))}
      </div>

      {/* Pagination */}
      {!loading && items.length > 0 && renderPagination()}

      {/* Dialog: 签到登记 */}
      <Dialog open={checkInDialogOpen} onOpenChange={closeCheckInDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>签到登记</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 搜索输入框 */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={checkInSearchInput}
                onChange={(e) => handleCheckInSearchChange(e.target.value)}
                placeholder="输入姓名搜索预报名考生..."
                className="pl-12 pr-10 h-12 text-lg text-base"
                autoFocus
              />
              {checkInSearchInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-600"
                  onClick={() => {
                    setCheckInSearchInput('');
                    setCheckInSearchResults([]);
                    setSelectedCandidate(null);
                    setCheckInMode('search');
                  }}
                  aria-label="清空搜索"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* 搜索模式 */}
            {checkInMode === 'search' && (
              <>
                {/* 搜索结果下拉 */}
                {checkInSearching && (
                  <div className="text-center text-sm text-slate-400 py-2">
                    搜索中...
                  </div>
                )}

                {!checkInSearching &&
                  checkInSearchInput.trim() &&
                  checkInSearchResults.length > 0 &&
                  !selectedCandidate && (
                    <div
                      ref={searchDropdownRef}
                      className="max-h-64 overflow-y-auto border border-slate-200 rounded-md bg-white shadow-sm"
                    >
                      {checkInSearchResults.map((c: Candidate) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
                          onClick={() => handleSelectCandidate(c)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">
                              {c.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {c.gender || '性别未填'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>{c.className || '班级未填'}</span>
                            <span>{c.phone || '电话未填'}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            意向：{c.firstDepartment || '—'}
                            {c.secondDepartment && c.secondDepartment !== c.firstDepartment
                              ? ` / ${c.secondDepartment}`
                              : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                {/* 无搜索结果 */}
                {!checkInSearching &&
                  checkInSearchInput.trim() &&
                  checkInSearchResults.length === 0 &&
                  !selectedCandidate && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          未找到预报名信息，请确认姓名是否正确，或手动登记。
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={switchToManualMode}
                      >
                        未找到，手动登记
                      </Button>
                    </div>
                  )}

                {/* 已选中考生信息卡 */}
                {selectedCandidate && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-emerald-800 font-medium">
                        已识别到预报名信息
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs mb-0.5">姓名</div>
                          <div className="font-medium text-slate-900">
                            {selectedCandidate.name}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-0.5">性别</div>
                          <div className="text-slate-900">
                            {selectedCandidate.gender || '未填写'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-0.5">班级</div>
                          <div className="text-slate-900">
                            {selectedCandidate.className || '未填写'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-0.5">手机号</div>
                          <div className="text-slate-900">
                            {selectedCandidate.phone || '未填写'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-0.5">
                            第一意向部门
                          </div>
                          <div className="text-slate-900">
                            {selectedCandidate.firstDepartment || '未填写'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-0.5">
                            第二意向部门
                          </div>
                          <div className="text-slate-900">
                            {selectedCandidate.secondDepartment || '未填写'}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-slate-500 text-xs mb-0.5">
                            是否服从调剂
                          </div>
                          <div className="text-slate-900">
                            {selectedCandidate.acceptAdjust || '未填写'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-base"
                      onClick={handleConfirmCheckIn}
                      disabled={checkInSubmitting}
                    >
                      <Check className="h-5 w-5" />
                      {checkInSubmitting ? '签到中...' : '确认签到'}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* 手动登记模式 */}
            {checkInMode === 'manual' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2.5">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    未找到预报名信息，请填写完整信息登记
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-name">
                      姓名 <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="manual-name"
                      value={manualForm.name}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="请输入姓名"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-gender">
                        性别 <span className="text-rose-500">*</span>
                      </Label>
                      <Select
                        value={manualForm.gender}
                        onValueChange={(value) =>
                          setManualForm((prev) => ({
                            ...prev,
                            gender: value,
                          }))
                        }
                      >
                        <SelectTrigger id="manual-gender">
                          <SelectValue placeholder="请选择" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="男">男</SelectItem>
                          <SelectItem value="女">女</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-class">
                        班级 <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="manual-class"
                        value={manualForm.className}
                        onChange={(e) =>
                          setManualForm((prev) => ({
                            ...prev,
                            className: e.target.value,
                          }))
                        }
                        placeholder="请输入班级"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-phone">
                      联系电话 <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="manual-phone"
                      value={manualForm.phone}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="请输入联系电话"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-department">
                      意向部门 <span className="text-rose-500">*</span>
                    </Label>
                    <Select
                      value={manualForm.department}
                      onValueChange={(value) =>
                        setManualForm((prev) => ({
                          ...prev,
                          department: value,
                        }))
                      }
                    >
                      <SelectTrigger id="manual-department">
                        <SelectValue placeholder="请选择意向部门" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((dept: string) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-adjust">
                      是否服从调剂 <span className="text-rose-500">*</span>
                    </Label>
                    <Select
                      value={manualForm.acceptAdjust}
                      onValueChange={(value) =>
                        setManualForm((prev) => ({
                          ...prev,
                          acceptAdjust: value,
                        }))
                      }
                    >
                      <SelectTrigger id="manual-adjust">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="是">是</SelectItem>
                        <SelectItem value="否">否</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-base"
                  onClick={handleManualCheckInSubmit}
                  disabled={checkInSubmitting}
                >
                  {checkInSubmitting ? '提交中...' : '确认签到并登记'}
                </Button>

                <button
                  type="button"
                  className="w-full text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                  onClick={() => setCheckInMode('search')}
                >
                  返回搜索
                </button>
              </div>
            )}
          </div>

          {checkInMode === 'search' && !selectedCandidate && checkInSearchResults.length === 0 && !checkInSearchInput.trim() && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeCheckInDialog}
              >
                取消
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: 手动添加面试者 */}
      <Dialog
        open={manualAddDialogOpen}
        onOpenChange={setManualAddDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>手动添加面试者</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-add-name">
                  姓名 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="manual-add-name"
                  value={manualAddForm.name}
                  onChange={(e) =>
                    setManualAddForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="请输入姓名"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-add-gender">
                    性别 <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={manualAddForm.gender}
                    onValueChange={(value) =>
                      setManualAddForm((prev) => ({
                        ...prev,
                        gender: value,
                      }))
                    }
                  >
                    <SelectTrigger id="manual-add-gender">
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-add-class">
                    班级 <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="manual-add-class"
                    value={manualAddForm.className}
                    onChange={(e) =>
                      setManualAddForm((prev) => ({
                        ...prev,
                        className: e.target.value,
                      }))
                    }
                    placeholder="请输入班级"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-add-phone">
                  手机号 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="manual-add-phone"
                  value={manualAddForm.phone}
                  onChange={(e) =>
                    setManualAddForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="请输入手机号"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-add-first-dept">
                  第一意向部门 <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={manualAddForm.firstDepartment}
                  onValueChange={(value) =>
                    setManualAddForm((prev) => ({
                      ...prev,
                      firstDepartment: value,
                    }))
                  }
                >
                  <SelectTrigger id="manual-add-first-dept">
                    <SelectValue placeholder="请选择第一意向部门" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map((dept: string) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-add-second-dept">
                  第二意向部门
                </Label>
                <Select
                  value={manualAddForm.secondDepartment}
                  onValueChange={(value) =>
                    setManualAddForm((prev) => ({
                      ...prev,
                      secondDepartment: value,
                    }))
                  }
                >
                  <SelectTrigger id="manual-add-second-dept">
                    <SelectValue placeholder="同第一意向" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map((dept: string) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-add-adjust">
                  是否服从调剂 <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={manualAddForm.acceptAdjust}
                  onValueChange={(value) =>
                    setManualAddForm((prev) => ({
                      ...prev,
                      acceptAdjust: value,
                    }))
                  }
                >
                  <SelectTrigger id="manual-add-adjust">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="是">是</SelectItem>
                    <SelectItem value="否">否</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeManualAddDialog}
            >
              取消
            </Button>
            <Button
              onClick={handleManualAddSubmit}
              disabled={manualAddSubmitting}
            >
              {manualAddSubmitting ? '添加中...' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: 改派组别 */}
      <Dialog
        open={reassignDialogOpen}
        onOpenChange={setReassignDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>改派组别</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {reassignCandidate && (
              <div className="text-sm text-slate-600">
                考生：
                <span className="font-medium text-slate-900">
                  {reassignCandidate.name}
                </span>
                <span className="ml-2">
                  当前组别：{reassignCandidate.groupName}组
                </span>
              </div>
            )}
             <div className="space-y-2">
               <Label>选择新组别</Label>
               <div className="grid grid-cols-2 gap-2">
                 {GROUP_OPTIONS.map((g: GroupName) => {
                   const count = getGroupCount(g);
                   const recommended = isRecommendedGroup(g);
                   const isCurrent = reassignCandidate?.groupName === g;
                   const isSelected = reassignGroup === g;
                   const color = GROUP_COLORS[g];
                   return (
                     <Button
                       key={g}
                       type="button"
                       className={`h-12 flex flex-col gap-0.5 text-white font-semibold ${color.bg} ${color.hover} ${
                         isSelected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
                       } ${isCurrent ? 'opacity-90' : ''}`}
                       onClick={() => setReassignGroup(g)}
                     >
                       <span className="text-base font-semibold leading-tight">
                         {g}组
                         {isCurrent && <span className="text-xs ml-1 opacity-80">(当前)</span>}
                       </span>
                       <span className="text-xs opacity-90 leading-tight">
                         {count}人待面{recommended ? ' · 推荐' : ''}
                       </span>
                     </Button>
                   );
                 })}
               </div>
             </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReassignDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleReassignConfirm}
              disabled={reassignSubmitting}
            >
              {reassignSubmitting ? '改派中...' : '确定改派'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckInPage;
