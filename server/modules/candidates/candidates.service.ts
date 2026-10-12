import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { candidates, interviewerScores } from '@server/database/schema';
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type {
   AssignGroupRequest,
   BatchImportResponse,
   BigScreenData,
   BigScreenGroupData,
   BigScreenGroupItem,
   Candidate,
   CandidateListResponse,
   CandidateStatus,
   CheckInRequest,
   GroupCountInfo,
   GroupName,
   InterviewerInfo,
   InterviewerScore,
   InterviewerLoginResponse,
    PreRegisterCreateRequest,
    PreRegisterPublicRequest,
    PublicCheckInRequest,
    PublicSearchByNameRequest,
    ReassignGroupRequest,
   SearchCandidatesQuery,
   SubmitScoreRequest,
 } from '@shared/api.interface';

const INTERVIEWERS: InterviewerInfo[] = [
  { name: '钱金怡', groupName: 'A' },
  { name: '陈乙健', groupName: 'A' },
  { name: '杜雯', groupName: 'A' },
  { name: '黄俊杰', groupName: 'B' },
  { name: '王涛', groupName: 'B' },
  { name: '王之乔', groupName: 'B' },
  { name: '李伟盛', groupName: 'C' },
  { name: '庄煜波', groupName: 'C' },
  { name: '袁烨', groupName: 'C' },
  { name: '刘代贵', groupName: 'D' },
];

const FLOATING_STAFF: string[] = [
  '梁文燕',
  '李旭涵',
  '郑发',
  '高梓恒',
  '温嘉果',
  '冯梓珊',
  '何承熹',
];

export const ADMIN_NAME = 'guido';

export type InterviewerRole = 'admin' | 'floating' | 'interviewer';

export function getInterviewerRole(name: string): InterviewerRole {
  if (name === ADMIN_NAME) return 'admin';
  if (FLOATING_STAFF.includes(name)) return 'floating';
  return 'interviewer';
}

const VALID_STATUSES: CandidateStatus[] = [
  'pre_registered',
  'waiting',
  'interviewing',
  'pending_approval',
  'completed',
  'absent',
];

const STATUS_TRANSITIONS: Record<string, CandidateStatus[]> = {
  pre_registered: ['waiting'],
  waiting: ['interviewing', 'completed'],
  interviewing: ['pending_approval'],
  pending_approval: ['completed'],
  completed: [],
};

