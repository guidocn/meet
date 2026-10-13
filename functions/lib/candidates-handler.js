// 面试叫号系统 - 业务逻辑层
// Cloudflare D1 兼容版本

// 内存缓存：减少D1读取次数（候场大屏和组统计共用）
let _screenCache = { data: null, timestamp: 0 };
const SCREEN_CACHE_TTL = 5000; // 5秒缓存

// 清除缓存（数据变更时调用）
function clearScreenCache() {
  _screenCache.data = null;
  _screenCache.timestamp = 0;
}

const INTERVIEWERS = [
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

const FLOATING_STAFF = [
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

export const ADMIN_NAME = 'guido';

const VALID_STATUSES = [
  'pre_registered',
  'waiting',
  'interviewing',
  'pending_approval',
  'completed',
  'absent',
];

const STATUS_TRANSITIONS = {
  pre_registered: ['waiting'],
  waiting: ['interviewing', 'completed'],
  interviewing: ['pending_approval'],
  pending_approval: ['completed'],
  completed: [],
};

function getInterviewerRole(name) {
  if (name === ADMIN_NAME) return 'admin';
  if (FLOATING_STAFF.includes(name)) return 'floating';
  return 'interviewer';
}

function getStatusLabel(status) {
  const map = {
    pre_registered: '预报名',
    waiting: '待面试',
    interviewing: '面试中',
    pending_approval: '待审批',
    completed: '已完成',
    absent: '缺考',
  };
  return map[status] || status;
}

function getMinScoreRequired(groupName) {
  if (groupName === 'D') return 1;
  return 2;
}

function generateUUID() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mapRowToCandidate(row, scores = []) {
  const validScores = scores.filter((s) => s.score !== null && s.score !== undefined);
  const scoredCount = validScores.length;
  const averageScore =
    scoredCount > 0
      ? Number(
          (
            validScores.reduce((sum, s) => sum + Number(s.score), 0) / scoredCount
          ).toFixed(2),
        )
      : null;
  const groupInterviewerCount = row.group_name
    ? INTERVIEWERS.filter((i) => i.group_name === row.group_name).length
    : 0;

  return {
    id: row.id,
    name: row.name,
    gender: row.gender || null,
    className: row.class_name || null,
    phone: row.phone || null,
    firstDepartment: row.first_department || null,
    secondDepartment: row.second_department || null,
    acceptAdjust: row.accept_adjust || null,
    globalNumber: row.global_number || null,
    groupName: row.group_name || null,
    groupNumber: row.group_number ?? null,
    status: row.status || 'pre_registered',
    scoreTotal: row.score_total || 0,
    averageScore,
    scoredCount,
    groupInterviewerCount,
    scores,
    createdAt: row._created_at,
  };
}

function mapScoreRow(row) {
  return {
    id: row.id,
    interviewerName: row.interviewer_name,
    groupName: row.group_name,
    score: Number(row.score),
    judgeComment: row.judge_comment || null,
    createdAt: row._created_at,
  };
}

function badRequest(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

function notFound(msg) {
  const err = new Error(msg);
  err.status = 404;
  return err;
}

function forbidden(msg) {
  const err = new Error(msg);
  err.status = 403;
  return err;
}

function conflict(msg) {
  const err = new Error(msg);
  err.status = 409;
  return err;
}

async function getScoresByCandidateIds(db, ids) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT * FROM interviewer_scores WHERE candidate_id IN (${placeholders}) ORDER BY _created_at ASC`,
    )
    .bind(...ids)
    .all();
  return result.results || [];
}

function groupScoresById(scoreRows) {
  const map = new Map();
  for (const s of scoreRows) {
    const score = mapScoreRow(s);
    const list = map.get(s.candidate_id) || [];
    list.push(score);
    map.set(s.candidate_id, list);
  }
  return map;
}

// ============ 业务函数 ============

export async function handlePreRegister(db, dto) {
  if (!dto.name || !dto.name.trim()) {
    throw badRequest('姓名为必填项');
  }
  const id = generateUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO candidates (id, name, gender, class_name, phone, first_department, second_department, accept_adjust, status, _created_at, _updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pre_registered', ?, ?)`,
    )
    .bind(
      id,
      dto.name.trim(),
      dto.gender?.trim() || null,
      dto.className?.trim() || null,
      dto.phone?.trim() || null,
      dto.firstDepartment?.trim() || null,
      dto.secondDepartment?.trim() || null,
      dto.acceptAdjust?.trim() || '否',
      now,
      now,
    )
    .run();

  const row = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  return mapRowToCandidate(row);
}

export async function handlePreRegisterPublic(db, dto) {
  const name = (dto.name || '').trim();
  const className = (dto.className || '').trim();
  const phone = (dto.phone || '').trim();

  if (!name) throw badRequest('姓名为必填项');
  if (!dto.gender) throw badRequest('性别为必填项');
  if (!className) throw badRequest('班级为必填项');
  if (!phone) throw badRequest('联系电话为必填项');
  if (!/^1\d{10}$/.test(phone)) throw badRequest('请输入正确的11位手机号');
  if (!dto.firstDepartment) throw badRequest('意向部门为必填项');
  if (!dto.acceptAdjust) throw badRequest('请选择是否服从调剂');

  const existing = await db
    .prepare('SELECT * FROM candidates WHERE phone = ? LIMIT 1')
    .bind(phone)
    .first();

  if (existing && !dto.force) {
    throw conflict('该手机号已报名，请勿重复提交');
  }

  const id = generateUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO candidates (id, name, gender, class_name, phone, first_department, second_department, accept_adjust, status, _created_at, _updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pre_registered', ?, ?)`,
    )
    .bind(
      id,
      name,
      dto.gender.trim(),
      className,
      phone,
      dto.firstDepartment.trim(),
      (dto.secondDepartment || dto.firstDepartment).trim(),
      dto.acceptAdjust.trim(),
      now,
      now,
    )
    .run();

  const row = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  return mapRowToCandidate(row);
}

export async function handleSearchByNamePublic(db, dto) {
  const name = (dto.name || '').trim();
  if (!name) throw badRequest('请输入姓名');

  const result = await db
    .prepare('SELECT * FROM candidates WHERE name = ? ORDER BY _created_at DESC')
    .bind(name)
    .all();

  return (result.results || []).map((row) => mapRowToCandidate(row));
}

export async function handleCheckInPublic(db, dto) {
  if (!dto.candidateId) throw badRequest('缺少考生ID');

  const existing = await db
    .prepare('SELECT * FROM candidates WHERE id = ?')
    .bind(dto.candidateId)
    .first();

  if (!existing) throw notFound('考生不存在');
  if (existing.status === 'waiting') throw badRequest('该考生已签到，请勿重复签到');
  if (existing.status !== 'pre_registered') {
    throw badRequest(`该考生当前状态为「${getStatusLabel(existing.status)}」，无法签到`);
  }

  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(global_number), 0) + 1 as new_num FROM candidates')
    .first();
  const newGlobalNumber = maxRow.new_num;
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE candidates SET status = 'waiting', global_number = ?, _updated_at = ? WHERE id = ?",
    )
    .bind(newGlobalNumber, now, dto.candidateId)
    .run();

  const updated = await db
    .prepare('SELECT * FROM candidates WHERE id = ?')
    .bind(dto.candidateId)
    .first();

  clearScreenCache(); // 清除缓存，让候场大屏下次请求读新数据
  return mapRowToCandidate(updated);
}

