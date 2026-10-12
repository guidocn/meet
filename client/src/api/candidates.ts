 import type {
    BatchImportResponse,
    BigScreenData,
    Candidate,
    CandidateListResponse,
    CheckInRequest,
    GroupCountInfo,
    InterviewerLoginRequest,
    InterviewerLoginResponse,
    PreRegisterCreateRequest,
    PreRegisterPublicRequest,
    PreRegisterRequest,
    PublicCheckInRequest,
    PublicSearchByNameRequest,
    PublicUpdateDepartmentsRequest,
    SubmitScoreRequest,
  } from '@shared/api.interface';

const BASE_URL = '/';

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(BASE_URL + url.replace(/^\//, ''), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return res.json();
}

function buildQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

export async function preRegister(body: PreRegisterRequest): Promise<Candidate> {
  return request<Candidate>('/api/candidates/pre-register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function searchCandidates(params: {
  keyword?: string;
  groupName?: string;
  status?: string;
  minScore?: number;
  maxScore?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'globalNumber' | 'score' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}): Promise<CandidateListResponse> {
  return request<CandidateListResponse>(`/api/candidates${buildQueryString(params as Record<string, unknown>)}`);
}

export async function getCandidatesStats(params: {
  groupName?: string;
  minScore?: number;
  maxScore?: number;
  keyword?: string;
}): Promise<{
  total: number;
  completed: number;
  averageScore: number;
  scoredCount: number;
}> {
  return request(`/api/candidates/stats${buildQueryString(params as Record<string, unknown>)}`);
}

export async function checkIn(body: CheckInRequest): Promise<Candidate> {
  return request<Candidate>('/api/candidates/check-in', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function checkInById(candidateId: string, operatorName?: string): Promise<Candidate> {
  return request<Candidate>('/api/candidates/check-in', {
    method: 'POST',
    body: JSON.stringify({ candidateId, operatorName }),
  });
}

export async function createPreRegister(
  body: PreRegisterCreateRequest,
): Promise<Candidate> {
  return request<Candidate>('/api/candidates/pre-register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function preRegisterPublic(
  body: PreRegisterPublicRequest,
): Promise<Candidate> {
  return request<Candidate>('/api/candidates/pre-register/public', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function searchByNamePublic(
  body: PublicSearchByNameRequest,
): Promise<Candidate[]> {
  return request<Candidate[]>('/api/candidates/public/search-by-name', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function checkInPublic(body: PublicCheckInRequest): Promise<Candidate> {
  return request<Candidate>('/api/candidates/public/check-in', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCandidateById(id: string): Promise<Candidate> {
  return request<Candidate>(`/api/candidates/public/detail/${id}`);
}

export async function updateDepartmentsPublic(
  body: PublicUpdateDepartmentsRequest,
): Promise<Candidate> {
  return request<Candidate>('/api/candidates/public/update-departments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function assignGroup(
  candidateId: string,
  groupName: string,
  operatorName?: string,
): Promise<Candidate> {
  return request<Candidate>('/api/candidates/assign-group', {
    method: 'POST',
    body: JSON.stringify({ candidateId, groupName, operatorName }),
  });
}

export async function reassignGroup(
  candidateId: string,
  groupName: string,
  operatorName?: string,
): Promise<Candidate> {
  return request<Candidate>('/api/candidates/reassign-group', {
    method: 'POST',
    body: JSON.stringify({ candidateId, groupName, operatorName }),
  });
}

export async function batchImportCandidates(
  items: PreRegisterCreateRequest[],
  operatorName?: string,
): Promise<BatchImportResponse> {
  return request<BatchImportResponse>('/api/candidates/batch-import', {
    method: 'POST',
    body: JSON.stringify({ items, operatorName }),
  });
}

export async function getGroupQueue(
  groupName: string,
  interviewerName?: string,
): Promise<Candidate[]> {
  const query = interviewerName ? buildQueryString({ interviewerName }) : '';
  return request<Candidate[]>(`/api/candidates/group/${groupName}${query}`);
}

export async function interviewerLogin(
  body: InterviewerLoginRequest,
): Promise<InterviewerLoginResponse> {
  return request<InterviewerLoginResponse>('/api/candidates/interviewer-login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateStatus(
  id: string,
  status: string,
  interviewerName?: string,
): Promise<Candidate> {
  return request<Candidate>(`/api/candidates/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, interviewerName }),
  });
}

export async function submitScore(
  id: string,
  score: number,
  interviewerName: string,
  judgeComment?: string,
): Promise<Candidate> {
  return request<Candidate>(`/api/candidates/${id}/score`, {
    method: 'POST',
    body: JSON.stringify({ score, interviewerName, judgeComment }),
  });
}

export async function approveCandidate(
  id: string,
  operatorName: string,
): Promise<Candidate> {
  return request<Candidate>(`/api/candidates/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ operatorName }),
  });
}

export async function getBigScreenData(): Promise<BigScreenData> {
  return request<BigScreenData>('/api/candidates/display/big-screen');
}

export async function getGroupCounts(): Promise<GroupCountInfo[]> {
  return request<GroupCountInfo[]>('/api/candidates/group-counts');
}


export async function exportCsvUrl(params: {
  groupName?: string;
  minScore?: number;
  maxScore?: number;
  keyword?: string;
}): Promise<string> {
  const query = new URLSearchParams();
  if (params.groupName) query.set('groupName', params.groupName);
  if (params.minScore !== undefined) query.set('minScore', String(params.minScore));
  if (params.maxScore !== undefined) query.set('maxScore', String(params.maxScore));
  if (params.keyword) query.set('keyword', params.keyword);
  return `/api/candidates/export?${query.toString()}`;
}