function mapScoreRow(
  row: typeof interviewerScores.$inferSelect,
): InterviewerScore {
  return {
    id: row.id,
    interviewerName: row.interviewerName,
    groupName: row.groupName,
    score: Number(row.score),
    judgeComment: row.judgeComment ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function getMinScoreRequired(groupName: string | null): number {
  if (groupName === 'D') return 1;
  return 2;
}

function mapRowToCandidate(
  row: typeof candidates.$inferSelect,
  scores: InterviewerScore[] = [],
): Candidate {
  const validScores = scores.filter(
    (s: InterviewerScore) => s.score !== null && s.score !== undefined,
  );
  const scoredCount = validScores.length;
  const averageScore =
    scoredCount > 0
      ? Number(
          (
            validScores.reduce((sum: number, s: InterviewerScore) => sum + s.score, 0) /
            scoredCount
          ).toFixed(2),
        )
      : null;
  const groupInterviewerCount = row.groupName
    ? INTERVIEWERS.filter((i: InterviewerInfo) => i.groupName === row.groupName).length
    : 0;

  return {
    id: row.id,
    name: row.name,
    gender: row.gender ?? null,
    className: row.className ?? null,
    phone: row.phone ?? null,
    firstDepartment: row.firstDepartment ?? null,
    secondDepartment: row.secondDepartment ?? null,
    acceptAdjust: row.acceptAdjust ?? null,
    globalNumber: row.globalNumber ?? null,
    groupName: row.groupName ?? null,
    groupNumber: row.groupNumber ?? null,
    status: (row.status as CandidateStatus) ?? 'pre_registered',
    scoreTotal: row.scoreTotal ?? 0,
    averageScore,
    scoredCount,
    groupInterviewerCount,
    scores,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  getInterviewers(): InterviewerInfo[] {
    return INTERVIEWERS;
  }

  verifyInterviewer(name: string): InterviewerLoginResponse {
    const trimmed = name.trim();
    if (trimmed === ADMIN_NAME) {
      return { success: true, name: ADMIN_NAME, groupName: 'A', isAdmin: true, role: 'admin' };
    }
    if (FLOATING_STAFF.includes(trimmed)) {
      return { success: true, name: trimmed, groupName: 'A', role: 'floating' };
    }
    const found = INTERVIEWERS.find(
      (i: InterviewerInfo) => i.name === trimmed,
    );
    if (!found) {
      return { success: false, message: '姓名不在面试官名单中' };
    }
    return { success: true, name: found.name, groupName: found.groupName, role: 'interviewer' };
  }

  async preRegister(dto: PreRegisterCreateRequest): Promise<Candidate> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('姓名为必填项');
    }

    const insertData: Omit<typeof candidates.$inferInsert, 'id'> = {
      name: dto.name.trim(),
      gender: dto.gender?.trim() || null,
      className: dto.className?.trim() || null,
      phone: dto.phone?.trim() || null,
      firstDepartment: dto.firstDepartment?.trim() || null,
      secondDepartment: dto.secondDepartment?.trim() || null,
      acceptAdjust: dto.acceptAdjust?.trim() || '否',
      status: 'pre_registered',
    };

    const [row] = await this.db
      .insert(candidates)
      .values(insertData)
      .returning();

    this.logger.log(`预报名成功: ${row.id} - ${row.name}`);
    return mapRowToCandidate(row);
  }

  async preRegisterPublic(dto: PreRegisterPublicRequest): Promise<Candidate> {
    const name = dto.name.trim();
    const className = dto.className.trim();
    const phone = dto.phone.trim();

    if (!name) throw new BadRequestException('姓名为必填项');
    if (!dto.gender) throw new BadRequestException('性别为必填项');
    if (!className) throw new BadRequestException('班级为必填项');
    if (!phone) throw new BadRequestException('联系电话为必填项');
    if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('请输入正确的11位手机号');
    if (!dto.firstDepartment) throw new BadRequestException('意向部门为必填项');
    if (!dto.acceptAdjust) throw new BadRequestException('请选择是否服从调剂');

    const existing = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.phone, phone))
      .limit(1);

    if (existing.length > 0 && !dto.force) {
      throw new ConflictException('该手机号已报名，请勿重复提交');
    }

    const insertData: Omit<typeof candidates.$inferInsert, 'id'> = {
      name,
      gender: dto.gender.trim(),
      className,
      phone,
      firstDepartment: dto.firstDepartment.trim(),
      secondDepartment: dto.secondDepartment?.trim() || dto.firstDepartment.trim(),
      acceptAdjust: dto.acceptAdjust.trim(),
      status: 'pre_registered',
    };

    const [row] = await this.db
      .insert(candidates)
      .values(insertData)
      .returning();

    this.logger.log(`公开预报名成功: ${row.id} - ${row.name}`);
    return mapRowToCandidate(row);
  }

  async searchByNamePublic(dto: PublicSearchByNameRequest): Promise<Candidate[]> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('请输入姓名');
    }

    const rows = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.name, name))
      .orderBy(desc(candidates.createdAt));

    return rows.map((row) => mapRowToCandidate(row));
  }

  async checkInPublic(dto: PublicCheckInRequest): Promise<Candidate> {
    if (!dto.candidateId) {
      throw new BadRequestException('缺少考生ID');
    }

    const result = await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, dto.candidateId));

      if (existing.length === 0) {
        throw new NotFoundException('考生不存在');
      }

      if (existing[0].status === 'waiting') {
        throw new BadRequestException('该考生已签到，请勿重复签到');
      }
      if (existing[0].status !== 'pre_registered') {
        throw new BadRequestException(
          `该考生当前状态为「${this.getStatusLabel(existing[0].status)}」，无法签到`,
        );
      }

      const globalNumResult = await tx
        .select({ max: sql<number>`COALESCE(MAX(global_number), 0) + 1` })
        .from(candidates);
      const newGlobalNumber = globalNumResult[0].max;

      const [updated] = await tx
        .update(candidates)
        .set({
          status: 'waiting',
          globalNumber: newGlobalNumber,
        })
        .where(eq(candidates.id, dto.candidateId))
        .returning();

      return updated;
    });

    this.logger.log(
      `公开签到成功: ${result.id} - ${result.name}, 全场号:${result.globalNumber}`,
    );
    return mapRowToCandidate(result);
  }

  private getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pre_registered: '预报名',
      waiting: '待面试',
      interviewing: '面试中',
      pending_approval: '待审批',
      completed: '已完成',
      absent: '缺考',
    };
    return map[status] || status;
  }

  private buildConditions(query: {
    keyword?: string;
    groupName?: string;
    status?: string;
    minScore?: number;
    maxScore?: number;
  }) {
    const conditions = [];
    if (query.keyword) {
      conditions.push(
        or(
          ilike(candidates.name, `%${query.keyword}%`),
          ilike(candidates.className, `%${query.keyword}%`),
          ilike(candidates.phone, `%${query.keyword}%`),
        ),
      );
    }
    if (query.groupName) {
      conditions.push(eq(candidates.groupName, query.groupName));
    }
    if (query.status) {
      conditions.push(eq(candidates.status, query.status));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private buildOrderBy(query: SearchCandidatesQuery): SQL[] {
    const { sortBy = 'score', sortOrder = 'desc' } = query;
    const order: SQL[] = [];

    if (sortBy === 'globalNumber') {
      const globalCol = candidates.globalNumber;
      order.push(sortOrder === 'asc' ? asc(globalCol) : desc(globalCol));
      order.push(asc(candidates.createdAt));
      return order;
    }

    if (sortBy === 'createdAt') {
      order.push(sortOrder === 'asc' ? asc(candidates.createdAt) : desc(candidates.createdAt));
      return order;
    }

    const avgScoreSql = sql`(SELECT AVG(${interviewerScores.score})::numeric FROM ${interviewerScores} WHERE ${interviewerScores.candidateId} = ${candidates.id})`;
    order.push(
      sortOrder === 'asc'
        ? sql`${avgScoreSql} ASC NULLS FIRST`
        : sql`${avgScoreSql} DESC NULLS LAST`,
    );
    order.push(asc(candidates.globalNumber));
    return order;
  }

  async search(query: SearchCandidatesQuery): Promise<CandidateListResponse> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const offset = (page - 1) * pageSize;

    const whereClause = this.buildConditions(query);
    const hasMinScore =
      query.minScore !== undefined && !isNaN(query.minScore);
    const hasMaxScore =
      query.maxScore !== undefined && !isNaN(query.maxScore);

    const avgScoreSql = sql<number>`ROUND(AVG(${interviewerScores.score})::numeric, 2)`.as('avg_score');
    const scoredCountSql = sql<number>`COUNT(*)`.as('scored_count');
    const subquery = this.db
      .select({
        candidateId: interviewerScores.candidateId,
        avgScore: avgScoreSql,
        scoredCount: scoredCountSql,
      })
      .from(interviewerScores)
      .groupBy(interviewerScores.candidateId)
      .as('score_stats');

    const countConditions = [];
    if (whereClause) countConditions.push(whereClause);
    if (hasMinScore) {
      countConditions.push(
        sql`${subquery.avgScore} >= ${query.minScore}`,
      );
    }
    if (hasMaxScore) {
      countConditions.push(
        sql`${subquery.avgScore} <= ${query.maxScore}`,
      );
    }
    const countWhere =
      countConditions.length > 0 ? and(...countConditions) : undefined;

    const totalResult = await this.db
      .select({ count: count() })
      .from(candidates)
      .leftJoin(subquery, eq(candidates.id, subquery.candidateId))
      .where(countWhere);

    const total = totalResult[0].count;

    const listConditions = [];
    if (whereClause) listConditions.push(whereClause);
    if (hasMinScore) {
      listConditions.push(
        sql`${subquery.avgScore} >= ${query.minScore}`,
      );
    }
    if (hasMaxScore) {
      listConditions.push(
        sql`${subquery.avgScore} <= ${query.maxScore}`,
      );
    }
    const listWhere =
      listConditions.length > 0 ? and(...listConditions) : undefined;

    const rows = await this.db
      .select()
      .from(candidates)
      .leftJoin(subquery, eq(candidates.id, subquery.candidateId))
      .where(listWhere)
      .orderBy(...this.buildOrderBy(query))
      .limit(pageSize)
      .offset(offset);

    const candidateIds = rows.map((r: { candidates: typeof candidates.$inferSelect }) => r.candidates.id);

    const allScores =
      candidateIds.length > 0
        ? await this.db
            .select()
            .from(interviewerScores)
            .where(sql`${interviewerScores.candidateId} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`)
            .orderBy(asc(interviewerScores.createdAt))
        : [];

    const scoresByCandidate = new Map<string, InterviewerScore[]>();
    for (const s of allScores) {
      const list = scoresByCandidate.get(s.candidateId) ?? [];
      list.push(mapScoreRow(s));
      scoresByCandidate.set(s.candidateId, list);
    }

    const items = rows.map((r: { candidates: typeof candidates.$inferSelect }) =>
      mapRowToCandidate(r.candidates, scoresByCandidate.get(r.candidates.id) ?? []),
    );

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async getStats(query: {
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
    const whereClause = this.buildConditions(query);

    const result = await this.db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${candidates.status} = 'completed')`,
        scoredCount: sql<number>`count(*) filter (where EXISTS (SELECT 1 FROM ${interviewerScores} WHERE ${interviewerScores.candidateId} = ${candidates.id}))`,
        averageScore: sql<number>`COALESCE((SELECT ROUND(AVG(avg_score)::numeric, 2) FROM (SELECT AVG(${interviewerScores.score}) as avg_score FROM ${interviewerScores} GROUP BY ${interviewerScores.candidateId}) t), 0)`,
      })
      .from(candidates)
      .where(whereClause);

    const row = result[0];
    return {
      total: row.total,
      completed: Number(row.completed) || 0,
      scoredCount: Number(row.scoredCount) || 0,
      averageScore: Number(row.averageScore) || 0,
    };
  }

  async checkIn(dto: CheckInRequest): Promise<Candidate> {
    if (!dto.candidateId) {
      throw new BadRequestException('缺少考生ID');
    }

    const result = await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, dto.candidateId));

      if (existing.length === 0) {
        throw new NotFoundException('考生不存在');
      }
      if (existing[0].status !== 'pre_registered') {
        throw new BadRequestException('该考生状态不允许签到');
      }

      const globalNumResult = await tx
        .select({ max: sql<number>`COALESCE(MAX(global_number), 0) + 1` })
        .from(candidates);
      const newGlobalNumber = globalNumResult[0].max;

      const [updated] = await tx
        .update(candidates)
        .set({
          status: 'waiting',
          globalNumber: newGlobalNumber,
        })
        .where(eq(candidates.id, dto.candidateId))
        .returning();

      return updated;
    });

    this.logger.log(
      `签到成功: ${result.id} - ${result.name}, 全场号:${result.globalNumber}`,
    );
    return mapRowToCandidate(result);
  }

  async assignGroup(dto: AssignGroupRequest): Promise<Candidate> {
    if (!dto.candidateId) {
      throw new BadRequestException('缺少考生ID');
    }
    if (!dto.groupName) {
      throw new BadRequestException('缺少组别');
    }

    const validGroups: GroupName[] = ['A', 'B', 'C', 'D'];
    if (!validGroups.includes(dto.groupName)) {
      throw new BadRequestException('无效的组别');
    }

    const result = await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, dto.candidateId));

      if (existing.length === 0) {
        throw new NotFoundException('考生不存在');
      }
      if (existing[0].status !== 'waiting') {
        const statusLabel = this.getStatusLabel(existing[0].status);
        throw new BadRequestException(
          `该考生当前状态为「${statusLabel}」，无法分组或改派`,
        );
      }
      if (existing[0].groupName !== null) {
        throw new BadRequestException('该考生已分配组别，请使用改派接口');
      }

      const groupNumResult = await tx.execute<{ max_group: string | null }>(
        sql`SELECT COALESCE(MAX(group_number), 0) + 1 AS max_group FROM candidates WHERE group_name = ${dto.groupName}`,
      );
      const newGroupNumber = Number(groupNumResult[0].max_group);

      const [updated] = await tx
        .update(candidates)
        .set({
          groupName: dto.groupName,
          groupNumber: newGroupNumber,
        })
        .where(eq(candidates.id, dto.candidateId))
        .returning();

      return updated;
    });

    this.logger.log(
      `分配组别: ${result.id} - ${result.name}, 组别:${result.groupName}, 组号:${result.groupNumber}`,
    );
    return mapRowToCandidate(result);
  }

  async reassignGroup(dto: ReassignGroupRequest): Promise<Candidate> {
    if (!dto.candidateId) {
      throw new BadRequestException('缺少考生ID');
    }
    if (!dto.groupName) {
      throw new BadRequestException('缺少组别');
    }

    const validGroups: GroupName[] = ['A', 'B', 'C', 'D'];
    if (!validGroups.includes(dto.groupName)) {
      throw new BadRequestException('无效的组别');
    }

    const result = await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, dto.candidateId));

      if (existing.length === 0) {
        throw new NotFoundException('考生不存在');
      }
       if (existing[0].status !== 'waiting') {
        const statusLabel = this.getStatusLabel(existing[0].status);
        throw new BadRequestException(
          `该考生当前状态为「${statusLabel}」，无法分组或改派`,
        );
      }
       if (!existing[0].groupName) {
        throw new BadRequestException('该考生尚未分配组别，请先分配组别');
      }
      if (existing[0].groupName === dto.groupName) {
        throw new BadRequestException('考生已在该组别中');
      }

      const groupNumResult = await tx.execute<{ max_group: string | null }>(
        sql`SELECT COALESCE(MAX(group_number), 0) + 1 AS max_group FROM candidates WHERE group_name = ${dto.groupName}`,
      );
      const newGroupNumber = Number(groupNumResult[0].max_group);

      const [updated] = await tx
        .update(candidates)
        .set({
          groupName: dto.groupName,
          groupNumber: newGroupNumber,
        })
        .where(eq(candidates.id, dto.candidateId))
        .returning();

      return updated;
    });

    this.logger.log(
      `改派组别: ${result.id} - ${result.name}, 新组别:${result.groupName}, 组号:${result.groupNumber}`,
    );
    return mapRowToCandidate(result);
  }

  async batchImport(items: PreRegisterCreateRequest[]): Promise<BatchImportResponse> {
    if (!items || items.length === 0) {
      return { success: 0, failed: 0, total: 0, errors: [] };
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const lineNum = i + 1;

        try {
          if (!item.name?.trim()) {
            throw new BadRequestException('姓名为必填项');
          }

          // 去重检查：姓名 + 班级都相同则跳过
          if (item.className?.trim()) {
            const existingByNameClass = await tx
              .select()
              .from(candidates)
              .where(
                and(
                  eq(candidates.name, item.name.trim()),
                  eq(candidates.className, item.className!.trim()),
                ),
              );
            if (existingByNameClass.length > 0) {
              success += 1;
              continue;
            }
          }

          const insertData: Omit<typeof candidates.$inferInsert, 'id'> = {
            name: item.name.trim(),
            gender: item.gender?.trim() || null,
            className: item.className?.trim() || null,
            phone: item.phone?.trim() || null,
            firstDepartment: item.firstDepartment?.trim() || null,
            secondDepartment: item.secondDepartment?.trim() || null,
            acceptAdjust: item.acceptAdjust?.trim() || '否',
            status: 'pre_registered',
          };
          await tx.insert(candidates).values(insertData);

          success += 1;
        } catch (err) {
          failed += 1;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`第${lineNum}行：${msg}`);
        }
      }
    });

    this.logger.log(
      `批量导入完成: 共${items.length}条, 成功${success}条, 失败${failed}条`,
    );

    return {
      success,
      failed,
      total: items.length,
      errors,
    };
  }

  async getGroupQueue(
    groupName: string,
    interviewerName?: string,
  ): Promise<Candidate[]> {
    if (interviewerName && interviewerName !== ADMIN_NAME) {
      const role = getInterviewerRole(interviewerName);
      if (role === 'floating') {
        // 流动人员可以查看所有组别
      } else {
        const interviewer = INTERVIEWERS.find(
          (i: InterviewerInfo) => i.name === interviewerName,
        );
        if (!interviewer) {
          throw new BadRequestException('面试官身份无效');
        }
        if (interviewer.groupName !== groupName) {
          throw new BadRequestException('无权查看其他组别队列');
        }
      }
    }

    const rows = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.groupName, groupName))
      .orderBy(asc(candidates.groupNumber));

    const candidateIds = rows.map((r) => r.id);
    const allScores =
      candidateIds.length > 0
        ? await this.db
            .select()
            .from(interviewerScores)
            .where(sql`${interviewerScores.candidateId} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`)
        : [];

    const scoresByCandidate = new Map<string, InterviewerScore[]>();
    for (const s of allScores) {
      const list = scoresByCandidate.get(s.candidateId) ?? [];
      list.push(mapScoreRow(s));
      scoresByCandidate.set(s.candidateId, list);
    }

    return rows.map((row) =>
      mapRowToCandidate(row, scoresByCandidate.get(row.id) ?? []),
    );
  }

  async updateStatus(
    id: string,
    newStatus: string,
    interviewerName?: string,
  ): Promise<Candidate> {
    if (!VALID_STATUSES.includes(newStatus as CandidateStatus)) {
      throw new BadRequestException(`非法状态值: ${newStatus}`);
    }

    const existing = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('考生不存在');
    }

    if (interviewerName && interviewerName !== ADMIN_NAME) {
      const interviewer = INTERVIEWERS.find(
        (i: InterviewerInfo) => i.name === interviewerName,
      );
      if (!interviewer) {
        throw new BadRequestException('面试官身份无效');
      }
      if (existing[0].groupName !== interviewer.groupName) {
        throw new BadRequestException('只能修改本组考生状态');
      }
    }

    const currentStatus = existing[0].status as CandidateStatus;
    const allowedNext = STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowedNext.includes(newStatus as CandidateStatus)) {
      throw new BadRequestException(
        `不允许从 ${currentStatus} 流转到 ${newStatus}`,
      );
    }

    if (newStatus === 'pending_approval') {
      const scores = await this.db
        .select()
        .from(interviewerScores)
        .where(eq(interviewerScores.candidateId, id));
      const minRequired = getMinScoreRequired(existing[0].groupName);
      if (scores.length < minRequired) {
        throw new BadRequestException(
          `至少需要 ${minRequired} 位面试官评分才能提交审批（当前 ${scores.length} 人）`,
        );
      }
    }

    const [updated] = await this.db
      .update(candidates)
      .set({
        status: newStatus,
      })
      .where(eq(candidates.id, id))
      .returning();

    const scores = await this.db
      .select()
      .from(interviewerScores)
      .where(eq(interviewerScores.candidateId, id));

    this.logger.log(`状态更新: ${id} ${currentStatus} → ${newStatus}`);
    return mapRowToCandidate(updated, scores.map(mapScoreRow));
  }

  async approveCandidate(
    id: string,
    operatorName: string,
  ): Promise<Candidate> {
    const existing = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('考生不存在');
    }
    if (existing[0].status !== 'pending_approval') {
      throw new BadRequestException('当前考生状态不是待审批，无法审批通过');
    }

    const [updated] = await this.db
      .update(candidates)
      .set({ status: 'completed' })
      .where(eq(candidates.id, id))
      .returning();

    const scores = await this.db
      .select()
      .from(interviewerScores)
      .where(eq(interviewerScores.candidateId, id));

    this.logger.log(`审批通过: ${id} by ${operatorName}`);
    return mapRowToCandidate(updated, scores.map(mapScoreRow));
  }

  async publicUpdateDepartments(
    candidateId: string,
    firstDepartment: string,
    secondDepartment?: string,
  ): Promise<Candidate> {
    const existing = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId));
    if (existing.length === 0) {
      throw new NotFoundException('考生不存在');
    }
    if (existing[0].status !== 'waiting') {
      throw new BadRequestException('仅待面试状态可修改意向部门');
    }
    if (!firstDepartment?.trim()) {
      throw new BadRequestException('第一意向部门不能为空');
    }

    const [updated] = await this.db
      .update(candidates)
      .set({
        firstDepartment: firstDepartment.trim(),
        secondDepartment: secondDepartment?.trim() || null,
      })
      .where(eq(candidates.id, candidateId))
      .returning();

    const scores = await this.db
      .select()
      .from(interviewerScores)
      .where(eq(interviewerScores.candidateId, candidateId));

    this.logger.log(`公开修改意向部门: ${candidateId} → ${firstDepartment}/${secondDepartment || '无'}`);
    return mapRowToCandidate(updated, scores.map(mapScoreRow));
  }

  async getById(id: string): Promise<Candidate> {
    const rows = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('考生不存在');
    }
    const scores = await this.db
      .select()
      .from(interviewerScores)
      .where(eq(interviewerScores.candidateId, id));
    return mapRowToCandidate(rows[0], scores.map(mapScoreRow));
  }

  async submitScore(
    candidateId: string,
    interviewerName: string,
    dto: SubmitScoreRequest,
  ): Promise<Candidate> {
    const isAdmin = interviewerName === ADMIN_NAME;
    const interviewer = isAdmin
      ? null
      : INTERVIEWERS.find(
          (i: InterviewerInfo) => i.name === interviewerName,
        );
    if (!isAdmin && !interviewer) {
      throw new BadRequestException('面试官身份无效');
    }

    const candidate = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId));
    if (candidate.length === 0) {
      throw new NotFoundException('考生不存在');
    }

    const candidateGroup = candidate[0].groupName;
    if (!candidateGroup) {
      throw new BadRequestException('考生尚未分配组别，无法打分');
    }
    if (!isAdmin && candidateGroup !== interviewer!.groupName) {
      throw new BadRequestException('只能给本组考生打分');
    }

    const scoreNum = Number(dto.score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
      throw new BadRequestException('综合分范围 0-10，支持一位小数');
    }

    const scoreStr = String(scoreNum);

    await this.db
      .insert(interviewerScores)
      .values({
        candidateId,
        interviewerName,
        groupName: candidateGroup,
        score: scoreStr,
        judgeComment: dto.judgeComment ?? null,
      })
      .onConflictDoUpdate({
        target: [interviewerScores.candidateId, interviewerScores.interviewerName],
        set: {
          score: scoreStr,
          judgeComment: dto.judgeComment ?? null,
          updatedAt: new Date(),
        },
      });

    const scores = await this.db
      .select()
      .from(interviewerScores)
      .where(eq(interviewerScores.candidateId, candidateId))
      .orderBy(asc(interviewerScores.createdAt));

    const validScores = scores.filter(
      (s) => s.score !== null && s.score !== undefined,
    );
    const avgScore =
      validScores.length > 0
        ? Math.round(
            (validScores.reduce((sum, s) => sum + Number(s.score), 0) /
              validScores.length) *
              100,
          ) / 100
        : 0;

    const [updatedCandidate] = await this.db
      .update(candidates)
      .set({
        scoreTotal: Math.round(avgScore * 10),
      })
      .where(eq(candidates.id, candidateId))
      .returning();

    this.logger.log(
      `打分提交: ${candidateId} 面试官:${interviewerName} 分数:${scoreNum}`,
    );
    return mapRowToCandidate(updatedCandidate, scores.map(mapScoreRow));
  }

   async getBigScreenData(): Promise<BigScreenData> {
    const groupNames: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    const groups: BigScreenGroupData[] = [];

    const allRows = await this.db.select().from(candidates);

    let totalSignedIn = 0;
    let totalInterviewing = 0;
    let totalWaiting = 0;
    let totalCompleted = 0;

    for (const gName of groupNames) {
      const groupRows = allRows.filter((row) => row.groupName === gName);

      const interviewingRows = groupRows
        .filter(
          (row) =>
            row.status === 'interviewing' ||
            row.status === 'pending_approval',
        )
        .sort((a, b) => {
          const orderA = a.status === 'pending_approval' ? 0 : 1;
          const orderB = b.status === 'pending_approval' ? 0 : 1;
          if (orderA !== orderB) return orderA - orderB;
          return (
            (a.groupNumber ?? Number.MAX_SAFE_INTEGER) -
            (b.groupNumber ?? Number.MAX_SAFE_INTEGER)
          );
        });

      const waitingRows = groupRows
        .filter((row) => row.status === 'waiting')
        .sort(
          (a, b) =>
            (a.groupNumber ?? Number.MAX_SAFE_INTEGER) -
            (b.groupNumber ?? Number.MAX_SAFE_INTEGER),
        );

      const completedCount = groupRows.filter(
        (row) => row.status === 'completed',
      ).length;

      const toItem = (
        row: (typeof allRows)[number] | undefined,
      ): BigScreenGroupItem | null => {
        if (!row) return null;
        return {
          globalNumber: row.globalNumber ?? 0,
          groupNumber: row.groupNumber ?? 0,
          status: row.status as CandidateStatus,
        };
      };

      groups.push({
        groupName: gName,
        current: toItem(interviewingRows[0]),
        completedCount,
        waitingCount: waitingRows.length,
        waitingList: waitingRows
          .map((r) => toItem(r))
          .filter((i): i is BigScreenGroupItem => i !== null),
      });

      totalInterviewing += interviewingRows.length;
      totalWaiting += waitingRows.length;
    }

    totalCompleted = allRows.filter(
      (row) => row.status === 'completed',
    ).length;
    totalSignedIn = allRows.filter(
      (row) => row.status !== 'pre_registered',
    ).length;

    return {
      groups,
      totalSignedIn,
      totalInterviewing,
      totalWaiting,
      totalCompleted,
    };
  }

   async getGroupCounts(): Promise<GroupCountInfo[]> {
     const groupNames: GroupName[] = ['A', 'B', 'C', 'D'];
     const allRows = await this.db.select().from(candidates);

     const result: GroupCountInfo[] = groupNames.map((gName: GroupName) => {
       const groupRows = allRows.filter((row) => row.groupName === gName);
       const waitingRows = groupRows
         .filter((row) => row.status === 'waiting')
         .sort(
           (a, b) =>
             (a.groupNumber ?? Number.MAX_SAFE_INTEGER) -
             (b.groupNumber ?? Number.MAX_SAFE_INTEGER),
         );
       const nextRow = waitingRows[0];
       return {
         groupName: gName,
         total: groupRows.length,
         waiting: waitingRows.length,
         interviewing: groupRows.filter((r) => r.status === 'interviewing').length,
         pendingApproval: groupRows.filter((r) => r.status === 'pending_approval').length,
         completed: groupRows.filter((r) => r.status === 'completed').length,
         absent: groupRows.filter((r) => r.status === 'absent').length,
         nextWaiting: nextRow
           ? {
               id: nextRow.id,
               name: nextRow.name,
               globalNumber: nextRow.globalNumber ?? null,
               groupNumber: nextRow.groupNumber ?? null,
             }
           : null,
       };
     });

     return result;
   }

   async exportCsv(query: {
    groupName?: string;
    minScore?: number;
    maxScore?: number;
    keyword?: string;
  }): Promise<string> {
    const whereClause = this.buildConditions(query);

    const rows = await this.db
      .select()
      .from(candidates)
      .where(whereClause)
      .orderBy(asc(candidates.globalNumber));

    const candidateIds = rows.map((r) => r.id);
    const allScores =
      candidateIds.length > 0
        ? await this.db
            .select()
            .from(interviewerScores)
            .where(sql`${interviewerScores.candidateId} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`)
        : [];

    const scoresByCandidate = new Map<string, InterviewerScore[]>();
    for (const s of allScores) {
      const list = scoresByCandidate.get(s.candidateId) ?? [];
      list.push(mapScoreRow(s));
      scoresByCandidate.set(s.candidateId, list);
    }

    const headers = [
      '全场序号',
      '组内序号',
      '姓名',
      '班级',
      '意向部门',
      '分配组别',
      '面试状态',
      '最终总分',
      '面试官1姓名',
      '面试官1分数',
      '面试官1备注',
      '面试官2姓名',
      '面试官2分数',
      '面试官2备注',
      '面试官3姓名',
      '面试官3分数',
      '面试官3备注',
    ];

    const escapeCsv = (
      value: string | number | null | undefined,
    ): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      const scores = scoresByCandidate.get(row.id) ?? [];
      const validScores = scores.filter(
        (s) => s.score !== null && s.score !== undefined,
      );
      const avgScore =
        validScores.length > 0
          ? (
              validScores.reduce((sum, s) => sum + s.score, 0) /
              validScores.length
            ).toFixed(2)
          : '';

      const dept = [row.firstDepartment, row.secondDepartment]
        .filter(Boolean)
        .join(' / ');

      const statusMap: Record<string, string> = {
        pre_registered: '预报名',
        waiting: '待面试',
        interviewing: '面试中',
        pending_approval: '待审批',
        completed: '已完成',
        absent: '缺考',
      };

      const formatName = (name: string): string => {
        return name === 'guido' ? 'guido(管理员)' : name;
      };

      lines.push(
        [
          row.globalNumber ?? '',
          row.groupNumber ?? '',
          row.name,
          row.className ?? '',
          dept,
          row.groupName ? `${row.groupName}组` : '',
          statusMap[row.status] ?? row.status,
          avgScore,
          scores[0] ? formatName(scores[0].interviewerName) : '',
          scores[0]?.score ?? '',
          scores[0]?.judgeComment ?? '',
          scores[1] ? formatName(scores[1].interviewerName) : '',
          scores[1]?.score ?? '',
          scores[1]?.judgeComment ?? '',
          scores[2] ? formatName(scores[2].interviewerName) : '',
          scores[2]?.score ?? '',
          scores[2]?.judgeComment ?? '',
        ]
          .map((val) => escapeCsv(val))
          .join(','),
      );
    }

    return '\uFEFF' + lines.join('\n');
  }
}