export async function handlePublicUpdateDepartments(db, body) {
  const { candidateId, firstDepartment, secondDepartment } = body;
  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(candidateId).first();
  if (!existing) throw notFound('考生不存在');
  if (existing.status !== 'waiting') throw badRequest('仅待面试状态可修改意向部门');
  if (!firstDepartment || !firstDepartment.trim()) throw badRequest('第一意向部门不能为空');

  const now = new Date().toISOString();
  await db
    .prepare(
      'UPDATE candidates SET first_department = ?, second_department = ?, _updated_at = ? WHERE id = ?',
    )
    .bind(firstDepartment.trim(), secondDepartment?.trim() || null, now, candidateId)
    .run();

  const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(candidateId).first();
  const scores = await getScoresByCandidateIds(db, [candidateId]);
  const scoreMap = groupScoresById(scores);
  return mapRowToCandidate(updated, scoreMap.get(candidateId) || []);
}

export async function handleGetDetailPublic(db, id) {
  const row = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  if (!row) throw notFound('考生不存在');
  const scores = await getScoresByCandidateIds(db, [id]);
  const scoreMap = groupScoresById(scores);
  return mapRowToCandidate(row, scoreMap.get(id) || []);
}

function buildSearchWhere(query, params) {
  const conditions = [];
  if (query.keyword) {
    conditions.push('(name LIKE ? OR class_name LIKE ? OR phone LIKE ?)');
    const kw = `%${query.keyword}%`;
    params.push(kw, kw, kw);
  }
  if (query.groupName) {
    conditions.push('group_name = ?');
    params.push(query.groupName);
  }
  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }
  // 选择"全部"时默认排除已完成，让待操作的全部显示在首页
  if (query.excludeCompleted === 'true' || query.excludeCompleted === true) {
    conditions.push("status != 'completed'");
  }
  return conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
}

