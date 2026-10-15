const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// strict: false 允许接受纯字符串作为JSON请求体（前端快速签到传的是姓名字符串）
app.use(express.json({ strict: false }));
app.use(express.static(path.join(__dirname, 'public')));

// 数据库配置
const pool = mysql.createPool({
  host: 'mariadb',
  user: 'meet_db',
  password: 'zQ3fWkGKPsMzppH5',
  database: 'meet_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

// 把snake_case转换成camelCase，并给候选人对象添加默认值
function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel);
  // 正确处理Date对象，转换成ISO字符串，避免变成空对象
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = toCamel(obj[key]);
    }
    // 给候选人对象添加默认值，避免NULL导致前端崩溃
    if (result.id && result.name) {
      result.gender = result.gender || '';
      result.studentId = result.studentId || '';
      result.phone = result.phone || '';
      result.className = result.className || '';
      result.firstDepartment = result.firstDepartment || '';
      result.secondDepartment = result.secondDepartment || '';
      result.acceptAdjust = result.acceptAdjust || '';
      result.status = result.status || 'pre_registered';
      // 状态兼容：把旧的first_completed转换成completed
      if (result.status === 'first_completed' || result.status === 'firstCompleted') result.status = 'completed';
      result.groupName = result.groupName || '';
      result.groupNumber = result.groupNumber || 0;
      result.overallNumber = result.overallNumber || 0;
      result.globalNumber = result.globalNumber || 0;
      result.finalScore = result.finalScore || 0;
      result.interviewer1Name = result.interviewer1Name || '';
      result.interviewer1Score = result.interviewer1Score || 0;
      result.interviewer1Comment = result.interviewer1Comment || '';
      result.interviewer2Name = result.interviewer2Name || '';
      result.interviewer2Score = result.interviewer2Score || 0;
      result.interviewer2Comment = result.interviewer2Comment || '';
      result.interviewer3Name = result.interviewer3Name || '';
      result.interviewer3Score = result.interviewer3Score || 0;
      result.interviewer3Comment = result.interviewer3Comment || '';
      result.secondScore = result.secondScore || 0;
      result.secondComment = result.secondComment || '';
      result.secondInterviewer = result.secondInterviewer || '';
      result.finalDepartment = result.finalDepartment || '';
      result.judgeComment = result.judgeComment || '';
      result.score = result.score || result.finalScore || 0;
      // 构造scores数组，结果管理页面需要这个字段
      const scores = [];
      if (result.interviewer1Name) {
        scores.push({
          interviewerName: result.interviewer1Name,
          score: Number(result.interviewer1Score) || 0,
          comment: result.interviewer1Comment || '',
          judgeComment: result.interviewer1Comment || '',
          createdAt: result.createdAt || new Date().toISOString()
        });
      }
      if (result.interviewer2Name) {
        scores.push({
          interviewerName: result.interviewer2Name,
          score: Number(result.interviewer2Score) || 0,
          comment: result.interviewer2Comment || '',
          judgeComment: result.interviewer2Comment || '',
          createdAt: result.createdAt || new Date().toISOString()
        });
      }
      if (result.interviewer3Name) {
        scores.push({
          interviewerName: result.interviewer3Name,
          score: Number(result.interviewer3Score) || 0,
          comment: result.interviewer3Comment || '',
          judgeComment: result.interviewer3Comment || '',
          createdAt: result.createdAt || new Date().toISOString()
        });
      }
      result.scores = scores;
      result.scoredCount = scores.length;
      // 计算平均分
      if (scores.length > 0) {
        const total = scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
        result.averageScore = Math.round(total / scores.length * 100) / 100;
      } else {
        result.averageScore = Number(result.finalScore) || 0;
      }
      // 确保日期字段是字符串
      if (result.createdAt instanceof Date) result.createdAt = result.createdAt.toISOString();
      if (result.updatedAt instanceof Date) result.updatedAt = result.updatedAt.toISOString();
      if (!result.createdAt) result.createdAt = new Date().toISOString();
      if (!result.updatedAt) result.updatedAt = new Date().toISOString();
    }
    return result;
  }
  return obj;
}

