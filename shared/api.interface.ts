export type CandidateStatus =
  | 'pre_registered'
  | 'waiting'
  | 'interviewing'
  | 'pending_approval'
  | 'completed'
  | 'absent';

export type GroupName = 'A' | 'B' | 'C' | 'D';

export interface InterviewerInfo {
  name: string;
  groupName: GroupName;
}

export interface InterviewerScore {
  id: string;
  interviewerName: string;
  groupName: string;
  score: number;
  judgeComment: string | null;
  createdAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  gender: string | null;
  className: string | null;
  phone: string | null;
  firstDepartment: string | null;
  secondDepartment: string | null;
  acceptAdjust: string | null;
  globalNumber: number | null;
  groupName: string | null;
  groupNumber: number | null;
  status: CandidateStatus;
  scoreTotal: number;
  averageScore: number | null;
  scoredCount: number;
  groupInterviewerCount: number;
  scores: InterviewerScore[];
  createdAt: string;
}

export interface PreRegisterRequest {
  name: string;
  gender: string;
  className: string;
  phone: string;
  firstDepartment: string;
  secondDepartment: string;
  acceptAdjust: string;
}

export interface SearchCandidatesQuery {
  keyword?: string;
  groupName?: string;
  status?: string;
  minScore?: number;
  maxScore?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'globalNumber' | 'score' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CandidateListResponse {
  items: Candidate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CheckInRequest {
  candidateId: string;
}

export interface AssignGroupRequest {
  candidateId: string;
  groupName: GroupName;
}

export interface ReassignGroupRequest {
  candidateId: string;
  groupName: GroupName;
}

export interface PreRegisterCreateRequest {
  name: string;
  gender?: string;
  className?: string;
  phone?: string;
  firstDepartment?: string;
  secondDepartment?: string;
  acceptAdjust?: string;
}

export interface PreRegisterPublicRequest {
  name: string;
  gender: string;
  className: string;
  phone: string;
  firstDepartment: string;
  secondDepartment: string;
  acceptAdjust: string;
  force?: boolean;
}

export interface PublicCheckInRequest {
  candidateId: string;
}

export interface PublicSearchByNameRequest {
  name: string;
}

export interface PublicUpdateDepartmentsRequest {
  candidateId: string;
  firstDepartment: string;
  secondDepartment?: string;
}

export interface BatchImportResponse {
  success: number;
  failed: number;
  total: number;
  errors: string[];
}

export interface InterviewerLoginRequest {
  name: string;
}

export interface InterviewerLoginResponse {
  success: boolean;
  name?: string;
  groupName?: string;
  message?: string;
  isAdmin?: boolean;
  role?: 'admin' | 'floating' | 'interviewer';
}

export interface SubmitScoreRequest {
  score: number;
  judgeComment?: string;
}

export interface GroupQueueItem {
  id: string;
  groupNumber: number;
  name: string;
  className: string | null;
  firstDepartment: string | null;
  status: CandidateStatus;
  averageScore: number | null;
  scoredCount: number;
  groupInterviewerCount: number;
  myScore: number | null;
}

export interface BigScreenGroupItem {
  globalNumber: number;
  groupNumber: number;
  status: CandidateStatus;
}

export interface BigScreenGroupData {
  groupName: string;
  current: BigScreenGroupItem | null;
  completedCount: number;
  waitingCount: number;
  waitingList: BigScreenGroupItem[];
}

export interface BigScreenData {
  groups: BigScreenGroupData[];
  totalSignedIn: number;
  totalInterviewing: number;
  totalWaiting: number;
  totalCompleted: number;
}
 
 export interface GroupCountInfo {
    groupName: string;
    total: number;
    waiting: number;
    interviewing: number;
    pendingApproval: number;
    completed: number;
    absent: number;
    nextWaiting: {
      id: string;
      name: string;
      globalNumber: number | null;
      groupNumber: number | null;
    } | null;
  }
 

export interface ResultsStats {
  total: number;
  completed: number;
  averageScore: number;
  scoredCount: number;
}