export async function handleSearch(db, query) {
  const page = query.page ? parseInt(query.page, 10) : 1;
  const pageSize = Math.min(query.pageSize ? parseInt(query.pageSize, 10) : 20, 100);
  const offset = (page - 1) * pageSize;
  const sortBy = query.sortBy || 'score';
  const sortOrder = query.sortOrder || 'desc';

  const params = [];
  const whereClause = buildSearchWhere(query, params);

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM candidates ${whereClause}`)
    .bind(...params)
    .first();
  let total = countResult.total;

  const hasMinScore = query.minScore !== undefined && query.minScore !== '' && !isNaN(Number(query.minScore));
  const hasMaxScore = query.maxScore !== undefined && query.maxScore !== '' && !isNaN(Number(query.maxScore));

  let orderSql = '';
  if (sortBy === 'globalNumber') {
    // 三级状态优先级：待操作(待面试/面试中/待审批) → 未签到(预报名) → 已完成
    // 第一页显示待操作，然后是未签到，尾页才是已完成；同一优先级按全场序号升序
    orderSql = `ORDER BY 
      CASE 
        WHEN status IN ('waiting', 'interviewing', 'pending_approval') THEN 0
        WHEN status = 'pre_registered' THEN 1
        ELSE 2
      END ASC,
      global_number ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, 
      _created_at ASC`;
  } else if (sortBy === 'createdAt') {
    orderSql = `ORDER BY _created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else {
    orderSql = `ORDER BY (SELECT AVG(score) FROM interviewer_scores WHERE candidate_id = candidates.id) ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, global_number ASC`;
  }

  let listQuery = `SELECT * FROM candidates ${whereClause} ${orderSql} LIMIT ? OFFSET ?`;
  const listParams = [...params, pageSize, offset];

  if (hasMinScore || hasMaxScore) {
    const havingConditions = [];
    const havingParams = [...params];
    if (hasMinScore) {
      havingConditions.push('avg_score >= ?');
      havingParams.push(Number(query.minScore));
    }
    if (hasMaxScore) {
      havingConditions.push('avg_score <= ?');
      havingParams.push(Number(query.maxScore));
    }

    const subquery = `
      SELECT c.*, (SELECT AVG(score) FROM interviewer_scores WHERE candidate_id = c.id) as avg_score
      FROM candidates c
      ${whereClause}
      HAVING ${havingConditions.join(' AND ')}
    `;

    const countSubquery = `SELECT COUNT(*) as total FROM (${subquery})`;
    const countRow = await db.prepare(countSubquery).bind(...havingParams).first();
    total = countRow.total;

    listQuery = `SELECT * FROM (${subquery}) ${orderSql} LIMIT ? OFFSET ?`;
    listParams.length = 0;
    listParams.push(...havingParams, pageSize, offset);
  }

  const listResult = await db.prepare(listQuery).bind(...listParams).all();
  const rows = listResult.results || [];
  const ids = rows.map((r) => r.id);
  const allScores = await getScoresByCandidateIds(db, ids);
  const scoreMap = groupScoresById(allScores);
  const items = rows.map((row) => mapRowToCandidate(row, scoreMap.get(row.id) || []));

  return { items, total, page, pageSize };
}