// 初始化数据库
async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS candidates (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      gender VARCHAR(10),
      student_id VARCHAR(50),
      phone VARCHAR(20),
      class_name VARCHAR(100),
      first_department VARCHAR(50),
      second_department VARCHAR(50),
      accept_adjust VARCHAR(10),
      status VARCHAR(50) DEFAULT 'pre_registered',
      group_name VARCHAR(10),
      group_number INT,
      overall_number INT,
      global_number INT,
      final_score DECIMAL(5,2),
      interviewer1_name VARCHAR(100),
      interviewer1_score DECIMAL(5,2),
      interviewer1_comment TEXT,
      interviewer2_name VARCHAR(100),
      interviewer2_score DECIMAL(5,2),
      interviewer2_comment TEXT,
      interviewer3_name VARCHAR(100),
      interviewer3_score DECIMAL(5,2),
      interviewer3_comment TEXT,
      second_score DECIMAL(5,2),
      second_comment TEXT,
      second_interviewer VARCHAR(100),
      final_department VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    // 给旧表添加新字段（如果不存在）
    try {
      const columns = await conn.execute("SHOW COLUMNS FROM candidates");
      const colNames = columns[0].map(c => c.Field);
      if (!colNames.includes('gender')) await conn.execute("ALTER TABLE candidates ADD COLUMN gender VARCHAR(10)");
      if (!colNames.includes('first_department')) await conn.execute("ALTER TABLE candidates ADD COLUMN first_department VARCHAR(50)");
      if (!colNames.includes('second_department')) await conn.execute("ALTER TABLE candidates ADD COLUMN second_department VARCHAR(50)");
      if (!colNames.includes('accept_adjust')) await conn.execute("ALTER TABLE candidates ADD COLUMN accept_adjust VARCHAR(10)");
      if (!colNames.includes('global_number')) await conn.execute("ALTER TABLE candidates ADD COLUMN global_number INT");
      if (!colNames.includes('overall_number')) await conn.execute("ALTER TABLE candidates ADD COLUMN overall_number INT");
      if (!colNames.includes('final_score')) await conn.execute("ALTER TABLE candidates ADD COLUMN final_score DECIMAL(5,2)");
      if (!colNames.includes('interviewer1_name')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer1_name VARCHAR(100)");
      if (!colNames.includes('interviewer1_score')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer1_score DECIMAL(5,2)");
      if (!colNames.includes('interviewer1_comment')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer1_comment TEXT");
      if (!colNames.includes('interviewer2_name')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer2_name VARCHAR(100)");
      if (!colNames.includes('interviewer2_score')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer2_score DECIMAL(5,2)");
      if (!colNames.includes('interviewer2_comment')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer2_comment TEXT");
      if (!colNames.includes('interviewer3_name')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer3_name VARCHAR(100)");
      if (!colNames.includes('interviewer3_score')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer3_score DECIMAL(5,2)");
      if (!colNames.includes('interviewer3_comment')) await conn.execute("ALTER TABLE candidates ADD COLUMN interviewer3_comment TEXT");
      if (!colNames.includes('hobby')) await conn.execute("ALTER TABLE candidates ADD COLUMN hobby VARCHAR(500)");
      if (!colNames.includes('created_at')) await conn.execute("ALTER TABLE candidates ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      if (!colNames.includes('updated_at')) await conn.execute("ALTER TABLE candidates ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
      // 确保表和连接都是utf8mb4，避免中文乱码
      try { await conn.execute("ALTER TABLE candidates CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); } catch(e) {}
      // 把旧的overall_number数据复制到global_number
      await conn.execute("UPDATE candidates SET global_number = overall_number WHERE global_number IS NULL AND overall_number IS NOT NULL");
    } catch (e) { console.log('添加字段跳过:', e.message); }
    await conn.execute(`CREATE TABLE IF NOT EXISTS interviewer_scores (
      id VARCHAR(36) PRIMARY KEY,
      candidate_id VARCHAR(36) NOT NULL,
      interviewer_name VARCHAR(100) NOT NULL,
      group_name VARCHAR(10),
      score DECIMAL(5,2),
      comment TEXT,
      round_type VARCHAR(10) DEFAULT 'first',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // 系统设置表（存储当前模式：一面/二面）
    await conn.execute(`CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(50) PRIMARY KEY,
      \`value\` TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    // 初始化默认设置
    const [settingsRows] = await conn.execute("SELECT * FROM settings WHERE `key`='mode'");
    if (settingsRows.length === 0) {
      await conn.execute("INSERT INTO settings (`key`,`value`) VALUES ('mode','first')");
    }
    console.log('数据库初始化完成，连接成功！');
  } catch (e) {
    console.log('数据库初始化警告:', e.message);
  } finally {
    conn.release();
  }
}

// ========== API接口（和前端完全一致，全部加容错） ==========

// 面试官登录
app.post('/api/candidates/interviewer-login', async (req, res) => {
  try {
    const { name } = req.body;
    if (name === 'guido') return res.json({ success: true, name, groupName: 'A', role: 'admin' });
    // 只有名字叫"流动人员"才能登录为流动人员
    if (name === '流动人员') return res.json({ success: true, name, role: 'floating' });
    const interviewers = [
      // 二面 E组
      {name:'刘代贵',g:'E'},{name:'黄俊杰',g:'E'},{name:'梁文燕',g:'E'},{name:'王之乔',g:'E'},{name:'温嘉果',g:'E'},
      // 二面 F组
      {name:'叶奎靖',g:'F'},{name:'庄煜波',g:'F'},{name:'袁烨',g:'F'},{name:'钱金怡',g:'F'},{name:'杜雯',g:'F'},
      // 一面 A组
      {name:'钱金怡',g:'A'},{name:'陈乙健',g:'A'},{name:'杜雯',g:'A'},
      // 一面 B组
      {name:'黄俊杰',g:'B'},{name:'王涛',g:'B'},{name:'王之乔',g:'B'},
      // 一面 C组
      {name:'李伟盛',g:'C'},{name:'庄煜波',g:'C'},{name:'袁烨',g:'C'},
      // 一面 D组
      {name:'刘代贵',g:'D'},
    ];
    const f = interviewers.find(i => i.name === name);
    if (f) return res.json({ success: true, name, groupName: f.g, role: 'interviewer' });
    res.json({ success: false, message: '不在名单中' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ========== 系统设置接口 ==========
// 获取当前模式（一面/二面）
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT `key`,`value` FROM settings");
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 更新设置（管理员）
app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    await pool.execute(
      "INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?",
      [key, value, value]
    );
    res.json({ success: true, message: '设置更新成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 工具函数：获取当前模式
async function getCurrentMode() {
  try {
    const [rows] = await pool.execute("SELECT `value` FROM settings WHERE `key`='mode' LIMIT 1");
    return rows.length > 0 ? rows[0].value : 'first';
  } catch (e) { return 'first'; }
}

// 获取所有候选人（支持分页、搜索、筛选、排序）
app.get('/api/candidates', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, search, status, groupName, group, sortBy = 'globalNumber', sortOrder = 'asc', minScore, maxScore } = req.query;
    const searchKey = keyword || search || '';
    const groupKey = groupName || group || '';
    let where = 'WHERE 1=1';
    const params = [];
    if (searchKey) {
      where += ' AND (name LIKE ? OR class_name LIKE ? OR phone LIKE ? OR student_id LIKE ?)';
      params.push(`%${searchKey}%`, `%${searchKey}%`, `%${searchKey}%`, `%${searchKey}%`);
    }
    if (status && status !== 'all') {
      where += ' AND status = ?';
      params.push(status);
    }
    if (groupKey && groupKey !== 'all' && groupKey !== 'none') {
      where += ' AND group_name = ?';
      params.push(groupKey);
    }
    if (groupKey === 'none') {
      where += ' AND (group_name IS NULL OR group_name = "")';
    }
    // 按分数筛选
    if (minScore !== undefined && minScore !== '' && minScore !== null) {
      where += ' AND (final_score >= ? OR (COALESCE(interviewer1_score,0)+COALESCE(interviewer2_score,0)+COALESCE(interviewer3_score,0))/3 >= ?)';
      params.push(Number(minScore), Number(minScore));
    }
    if (maxScore !== undefined && maxScore !== '' && maxScore !== null) {
      where += ' AND (final_score <= ? OR final_score IS NULL)';
      params.push(Number(maxScore));
    }
    // 排序：支持按平均分、全场序号、创建时间等
    // 结果管理页面（有minScore/maxScore参数）默认按分数降序，其他页面默认按global_number升序
    let order = 'global_number';
    let orderDir = sortOrder === 'desc' ? 'DESC' : 'ASC';
    if (sortBy === 'averageScore' || sortBy === 'finalScore' || sortBy === 'score') {
      order = 'final_score';
      orderDir = 'DESC';
    } else if (sortBy === 'globalNumber') {
      order = 'global_number';
    } else if (sortBy === 'createdAt' || sortBy === 'created_at') {
      order = 'created_at';
    } else if (sortBy === 'name') {
      order = 'name';
    } else if (sortBy === 'checkinPriority' || sortBy === 'checkin-priority') {
      // 签到分流台专用排序：
      // 第1优先级：正在分流操作的（waiting待面试、interviewing面试中、pending_approval待审批）
      // 第2优先级：未签到的（pre_registered）
      // 第3优先级：已完成一面的（completed）
      order = `CASE status 
        WHEN 'waiting' THEN 1 
        WHEN 'interviewing' THEN 1
        WHEN 'pending_approval' THEN 1
        WHEN 'pre_registered' THEN 2 
        WHEN 'completed' THEN 3
        WHEN 'second_waiting' THEN 4
        WHEN 'second_interviewing' THEN 5
        ELSE 8 
      END, group_name ASC, group_number ASC, global_number ASC`;
      orderDir = '';
    } else if (!sortBy || sortBy === 'globalNumber') {
      // 没有指定排序时，如果是结果管理页面（有分数筛选），按分数降序
      if (minScore !== undefined || maxScore !== undefined) {
        order = 'final_score';
        orderDir = 'DESC';
      } else {
        order = 'global_number';
      }
    }
    const orderStr = orderDir ? `${order} ${orderDir}` : order;
    const [count] = await pool.execute(`SELECT COUNT(*) as total FROM candidates ${where}`, params);
    const offset = (Number(page) - 1) * Number(pageSize);
    const [rows] = await pool.execute(`SELECT * FROM candidates ${where} ORDER BY ${orderStr} LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
    const items = toCamel(rows);
    // 计算统计数据（基于当前筛选条件），前端结果管理页面需要这个
    const [completedRows] = await pool.execute(`SELECT COUNT(*) as n FROM candidates ${where} AND status='completed'`, params);
    const [scoredRows] = await pool.execute(`SELECT COUNT(*) as n FROM candidates ${where} AND (final_score IS NOT NULL OR interviewer1_score IS NOT NULL OR interviewer2_score IS NOT NULL OR interviewer3_score IS NOT NULL)`, params);
    const [avgRows] = await pool.execute(`SELECT AVG(final_score) as avg FROM candidates ${where} AND final_score IS NOT NULL`, params);
    let avgScore = 0;
    if (avgRows.length && avgRows[0].avg) avgScore = Math.round(Number(avgRows[0].avg) * 100) / 100;
    const stats = {
      total: count[0].total,
      completed: completedRows[0].n,
      completedCount: completedRows[0].n,
      scored: scoredRows[0].n,
      scoredCount: scoredRows[0].n,
      averageScore: avgScore,
      avgScore: avgScore
    };
    res.json({ items, total: count[0].total, stats, data: items, list: items, candidates: items, page: Number(page), pageSize: Number(pageSize) });
  } catch (e) {
    console.log('获取候选人列表错误:', e.message);
    res.json({ items: [], total: 0, data: [], list: [], candidates: [], page: 1, pageSize: 20 });
  }
});

// 公开按姓名搜索（前端期望返回数组，用length判断是否找到）
app.post('/api/candidates/public/search-by-name', async (req, res) => {
  try {
    // 兼容前端传字符串或对象
    const name = typeof req.body === 'string' ? req.body : (req.body.name || req.body.Name || '');
    const currentMode = await getCurrentMode();
    
    if (currentMode === 'second') {
      // 二面模式：只返回一面完成的人（completed状态）
      const [rows] = await pool.execute("SELECT * FROM candidates WHERE name = ? AND status IN ('completed','pre_registered','second_waiting') ORDER BY created_at DESC LIMIT 1", [name]);
      if (!rows.length) return res.json([]);
      res.json([toCamel(rows[0])]);
    } else {
      // 一面模式：正常查询
      const [rows] = await pool.execute('SELECT * FROM candidates WHERE name = ? ORDER BY created_at DESC LIMIT 1', [name]);
      if (!rows.length) return res.json([]);
      res.json([toCamel(rows[0])]);
    }
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 公开签到（支持candidateId或name两种方式）
app.post('/api/candidates/public/check-in', async (req, res) => {
  try {
    // 兼容前端传字符串（姓名）或对象
    let name, studentId, phone, className, department1, department2, department3, candidateId;
    if (typeof req.body === 'string') {
      name = req.body;
    } else {
      ({ name, studentId, phone, className, department1, department2, department3, candidateId } = req.body || {});
    }
    let existing = [];
    // 优先用candidateId查找
    if (candidateId) {
      [existing] = await pool.execute('SELECT * FROM candidates WHERE id = ? LIMIT 1', [candidateId]);
    }
    // 没有candidateId或没找到，用name查找
    if (!existing.length && name) {
      [existing] = await pool.execute('SELECT * FROM candidates WHERE name = ? ORDER BY created_at DESC LIMIT 1', [name]);
    }
    if (existing.length) {
      const c = existing[0];
      const currentMode = await getCurrentMode();
      
      if (currentMode === 'second') {
        // 二面模式：只允许一面完成的人（completed）签到
        if (c.status !== 'completed' && c.status !== 'pre_registered') {
          const result = toCamel(c);
          result.success = false;
          result.message = c.status === 'second_waiting' ? '已二面签到过' : '不是一面完成的人，不能二面签到';
          return res.json(result);
        }
        // 二面签到：状态改成second_waiting
        await pool.execute("UPDATE candidates SET status='second_waiting' WHERE id=?", [c.id]);
        const [upd] = await pool.execute('SELECT * FROM candidates WHERE id=?', [c.id]);
        const result = toCamel(upd[0]);
        result.success = true;
        result.message = '二面签到成功';
        return res.json(result);
      } else {
        // 一面模式：正常签到
        if (!['pre_registered', 'waiting'].includes(c.status)) {
          const result = toCamel(c);
          result.success = false;
          result.message = '已签到过';
          return res.json(result);
        }
        const [max] = await pool.execute('SELECT MAX(global_number) n FROM candidates');
        const num = (max[0].n || 0) + 1;
        await pool.execute("UPDATE candidates SET status='waiting', global_number=?, overall_number=? WHERE id=?", [num, num, c.id]);
        const [upd] = await pool.execute('SELECT * FROM candidates WHERE id=?', [c.id]);
        const result = toCamel(upd[0]);
        result.success = true;
        result.message = '签到成功';
        return res.json(result);
      }
    }
    // 都没找到，创建新候选人
    if (!name && !candidateId) return res.json({ success: false, message: '请输入姓名' });
    const id = uuidv4();
    const [max] = await pool.execute('SELECT MAX(global_number) n FROM candidates');
    const num = (max[0].n || 0) + 1;
    await pool.execute(`INSERT INTO candidates (id,name,student_id,phone,class_name,first_department,second_department,status,global_number,overall_number) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id,name,studentId,phone,className,department1,department2,'waiting',num,num]);
    const [newC] = await pool.execute('SELECT * FROM candidates WHERE id=?', [id]);
    const result = toCamel(newC[0]);
    result.success = true;
    result.message = '签到成功';
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 公开获取详情
app.get('/api/candidates/public/detail/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM candidates WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: '未找到' });
    // 直接返回候选人对象，兼容前端的e.firstDepartment/e.className等字段访问
    const result = toCamel(rows[0]);
    result.success = true;
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 签到（管理员/流动人员用）
app.post('/api/candidates/check-in', async (req, res) => {
  try {
    const { candidateId, operatorName } = req.body;
    const [max] = await pool.execute('SELECT MAX(global_number) n FROM candidates');
    const num = (max[0].n || 0) + 1;
    await pool.execute("UPDATE candidates SET status='waiting', global_number=?, overall_number=? WHERE id=?", [num, num, candidateId]);
    res.json({ success: true, message: '签到成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 预注册
app.post('/api/candidates/pre-register', async (req, res) => {
  try {
    const { name, gender, className, phone, firstDepartment, secondDepartment, acceptAdjust } = req.body;
    const id = uuidv4();
    await pool.execute(`INSERT INTO candidates (id,name,gender,class_name,phone,first_department,second_department,accept_adjust,status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id,name,gender||null,className||null,phone||null,firstDepartment||null,secondDepartment||null,acceptAdjust||'否','pre_registered']);
    const [newC] = await pool.execute('SELECT * FROM candidates WHERE id=?', [id]);
    res.json(toCamel(newC[0]));
  } catch (e) { res.status(500).json({ id: uuidv4(), name: req.body.name, status: 'pre_registered' }); }
});

// 公开预注册/签到（前端首页签到用：先预注册获取id，再check-in）
app.post('/api/candidates/pre-register/public', async (req, res) => {
  try {
    const { name, gender, className, phone, firstDepartment, secondDepartment, acceptAdjust, force } = req.body;
    if (!name) return res.status(400).json({ message: '请输入姓名' });
    // 先查找是否已存在同名候选人
    const [existing] = await pool.execute('SELECT * FROM candidates WHERE name = ? ORDER BY created_at DESC LIMIT 1', [name]);
    if (existing.length && !force) {
      return res.json(toCamel(existing[0]));
    }
    // 创建新候选人
    const id = uuidv4();
    await pool.execute(`INSERT INTO candidates (id,name,gender,class_name,phone,first_department,second_department,accept_adjust,status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id,name,gender||null,className||null,phone||null,firstDepartment||null,secondDepartment||null,acceptAdjust||'否','pre_registered']);
    const [newC] = await pool.execute('SELECT * FROM candidates WHERE id=?', [id]);
    res.json(toCamel(newC[0]));
  } catch (e) { res.status(500).json({ id: uuidv4(), name: req.body.name, status: 'pre_registered' }); }
});

// 批量导入（支持CSV里的所有字段：面试官评分、最终总分、组内序号、全场序号等）
app.post('/api/candidates/batch-import', async (req, res) => {
  try {
    const { items, operatorName } = req.body;
    let success = 0, failed = 0, updated = 0, inserted = 0;
    const errors = [];
    for (const item of items) {
      try {
        const name = item.name || item.姓名 || '';
        if (!name) { failed++; errors.push({ name: '未知', error: '姓名为空' }); continue; }
        
        // 处理状态：中文转英文，支持多种字段名
        let status = item.status || item.interviewStatus || item.面试状态 || item.state || null;
        if (typeof status === 'string') {
          if (status.includes('已完成') || status === 'completed' || status === 'first_completed' || status.includes('一面完成') || status.includes('面试完成')) status = 'completed';
          else if (status.includes('预报名') || status === 'pre_registered') status = 'pre_registered';
          else if (status.includes('待面试') || status.includes('已签到') || status === 'waiting') status = 'waiting';
          else if (status.includes('面试中') || status === 'interviewing') status = 'interviewing';
          else if (status.includes('缺考') || status === 'absent') status = 'absent';
          else if (status.includes('待审批') || status === 'pending_approval') status = 'pending_approval';
        }
        
        // 收集所有字段（只收集有值的，用于合并更新）
        const fields = {};
        if (item.gender || item.性别) fields.gender = item.gender || item.性别;
        if (item.studentId || item.student_id || item.学号) fields.student_id = item.studentId || item.student_id || item.学号;
        if (item.phone || item.电话 || item.手机号) fields.phone = item.phone || item.电话 || item.手机号;
        if (item.className || item.class_name || item.班级) fields.class_name = item.className || item.class_name || item.班级;
        if (item.firstDepartment || item.first_department || item.department1 || item.意向部门) fields.first_department = item.firstDepartment || item.first_department || item.department1 || item.意向部门;
        if (item.secondDepartment || item.second_department || item.department2) fields.second_department = item.secondDepartment || item.second_department || item.department2;
        if (item.acceptAdjust || item.accept_adjust || item.是否调剂) fields.accept_adjust = item.acceptAdjust || item.accept_adjust || item.是否调剂;
        if (status) fields.status = status;
        if (item.groupName || item.group_name || item.分配组别 || item.组别) fields.group_name = item.groupName || item.group_name || item.分配组别 || item.组别;
        if (item.groupNumber || item.group_number || item.组内序号) fields.group_number = Number(item.groupNumber || item.group_number || item.组内序号);
        if (item.globalNumber || item.global_number || item.全场序号 || item.overallNumber || item.overall_number) {
          fields.global_number = Number(item.globalNumber || item.global_number || item.全场序号 || item.overallNumber || item.overall_number);
          fields.overall_number = Number(item.globalNumber || item.global_number || item.全场序号 || item.overallNumber || item.overall_number);
        }
        if (item.finalScore || item.final_score || item.totalScore || item.最终总分 || item.最终平均分) fields.final_score = Number(item.finalScore || item.final_score || item.totalScore || item.最终总分 || item.最终平均分);
        if (item.interviewer1Name || item.interviewer1_name || item.面试官1姓名) fields.interviewer1_name = item.interviewer1Name || item.interviewer1_name || item.面试官1姓名;
        if (item.interviewer1Score || item.interviewer1_score || item.面试官1分数) fields.interviewer1_score = Number(item.interviewer1Score || item.interviewer1_score || item.面试官1分数);
        if (item.interviewer1Comment || item.interviewer1_comment || item.面试官1备注) fields.interviewer1_comment = item.interviewer1Comment || item.interviewer1_comment || item.面试官1备注;
        if (item.interviewer2Name || item.interviewer2_name || item.面试官2姓名) fields.interviewer2_name = item.interviewer2Name || item.interviewer2_name || item.面试官2姓名;
        if (item.interviewer2Score || item.interviewer2_score || item.面试官2分数) fields.interviewer2_score = Number(item.interviewer2Score || item.interviewer2_score || item.面试官2分数);
        if (item.interviewer2Comment || item.interviewer2_comment || item.面试官2备注) fields.interviewer2_comment = item.interviewer2Comment || item.interviewer2_comment || item.面试官2备注;
        if (item.interviewer3Name || item.interviewer3_name || item.面试官3姓名) fields.interviewer3_name = item.interviewer3Name || item.interviewer3_name || item.面试官3姓名;
        if (item.interviewer3Score || item.interviewer3_score || item.面试官3分数) fields.interviewer3_score = Number(item.interviewer3Score || item.interviewer3_score || item.面试官3分数);
        if (item.interviewer3Comment || item.interviewer3_comment || item.面试官3备注) fields.interviewer3_comment = item.interviewer3Comment || item.interviewer3_comment || item.面试官3备注;
        
        // 自动修复：有面试官评分但状态还是预报名/空的，自动设为已完成
        const hasAnyScore = fields.interviewer1_score || fields.interviewer2_score || fields.interviewer3_score || fields.final_score;
        if (hasAnyScore && (!fields.status || fields.status === 'pre_registered')) {
          fields.status = 'completed';
        }
        
        // 查找是否已存在同名候选人
        const [existing] = await pool.execute('SELECT * FROM candidates WHERE name=? LIMIT 1', [name]);
        
        if (existing.length > 0) {
          // 已存在：只更新缺失字段，不覆盖已有内容
          const row = existing[0];
          const updateFields = [];
          const updateValues = [];
          // 这些关键字段总是覆盖（意向部门、是否调剂、状态、评分等基础信息）
          const alwaysOverwrite = ['first_department', 'second_department', 'accept_adjust', 'status', 'final_score', 'gender', 'class_name', 'phone'];
          for (const [key, value] of Object.entries(fields)) {
            // 关键字段总是覆盖，其他字段只在为空时更新
            if (alwaysOverwrite.includes(key) || row[key] === null || row[key] === undefined || row[key] === '') {
              updateFields.push(`${key}=?`);
              updateValues.push(value);
            }
          }
          if (updateFields.length > 0) {
            updateValues.push(row.id);
            await pool.execute(`UPDATE candidates SET ${updateFields.join(',')} WHERE id=?`, updateValues);
            updated++;
          }
          success++;
        } else {
          // 不存在：新增记录
          const id = uuidv4();
          await pool.execute(`INSERT INTO candidates 
            (id,name,gender,student_id,phone,class_name,first_department,second_department,accept_adjust,
             status,group_name,group_number,global_number,overall_number,final_score,
             interviewer1_name,interviewer1_score,interviewer1_comment,
             interviewer2_name,interviewer2_score,interviewer2_comment,
             interviewer3_name,interviewer3_score,interviewer3_comment) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, name,
             fields.gender || null, fields.student_id || null, fields.phone || null,
             fields.class_name || null, fields.first_department || null, fields.second_department || null,
             fields.accept_adjust || '否', fields.status || 'pre_registered',
             fields.group_name || null, fields.group_number || null,
             fields.global_number || null, fields.overall_number || null, fields.final_score || null,
             fields.interviewer1_name || null, fields.interviewer1_score || null, fields.interviewer1_comment || null,
             fields.interviewer2_name || null, fields.interviewer2_score || null, fields.interviewer2_comment || null,
             fields.interviewer3_name || null, fields.interviewer3_score || null, fields.interviewer3_comment || null
            ]);
          inserted++;
          success++;
        }
      } catch (e) {
        failed++;
        errors.push({ name: item.name || item.姓名 || '未知', error: e.message });
      }
    }
    res.json({ success, failed, errors, updated, inserted });
  } catch (e) { res.json({ success: 0, failed: items?.length || 0, errors: [], updated: 0, inserted: 0 }); }
});

// 分配组
app.post('/api/candidates/assign-group', async (req, res) => {
  try {
    const { candidateId, groupName, operatorName } = req.body;
    const [max] = await pool.execute('SELECT MAX(group_number) n FROM candidates WHERE group_name=?', [groupName]);
    await pool.execute("UPDATE candidates SET group_name=?, group_number=?, status='waiting' WHERE id=?", [groupName, (max[0].n||0)+1, candidateId]);
    res.json({ success: true, message: '分配成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 重新分配组
app.post('/api/candidates/reassign-group', async (req, res) => {
  try {
    const { candidateId, groupName, operatorName } = req.body;
    const [max] = await pool.execute('SELECT MAX(group_number) n FROM candidates WHERE group_name=?', [groupName]);
    await pool.execute("UPDATE candidates SET group_name=?, group_number=? WHERE id=?", [groupName, (max[0].n||0)+1, candidateId]);
    res.json({ success: true, message: '改派成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 获取组内候选人（前端期望直接返回数组）
app.get('/api/candidates/group/:groupName', async (req, res) => {
  try {
    const { interviewerName } = req.query;
    const [rows] = await pool.execute('SELECT * FROM candidates WHERE group_name=? ORDER BY group_number', [req.params.groupName]);
    const list = toCamel(rows);
    // 同时兼容数组和对象格式，前端用展开运算符，所以直接返回数组
    res.json(list);
  } catch (e) {
    console.log('获取组内候选人错误:', e.message);
    res.json([]);
  }
});

// 更新状态
app.patch('/api/candidates/:id/status', async (req, res) => {
  try {
    const { status, interviewerName } = req.body;
    await pool.execute('UPDATE candidates SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: '状态更新成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 提交打分
app.post('/api/candidates/:id/score', async (req, res) => {
  try {
    const { score, interviewerName, judgeComment, comment } = req.body;
    const cid = req.params.id;
    const scoreValue = Number(score);
    const commentValue = judgeComment || comment || '';

    // 先查询当前候选人
    const [rows] = await pool.execute('SELECT * FROM candidates WHERE id=?', [cid]);
    if (!rows.length) return res.status(404).json({ success: false, message: '候选人不存在' });
    const c = rows[0];

    // 根据面试官名字判断是第几个面试官
    let fieldPrefix = '';
    if (c.interviewer1_name === interviewerName || !c.interviewer1_name) {
      fieldPrefix = 'interviewer1';
    } else if (c.interviewer2_name === interviewerName || !c.interviewer2_name) {
      fieldPrefix = 'interviewer2';
    } else if (c.interviewer3_name === interviewerName || !c.interviewer3_name) {
      fieldPrefix = 'interviewer3';
    } else {
      // 都不匹配，找第一个空的
      if (!c.interviewer1_name) fieldPrefix = 'interviewer1';
      else if (!c.interviewer2_name) fieldPrefix = 'interviewer2';
      else fieldPrefix = 'interviewer3';
    }

    // 更新candidates表的面试官字段
    await pool.execute(
      `UPDATE candidates SET ${fieldPrefix}_name=?, ${fieldPrefix}_score=?, ${fieldPrefix}_comment=?, status='pending_approval' WHERE id=?`,
      [interviewerName, scoreValue, commentValue, cid]
    );

    // 重新查询，计算平均分
    const [updated] = await pool.execute('SELECT * FROM candidates WHERE id=?', [cid]);
    const u = updated[0];
    const scores = [];
    if (u.interviewer1_score) scores.push(Number(u.interviewer1_score));
    if (u.interviewer2_score) scores.push(Number(u.interviewer2_score));
    if (u.interviewer3_score) scores.push(Number(u.interviewer3_score));
    const finalScore = scores.length ? Math.round((scores.reduce((a,b) => a+b, 0) / scores.length) * 100) / 100 : 0;

    // 更新最终分
    await pool.execute('UPDATE candidates SET final_score=? WHERE id=?', [finalScore, cid]);

    // 同时往interviewer_scores表插入记录（兼容旧逻辑）
    const logId = uuidv4();
    try {
      await pool.execute('INSERT INTO interviewer_scores (id,candidate_id,interviewer_name,score,comment) VALUES (?,?,?,?,?)',
        [logId, cid, interviewerName, scoreValue, commentValue]);
    } catch(e) { /* 忽略，表可能不存在 */ }

    res.json({ success: true, message: '打分成功', finalScore, scoredCount: scores.length });
  } catch (e) {
    console.log('打分错误:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 审批
app.post('/api/candidates/:id/approve', async (req, res) => {
  try {
    const { operatorName } = req.body;
    const cid = req.params.id;

    // 重新计算最终分
    const [rows] = await pool.execute('SELECT * FROM candidates WHERE id=?', [cid]);
    if (!rows.length) return res.status(404).json({ success: false, message: '候选人不存在' });
    const c = rows[0];
    const scores = [];
    if (c.interviewer1_score) scores.push(Number(c.interviewer1_score));
    if (c.interviewer2_score) scores.push(Number(c.interviewer2_score));
    if (c.interviewer3_score) scores.push(Number(c.interviewer3_score));
    const finalScore = scores.length ? Math.round((scores.reduce((a,b) => a+b, 0) / scores.length) * 100) / 100 : 0;

    await pool.execute('UPDATE candidates SET status=?, final_score=? WHERE id=?', ['completed', finalScore, cid]);
    res.json({ success: true, message: '审批通过', finalScore });
  } catch (e) {
    console.log('审批错误:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 删除单个候选人
app.delete('/api/candidates/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM candidates WHERE id=?', [req.params.id]);
    await pool.execute('DELETE FROM interviewer_scores WHERE candidate_id=?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 导出CSV（前端结果管理页面调用）
app.get('/api/candidates/export', async (req, res) => {
  try {
    const { keyword, groupName, minScore, maxScore } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (keyword) {
      where += ' AND (name LIKE ? OR class_name LIKE ? OR student_id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (groupName && groupName !== 'all') {
      where += ' AND group_name = ?';
      params.push(groupName);
    }
    if (minScore !== undefined && minScore !== '') {
      where += ' AND (final_score >= ? OR final_score IS NULL)';
      params.push(Number(minScore));
    }
    if (maxScore !== undefined && maxScore !== '') {
      where += ' AND (final_score <= ? OR final_score IS NULL)';
      params.push(Number(maxScore));
    }
    const [rows] = await pool.execute(`SELECT * FROM candidates ${where} ORDER BY final_score DESC, global_number ASC`, params);
    // 生成CSV
    const headers = ['全场序号','组内序号','姓名','性别','班级','学号','手机号','意向部门','第二意向部门','分配组别','面试状态','最终总分','面试官1姓名','面试官1分数','面试官1备注','面试官2姓名','面试官2分数','面试官2备注','面试官3姓名','面试官3分数','面试官3备注'];
    const statusMap = { pre_registered: '预报名', waiting: '待面试', interviewing: '面试中', pending_approval: '待审批', completed: '已完成', absent: '缺考' };
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      const row = [
        r.global_number || '',
        r.group_number || '',
        r.name || '',
        r.gender || '',
        r.class_name || '',
        r.student_id || '',
        r.phone || '',
        r.first_department || '',
        r.second_department || '',
        r.group_name || '',
        statusMap[r.status] || r.status || '',
        r.final_score || '',
        r.interviewer1_name || '',
        r.interviewer1_score || '',
        (r.interviewer1_comment || '').replace(/,/g, '，').replace(/\n/g, ' '),
        r.interviewer2_name || '',
        r.interviewer2_score || '',
        (r.interviewer2_comment || '').replace(/,/g, '，').replace(/\n/g, ' '),
        r.interviewer3_name || '',
        r.interviewer3_score || '',
        (r.interviewer3_comment || '').replace(/,/g, '，').replace(/\n/g, ' ')
      ];
      csvRows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    const csv = '\uFEFF' + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="面试结果_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 批量删除
app.post('/api/candidates/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.json({ success: true, message: '没有要删除的' });
    for (const id of ids) {
      await pool.execute('DELETE FROM candidates WHERE id=?', [id]);
      await pool.execute('DELETE FROM interviewer_scores WHERE candidate_id=?', [id]);
    }
    res.json({ success: true, message: `删除了${ids.length}条` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 全部删除
app.post('/api/candidates/delete-all', async (req, res) => {
  try {
    await pool.execute('DELETE FROM candidates');
    await pool.execute('DELETE FROM interviewer_scores');
    res.json({ success: true, message: '全部删除成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 二面分配组
app.post('/api/candidates/second/assign-group', async (req, res) => {
  try {
    const { candidateId, groupName, operatorName } = req.body;
    const [max] = await pool.execute('SELECT MAX(group_number) n FROM candidates WHERE group_name=?', [groupName]);
    await pool.execute("UPDATE candidates SET group_name=?, group_number=?, status='second_interviewing' WHERE id=?", [groupName, (max[0].n||0)+1, candidateId]);
    res.json({ success: true, message: '二面分配成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 二面签到
app.post('/api/candidates/second/check-in', async (req, res) => {
  try {
    const { candidateId } = req.body;
    await pool.execute("UPDATE candidates SET status='second_waiting' WHERE id=?", [candidateId]);
    res.json({ success: true, message: '二面签到成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 候场大屏数据
app.get('/api/candidates/display/big-screen', async (req, res) => {
  try {
    // 优先用前端传的mode，否则从数据库读取当前模式
    let mode = req.query.mode;
    if (!mode) {
      mode = await getCurrentMode();
    }
    const groups = [];
    const groupNames = mode === 'second' ? ['E','F'] : ['A','B','C','D'];
    let total = 0;
    for (const g of groupNames) {
      // 智能查询：同时兼容一面(waiting/interviewing)和二面(second_waiting/second_interviewing)状态
      // 优先显示二面状态，如果没有就显示一面状态
      let waitingRows, currentRows;
      if (mode === 'second') {
        // 二面模式：先查second_waiting，如果没有再查waiting
        [waitingRows] = await pool.execute("SELECT * FROM candidates WHERE group_name=? AND status='second_waiting' ORDER BY group_number", [g]);
        if (waitingRows.length === 0) {
          [waitingRows] = await pool.execute("SELECT * FROM candidates WHERE group_name=? AND status='waiting' ORDER BY group_number", [g]);
        }
        [currentRows] = await pool.execute("SELECT * FROM candidates WHERE group_name=? AND status IN ('second_interviewing','interviewing') ORDER BY updated_at DESC LIMIT 1", [g]);
      } else {
        // 一面模式：查waiting和interviewing
        [waitingRows] = await pool.execute("SELECT * FROM candidates WHERE group_name=? AND status='waiting' ORDER BY group_number", [g]);
        [currentRows] = await pool.execute("SELECT * FROM candidates WHERE group_name=? AND status='interviewing' ORDER BY updated_at DESC LIMIT 1", [g]);
      }
      const waitingList = toCamel(waitingRows);
      const currentItem = currentRows.length ? toCamel(currentRows[0]) : null;
      groups.push({
        groupName: g,
        name: g,
        waiting: waitingList,
        waitingList: waitingList,
        queue: waitingList,
        list: waitingList,
        candidates: waitingList,
        items: waitingList,
        waitingCount: waitingList.length,
        count: waitingList.length,
        total: waitingList.length,
        current: currentItem,
        currentCandidate: currentItem,
        interviewing: currentItem,
        now: currentItem,
        next: waitingList.length > 0 ? waitingList[0] : null,
        nextCandidate: waitingList.length > 0 ? waitingList[0] : null
      });
      total += waitingList.length;
    }
    res.json({
      mode,
      groups,
      total,
      totalWaiting: total,
      waitingTotal: total,
      currentTime: new Date().toISOString(),
      time: new Date().toISOString()
    });
  } catch (e) {
    console.log('候场大屏错误:', e.message);
    const defaultGroups = ['A','B','C','D'].map(g => ({
      groupName: g, name: g, waiting: [], waitingList: [], queue: [], list: [], candidates: [], items: [],
      waitingCount: 0, count: 0, total: 0, current: null, currentCandidate: null, interviewing: null,
      now: null, next: null, nextCandidate: null
    }));
    res.json({ mode: 'first', groups: defaultGroups, total: 0, totalWaiting: 0, waitingTotal: 0, currentTime: new Date().toISOString(), time: new Date().toISOString() });
  }
});

// 获取各组人数
app.get('/api/candidates/group-counts', async (req, res) => {
  try {
    const groups = ['A','B','C','D','E','F'];
    const result = [];
    for (const g of groups) {
      const [waiting] = await pool.execute("SELECT COUNT(*) as n FROM candidates WHERE group_name=? AND status='waiting'", [g]);
      const [interviewing] = await pool.execute("SELECT COUNT(*) as n FROM candidates WHERE group_name=? AND status='interviewing'", [g]);
      const [next] = await pool.execute("SELECT * FROM candidates WHERE group_name=? AND status='waiting' ORDER BY group_number LIMIT 1", [g]);
      result.push({
        groupName: g,
        name: g,
        group: g,
        waiting: waiting[0].n,
        waitingCount: waiting[0].n,
        count: waiting[0].n,
        total: waiting[0].n,
        interviewing: interviewing[0].n,
        interviewingCount: interviewing[0].n,
        nextWaiting: next.length ? toCamel(next[0]) : null,
        next: next.length ? toCamel(next[0]) : null,
        nextCandidate: next.length ? toCamel(next[0]) : null
      });
    }
    res.json(result);
  } catch (e) {
    console.log('获取分组人数错误:', e.message);
    res.json(['A','B','C','D','E','F'].map(g => ({
      groupName: g, name: g, group: g, waiting: 0, waitingCount: 0, count: 0, total: 0,
      interviewing: 0, interviewingCount: 0, nextWaiting: null, next: null, nextCandidate: null
    })));
  }
});

// 统计数据（结果管理页面需要：总人数、已完成、有分人数、整体平均分）
app.get('/api/candidates/stats', async (req, res) => {
  try {
    const { keyword, groupName, minScore, maxScore } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (keyword) {
      where += ' AND (name LIKE ? OR class_name LIKE ? OR student_id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (groupName && groupName !== 'all') {
      where += ' AND group_name = ?';
      params.push(groupName);
    }
    const [total] = await pool.execute(`SELECT COUNT(*) as n FROM candidates ${where}`, params);
    const [completed] = await pool.execute(`SELECT COUNT(*) as n FROM candidates ${where} AND status='completed'`, params);
    const [scored] = await pool.execute(`SELECT COUNT(*) as n FROM candidates ${where} AND (final_score IS NOT NULL OR interviewer1_score IS NOT NULL OR interviewer2_score IS NOT NULL OR interviewer3_score IS NOT NULL)`, params);
    const [avgRows] = await pool.execute(`SELECT AVG(final_score) as avg FROM candidates ${where} AND final_score IS NOT NULL`, params);
    let avgScore = 0;
    if (avgRows.length && avgRows[0].avg) avgScore = Math.round(Number(avgRows[0].avg) * 100) / 100;
    
    res.json({
      total: total[0].n,
      totalCandidates: total[0].n,
      count: total[0].n,
      completed: completed[0].n,
      completedCount: completed[0].n,
      finished: completed[0].n,
      scored: scored[0].n,
      scoredCount: scored[0].n,
      hasScore: scored[0].n,
      averageScore: avgScore,
      avgScore: avgScore,
      overallAverage: avgScore,
      // 兼容旧字段
      checkedIn: total[0].n,
      waiting: 0,
      interviewing: 0,
      pendingApproval: 0,
      preRegistered: 0
    });
  } catch (e) {
    console.log('统计错误:', e.message);
    res.json({
      total: 0, totalCandidates: 0, count: 0, completed: 0, completedCount: 0, finished: 0,
      scored: 0, scoredCount: 0, hasScore: 0, averageScore: 0, avgScore: 0, overallAverage: 0,
      checkedIn: 0, waiting: 0, interviewing: 0, pendingApproval: 0, preRegistered: 0
    });
  }
});

// ========== SPA路由：只拦截非API的GET请求 ==========
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`服务器跑在端口${PORT}，数据库连接成功！`));
}).catch(err => {
  console.error('数据库连接失败:', err);
  app.listen(PORT, '0.0.0.0', () => console.log(`服务器跑在端口${PORT}，数据库未连接`));
});