export async function handleCheckIn(db, body) {
  if (!body.candidateId) throw badRequest('缺少考生ID');

  const role = body.operatorName ? getInterviewerRole(body.operatorName) : 'interviewer';
  if (role === 'interviewer') throw forbidden('无权限操作，仅管理员和流动人员可执行');

  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(body.candidateId).first();
  if (!existing) throw notFound('考生不存在');
  if (existing.status !== 'pre_registered') throw badRequest('该考生状态不允许签到');

  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(global_number), 0) + 1 as new_num FROM candidates')
    .first();
  const newGlobalNumber = maxRow.new_num;
  const now = new Date().toISOString();

  await db
    .prepare("UPDATE candidates SET status = 'waiting', global_number = ?, _updated_at = ? WHERE id = ?")
    .bind(newGlobalNumber, now, body.candidateId)
    .run();

  const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(body.candidateId).first();
  return mapRowToCandidate(updated);
}

// 重新计算指定组所有待面试人员的组内序号，严格按全场序号升序（先来先面）
async function recalculateGroupNumbers(db, groupName) {
  const result = await db
    .prepare("SELECT id FROM candidates WHERE group_name = ? AND status = 'waiting' ORDER BY global_number ASC, _created_at ASC")
    .bind(groupName)
    .all();
  const waitingList = result.results || [];
  for (let i = 0; i < waitingList.length; i++) {
    await db
      .prepare('UPDATE candidates SET group_number = ? WHERE id = ?')
      .bind(i + 1, waitingList[i].id)
      .run();
  }
}

export async function handleAssignGroup(db, body) {
  if (!body.candidateId) throw badRequest('缺少考生ID');
  if (!body.groupName) throw badRequest('缺少组别');

  const role = body.operatorName ? getInterviewerRole(body.operatorName) : 'interviewer';
  if (role === 'interviewer') throw forbidden('无权限操作，仅管理员和流动人员可执行');

  const validGroups = ['A', 'B', 'C', 'D'];
  if (!validGroups.includes(body.groupName)) throw badRequest('无效的组别');

  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(body.candidateId).first();
  if (!existing) throw notFound('考生不存在');
  if (existing.status !== 'waiting') throw badRequest('该考生当前状态无法分配组别');
  if (existing.group_name) throw badRequest('该考生已分配组别，请使用改派接口');

  const now = new Date().toISOString();

  // 先设置组别，序号暂时设为0，随后统一重新计算
  await db
    .prepare('UPDATE candidates SET group_name = ?, group_number = 0, _updated_at = ? WHERE id = ?')
    .bind(body.groupName, now, body.candidateId)
    .run();

  // 严格按全场序号重新计算该组所有待面试人员的组内序号（先来先面）
  await recalculateGroupNumbers(db, body.groupName);

  const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(body.candidateId).first();
  clearScreenCache(); // 清除缓存
  return mapRowToCandidate(updated);
}

export async function handleReassignGroup(db, body) {
  if (!body.candidateId) throw badRequest('缺少考生ID');
  if (!body.groupName) throw badRequest('缺少组别');

  const role = body.operatorName ? getInterviewerRole(body.operatorName) : 'interviewer';
  if (role === 'interviewer') throw forbidden('无权限操作，仅管理员和流动人员可执行');

  const validGroups = ['A', 'B', 'C', 'D'];
  if (!validGroups.includes(body.groupName)) throw badRequest('无效的组别');

  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(body.candidateId).first();
  if (!existing) throw notFound('考生不存在');
  if (existing.status !== 'waiting') throw badRequest('该考生当前状态无法改派');
  if (!existing.group_name) throw badRequest('该考生尚未分配组别，请先分配组别');
  if (existing.group_name === body.groupName) throw badRequest('考生已在该组别中');

  const oldGroup = existing.group_name;
  const now = new Date().toISOString();

  // 先设置新组别，序号暂时设为0，随后统一重新计算
  await db
    .prepare('UPDATE candidates SET group_name = ?, group_number = 0, _updated_at = ? WHERE id = ?')
    .bind(body.groupName, now, body.candidateId)
    .run();

  // 严格按全场序号重新计算新旧两个组的组内序号（先来先面）
  await recalculateGroupNumbers(db, body.groupName);
  await recalculateGroupNumbers(db, oldGroup);

  const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(body.candidateId).first();
  return mapRowToCandidate(updated);
}

export async function handleBatchImport(db, body) {
  const items = body.items || [];
  if (body.operatorName !== ADMIN_NAME) throw forbidden('无权限操作，仅管理员可执行');

  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lineNum = i + 1;
    try {
      if (!item.name || !item.name.trim()) throw badRequest('姓名为必填项');

      if (item.className && item.className.trim()) {
        const existing = await db
          .prepare('SELECT id FROM candidates WHERE name = ? AND class_name = ? LIMIT 1')
          .bind(item.name.trim(), item.className.trim())
          .first();
        if (existing) {
          success += 1;
          continue;
        }
      }

      const id = generateUUID();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO candidates (id, name, gender, class_name, phone, first_department, second_department, accept_adjust, status, _created_at, _updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pre_registered', ?, ?)`,
        )
        .bind(
          id,
          item.name.trim(),
          item.gender?.trim() || null,
          item.className?.trim() || null,
          item.phone?.trim() || null,
          item.firstDepartment?.trim() || null,
          item.secondDepartment?.trim() || null,
          item.acceptAdjust?.trim() || '否',
          now,
          now,
        )
        .run();

      success += 1;
    } catch (err) {
      failed += 1;
      errors.push(`第${lineNum}行：${err.message || String(err)}`);
    }
  }

  return { success, failed, total: items.length, errors };
}

export async function handleStats(db, query) {
  const params = [];
  const whereClause = buildSearchWhere(query, params);

  const totalRow = await db
    .prepare(`SELECT COUNT(*) as total FROM candidates ${whereClause}`)
    .bind(...params)
    .first();
  const total = totalRow.total;

  const completedRow = await db
    .prepare(`SELECT COUNT(*) as cnt FROM candidates ${whereClause || 'WHERE 1=1'} AND status = 'completed'`)
    .bind(...params)
    .first();
  const completed = completedRow.cnt;

  const scoredRow = await db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) as cnt FROM candidates c 
       INNER JOIN interviewer_scores s ON s.candidate_id = c.id
       ${whereClause.replace(/^WHERE /, 'AND ') || ''}`,
    )
    .bind(...params)
    .first();
  const scoredCount = scoredRow.cnt;

  const avgRow = await db
    .prepare(
      `SELECT COALESCE(AVG(avg_score), 0) as average FROM (
        SELECT AVG(score) as avg_score FROM interviewer_scores 
        GROUP BY candidate_id
      )`,
    )
    .first();
  const averageScore = Number(Number(avgRow.average).toFixed(2));

  return { total, completed, scoredCount, averageScore };
}

export async function handleExportCsv(db, query) {
  const params = [];
  const whereClause = buildSearchWhere(query, params);

  const listResult = await db
    .prepare(`SELECT * FROM candidates ${whereClause} ORDER BY global_number ASC`)
    .bind(...params)
    .all();
  const rows = listResult.results || [];
  const ids = rows.map((r) => r.id);
  const allScores = await getScoresByCandidateIds(db, ids);
  const scoreMap = groupScoresById(allScores);

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

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    const scores = scoreMap.get(row.id) || [];
    const validScores = scores.filter((s) => s.score !== null && s.score !== undefined);
    const avgScore =
      validScores.length > 0
        ? (validScores.reduce((sum, s) => sum + Number(s.score), 0) / validScores.length).toFixed(2)
        : '';

    const dept = [row.first_department, row.second_department].filter(Boolean).join('/');

    const line = [
      row.global_number || '',
      row.group_number ?? '',
      row.name,
      row.class_name || '',
      dept,
      row.group_name || '',
      getStatusLabel(row.status),
      avgScore,
      validScores[0]?.interviewerName || '',
      validScores[0]?.score || '',
      validScores[0]?.judgeComment || '',
      validScores[1]?.interviewerName || '',
      validScores[1]?.score || '',
      validScores[1]?.judgeComment || '',
      validScores[2]?.interviewerName || '',
      validScores[2]?.score || '',
      validScores[2]?.judgeComment || '',
    ].map(escapeCsv);

    lines.push(line.join(','));
  }

  return '\uFEFF' + lines.join('\n');
}

export async function handleGetBigScreen(db) {
  // 先查缓存，5秒内的请求直接返回，大幅减少D1读取
  const now = Date.now();
  if (_screenCache.data && (now - _screenCache.timestamp) < SCREEN_CACHE_TTL) {
    return _screenCache.data.bigScreen;
  }

  const groupNames = ['A', 'B', 'C', 'D'];
  const groups = [];

  const allResult = await db.prepare('SELECT * FROM candidates').all();
  const allRows = allResult.results || [];

  let totalSignedIn = 0;
  let totalInterviewing = 0;
  let totalWaiting = 0;
  let totalCompleted = 0;

  for (const gName of groupNames) {
    const groupRows = allRows.filter((row) => row.group_name === gName);

    const interviewingRows = groupRows
      .filter((row) => row.status === 'interviewing' || row.status === 'pending_approval')
      .sort((a, b) => {
        const orderA = a.status === 'pending_approval' ? 0 : 1;
        const orderB = b.status === 'pending_approval' ? 0 : 1;
        if (orderA !== orderB) return orderA - orderB;
        return (a.group_number ?? Number.MAX_SAFE_INTEGER) - (b.group_number ?? Number.MAX_SAFE_INTEGER);
      });

    const waitingRows = groupRows
      .filter((row) => row.status === 'waiting')
      .sort((a, b) => (a.group_number ?? Number.MAX_SAFE_INTEGER) - (b.group_number ?? Number.MAX_SAFE_INTEGER));

    const completedCount = groupRows.filter((row) => row.status === 'completed').length;

    const toItem = (row) => {
      if (!row) return null;
      return {
        globalNumber: row.global_number ?? 0,
        groupNumber: row.group_number ?? 0,
        status: row.status,
      };
    };

    groups.push({
      groupName: gName,
      current: toItem(interviewingRows[0]),
      completedCount,
      waitingCount: waitingRows.length,
      waitingList: waitingRows.map((r) => toItem(r)).filter((i) => i !== null),
    });

    totalInterviewing += interviewingRows.length;
    totalWaiting += waitingRows.length;
  }

  totalCompleted = allRows.filter((row) => row.status === 'completed').length;
  totalSignedIn = allRows.filter((row) => row.status !== 'pre_registered').length;

  const result = { groups, totalSignedIn, totalInterviewing, totalWaiting, totalCompleted };
  
  // 写入缓存
  _screenCache.data = { bigScreen: result, allRows };
  _screenCache.timestamp = now;
  
  return result;
}

export async function handleGetGroupCounts(db) {
  // 先查缓存
  const now = Date.now();
  if (_screenCache.data && (now - _screenCache.timestamp) < SCREEN_CACHE_TTL) {
    return _screenCache.data.groupCounts;
  }

  // 如果缓存里已经有allRows，直接复用，不再查数据库
  let allRows;
  if (_screenCache.data && _screenCache.data.allRows && (Date.now() - _screenCache.timestamp) < SCREEN_CACHE_TTL) {
    allRows = _screenCache.data.allRows;
  } else {
    const allResult = await db.prepare('SELECT * FROM candidates').all();
    allRows = allResult.results || [];
  }

  const result = groupNames.map((gName) => {
    const groupRows = allRows.filter((row) => row.group_name === gName);
    const waitingRows = groupRows
      .filter((row) => row.status === 'waiting')
      .sort((a, b) => (a.group_number ?? Number.MAX_SAFE_INTEGER) - (b.group_number ?? Number.MAX_SAFE_INTEGER));
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
            globalNumber: nextRow.global_number ?? null,
            groupNumber: nextRow.group_number ?? null,
          }
        : null,
    };
  });

  // 写入缓存
  if (_screenCache.data) {
    _screenCache.data.groupCounts = result;
  }

  return result;
}

export async function handleInterviewerLogin(db, body) {
  const name = (body.name || '').trim();
  if (!name) throw badRequest('请输入面试官姓名');

  if (name === ADMIN_NAME) {
    return { success: true, name: ADMIN_NAME, groupName: 'A', isAdmin: true, role: 'admin' };
  }
  if (FLOATING_STAFF.includes(name)) {
    return { success: true, name, groupName: 'A', role: 'floating' };
  }
  const found = INTERVIEWERS.find((i) => i.name === name);
  if (!found) return { success: false, message: '姓名不在面试官名单中' };
  return { success: true, name: found.name, groupName: found.groupName, role: 'interviewer' };
}

export async function handleGetGroupQueue(db, groupName, interviewerName) {
  if (interviewerName && interviewerName !== ADMIN_NAME) {
    const role = getInterviewerRole(interviewerName);
    if (role !== 'floating') {
      const interviewer = INTERVIEWERS.find((i) => i.name === interviewerName);
      if (!interviewer) throw badRequest('面试官身份无效');
      if (interviewer.groupName !== groupName) throw badRequest('无权查看其他组别队列');
    }
  }

  const result = await db
    .prepare('SELECT * FROM candidates WHERE group_name = ? ORDER BY group_number ASC')
    .bind(groupName)
    .all();
  const rows = result.results || [];
  const ids = rows.map((r) => r.id);
  const allScores = await getScoresByCandidateIds(db, ids);
  const scoreMap = groupScoresById(allScores);
  return rows.map((row) => mapRowToCandidate(row, scoreMap.get(row.id) || []));
}

export async function handleUpdateStatus(db, id, body) {
  const { status: newStatus, interviewerName } = body;

  if (!VALID_STATUSES.includes(newStatus)) throw badRequest(`非法状态值: ${newStatus}`);

  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  if (!existing) throw notFound('考生不存在');

  const role = interviewerName ? getInterviewerRole(interviewerName) : 'interviewer';
  if (role === 'floating') throw forbidden('无权限操作，流动人员仅可查看，不可修改面试状态');

  if (interviewerName && interviewerName !== ADMIN_NAME) {
    const interviewer = INTERVIEWERS.find((i) => i.name === interviewerName);
    if (!interviewer) throw badRequest('面试官身份无效');
    if (existing.group_name !== interviewer.groupName) throw badRequest('只能修改本组考生状态');
  }

  const allowedNext = STATUS_TRANSITIONS[existing.status] || [];
  if (!allowedNext.includes(newStatus)) {
    throw badRequest(`不允许从 ${existing.status} 流转到 ${newStatus}`);
  }

  // 开始面试时校验：同一组同时只能有一个人在面试中或待审批
  if (newStatus === 'interviewing' && existing.group_name) {
    const activeResult = await db
      .prepare("SELECT COUNT(*) as cnt FROM candidates WHERE group_name = ? AND status IN ('interviewing', 'pending_approval')")
      .bind(existing.group_name)
      .first();
    if (activeResult.cnt > 0) {
      throw badRequest('本组已有面试者正在面试或待审批，请等审批完成后再叫下一位');
    }
  }

  if (newStatus === 'pending_approval') {
    const scoresResult = await db
      .prepare('SELECT COUNT(*) as cnt FROM interviewer_scores WHERE candidate_id = ?')
      .bind(id)
      .first();
    const minRequired = getMinScoreRequired(existing.group_name);
    if (scoresResult.cnt < minRequired) {
      throw badRequest(
        `至少需要 ${minRequired} 位面试官评分才能提交审批（当前 ${scoresResult.cnt} 人）`,
      );
    }
  }

  const now = new Date().toISOString();
  await db.prepare('UPDATE candidates SET status = ?, _updated_at = ? WHERE id = ?').bind(newStatus, now, id).run();

  // 状态变更后，重新计算该组的组内序号，确保按全场序号连续不跳号
  if (existing.group_name) {
    await recalculateGroupNumbers(db, existing.group_name);
  }

  const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  const scores = await getScoresByCandidateIds(db, [id]);
  const scoreMap = groupScoresById(scores);
  clearScreenCache(); // 清除缓存
  return mapRowToCandidate(updated, scoreMap.get(id) || []);
}

export async function handleSubmitScore(db, id, body) {
  const { score, judgeComment, interviewerName } = body;

  if (!interviewerName || !interviewerName.trim()) throw badRequest('缺少面试官姓名');

  const role = getInterviewerRole(interviewerName);
  if (role === 'floating') throw forbidden('无权限操作，流动人员不可打分');

  const isAdmin = interviewerName === ADMIN_NAME;
  const interviewer = isAdmin ? null : INTERVIEWERS.find((i) => i.name === interviewerName);
  if (!isAdmin && !interviewer) throw badRequest('面试官身份无效');

  const candidate = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  if (!candidate) throw notFound('考生不存在');

  const candidateGroup = candidate.group_name;
  if (!candidateGroup) throw badRequest('考生尚未分配组别，无法打分');
  if (!isAdmin && candidateGroup !== interviewer.groupName) throw badRequest('只能给本组考生打分');

  const scoreNum = Number(score);
  if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
    throw badRequest('综合分范围 0-10，支持一位小数');
  }

  const now = new Date().toISOString();

  const existingScore = await db
    .prepare('SELECT id FROM interviewer_scores WHERE candidate_id = ? AND interviewer_name = ?')
    .bind(id, interviewerName)
    .first();

  if (existingScore) {
    await db
      .prepare(
        'UPDATE interviewer_scores SET score = ?, judge_comment = ?, _updated_at = ? WHERE id = ?',
      )
      .bind(scoreNum, judgeComment || null, now, existingScore.id)
      .run();
  } else {
    const scoreId = generateUUID();
    await db
      .prepare(
        'INSERT INTO interviewer_scores (id, candidate_id, interviewer_name, group_name, score, judge_comment, _created_at, _updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(scoreId, id, interviewerName, candidateGroup, scoreNum, judgeComment || null, now, now)
      .run();
  }

  const scoresResult = await db
    .prepare('SELECT * FROM interviewer_scores WHERE candidate_id = ? ORDER BY _created_at ASC')
    .bind(id)
    .all();
  const allScores = scoresResult.results || [];
  const validScores = allScores.filter((s) => s.score !== null && s.score !== undefined);
  const avgScore =
    validScores.length > 0
      ? Math.round(
          (validScores.reduce((sum, s) => sum + Number(s.score), 0) / validScores.length) * 100,
        ) / 100
      : 0;

  await db
    .prepare('UPDATE candidates SET score_total = ?, _updated_at = ? WHERE id = ?')
    .bind(Math.round(avgScore * 10), now, id)
    .run();

  const updatedCandidate = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  return mapRowToCandidate(updatedCandidate, allScores.map(mapScoreRow));
}

export async function handleApprove(db, id, body) {
  const { operatorName } = body;
  if (!operatorName || !operatorName.trim()) throw badRequest('缺少操作人姓名');

  const role = getInterviewerRole(operatorName);
  if (role === 'interviewer') throw forbidden('无权限操作，仅管理员和流动人员可审批');

  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  if (!existing) throw notFound('考生不存在');
  if (existing.status !== 'pending_approval') throw badRequest('当前考生状态不是待审批，无法审批通过');

  const now = new Date().toISOString();
  await db.prepare("UPDATE candidates SET status = 'completed', _updated_at = ? WHERE id = ?").bind(now, id).run();

  // 审批通过后，重新计算该组的组内序号
  if (existing.group_name) {
    await recalculateGroupNumbers(db, existing.group_name);
  }

  const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  const scores = await getScoresByCandidateIds(db, [id]);
  const scoreMap = groupScoresById(scores);
  clearScreenCache(); // 清除缓存
  return mapRowToCandidate(updated, scoreMap.get(id) || []);
}

// 单个删除面试者（不需要密码）
export async function handleDeleteCandidate(db, id) {
  const existing = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  if (!existing) throw notFound('考生不存在');

  // 同时删除打分记录
  await db.prepare('DELETE FROM interviewer_scores WHERE candidate_id = ?').bind(id).run();
  await db.prepare('DELETE FROM candidates WHERE id = ?').bind(id).run();

  // 删除后重新计算该组的组内序号
  if (existing.group_name) {
    await recalculateGroupNumbers(db, existing.group_name);
  }

  clearScreenCache(); // 清除缓存
  return { success: true, deletedId: id, name: existing.name };
}

// 全部删除面试者（需要密码 6019）
export async function handleDeleteAll(db, body) {
  const { password } = body || {};
  if (!password) throw badRequest('请输入删除密码');
  if (password !== '6019') throw forbidden('密码错误，无法全部删除');

  // 先统计数量
  const countResult = await db.prepare('SELECT COUNT(*) as count FROM candidates').first();
  const count = countResult?.count || 0;

  // 删除所有打分记录和面试者
  await db.prepare('DELETE FROM interviewer_scores').run();
  await db.prepare('DELETE FROM candidates').run();

  clearScreenCache(); // 清除缓存
  return { success: true, deletedCount: count };
}
