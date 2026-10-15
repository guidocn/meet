const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 直接读取1Panel注入的数据库环境变量
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mariadb',
  user: process.env.DB_USER || 'meet_user',
  password: process.env.DB_PASSWORD || 'zQ3fWkGKPsMzppH5',
  database: process.env.DB_NAME || 'meet_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// 初始化数据库
async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS candidates (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      student_id VARCHAR(50),
      phone VARCHAR(20),
      class_name VARCHAR(100),
      department1 VARCHAR(50),
      department2 VARCHAR(50),
      department3 VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pre_registered',
      group_name VARCHAR(10),
      group_number INT,
      overall_number INT,
      second_score DECIMAL(5,2),
      second_comment TEXT,
      second_interviewer VARCHAR(100),
      final_department VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
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
    console.log('数据库初始化完成，连接成功！');
  } finally {
    conn.release();
  }
}

// ========== API接口 ==========
app.post('/api/candidates/search-public', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM candidates WHERE name = ? ORDER BY created_at DESC LIMIT 1', [req.body.name]);
    if (!rows.length) return res.json({ success: false, message: '未找到该同学' });
    res.json({ success: true, candidate: rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/candidates/checkin-public', async (req, res) => {
  try {
    const { name, studentId, phone, className, department1, department2, department3 } = req.body;
    const [existing] = await pool.execute('SELECT * FROM candidates WHERE name = ? ORDER BY created_at DESC LIMIT 1', [name]);
    if (existing.length) {
      const c = existing[0];
      if (!['pre_registered', 'waiting'].includes(c.status)) return res.json({ success: false, message: '已签到过' });
      const [max] = await pool.execute('SELECT MAX(overall_number) n FROM candidates');
      await pool.execute("UPDATE candidates SET status='waiting', overall_number=? WHERE id=?", [(max[0].n||0)+1, c.id]);
      const [upd] = await pool.execute('SELECT * FROM candidates WHERE id=?', [c.id]);
      return res.json({ success: true, candidate: upd[0], message: '签到成功' });
    }
    const id = uuidv4();
    const [max] = await pool.execute('SELECT MAX(overall_number) n FROM candidates');
    await pool.execute(`INSERT INTO candidates (id,name,student_id,phone,class_name,department1,department2,department3,status,overall_number) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id,name,studentId,phone,className,department1,department2,department3,'waiting',(max[0].n||0)+1]);
    const [newC] = await pool.execute('SELECT * FROM candidates WHERE id=?', [id]);
    res.json({ success: true, candidate: newC[0], message: '签到成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/candidates/second-checkin-public', async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM candidates WHERE name=? AND status IN ('completed','first_completed') ORDER BY created_at DESC LIMIT 1", [req.body.name]);
    if (!rows.length) return res.json({ success: false, message: '未找到一面通过的同学' });
    await pool.execute("UPDATE candidates SET status='second_waiting' WHERE id=?", [rows[0].id]);
    const [upd] = await pool.execute('SELECT * FROM candidates WHERE id=?', [rows[0].id]);
    res.json({ success: true, candidate: upd[0], message: '二面签到成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/candidates/:id/public', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM candidates WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: '未找到' });
    res.json({ success: true, candidate: rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/candidates/login', async (req, res) => {
  try {
    const { name } = req.body;
    if (name === 'guido') return res.json({ success: true, name, groupName: 'A', role: 'admin' });
    const floating = ['梁文燕','李旭涵','郑发','高梓恒','温嘉果','冯梓珊','何承熹','吴梓鑫','梁浩辉'];
    if (floating.includes(name)) return res.json({ success: true, name, role: 'floating' });
    const interviewers = [
      {name:'钱金怡',g:'A'},{name:'陈乙健',g:'A'},{name:'杜雯',g:'A'},
      {name:'黄俊杰',g:'B'},{name:'王涛',g:'B'},{name:'王之乔',g:'B'},
      {name:'李伟盛',g:'C'},{name:'庄煜波',g:'C'},{name:'袁烨',g:'C'},
      {name:'刘代贵',g:'D'},
    ];
    const f = interviewers.find(i => i.name === name);
    if (f) return res.json({ success: true, name, groupName: f.g, role: 'interviewer' });
    res.json({ success: false, message: '不在名单中' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/candidates', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM candidates ORDER BY overall_number DESC');
    res.json({ success: true, candidates: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/candidates/:id/assign-group', async (req, res) => {
  try {
    const [max] = await pool.execute('SELECT MAX(group_number) n FROM candidates WHERE group_name=?', [req.body.groupName]);
    await pool.execute("UPDATE candidates SET group_name=?, group_number=?, status='waiting' WHERE id=?", [req.body.groupName, (max[0].n||0)+1, req.params.id]);
    res.json({ success: true, message: '分配成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/candidates/:id/assign-second-group', async (req, res) => {
  try {
    const [max] = await pool.execute('SELECT MAX(group_number) n FROM candidates WHERE group_name=?', [req.body.groupName]);
    await pool.execute("UPDATE candidates SET group_name=?, group_number=?, status='second_interviewing' WHERE id=?", [req.body.groupName, (max[0].n||0)+1, req.params.id]);
    res.json({ success: true, message: '二面分配成功' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/candidates/bigscreen', async (req, res) => {
  try {
    const [first] = await pool.execute("SELECT * FROM candidates WHERE status='waiting' AND group_name IN ('A','B','C','D') ORDER BY group_name, group_number");
    const [second] = await pool.execute("SELECT * FROM candidates WHERE status='second_interviewing' AND group_name IN ('E','F') ORDER BY group_name, group_number");
    res.json({ success: true, firstWaiting: first, secondWaiting: second });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ========== SPA路由 ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`服务器跑在端口${PORT}，数据库连接成功！`));
}).catch(err => {
  console.error('数据库连接失败:', err);
  app.listen(PORT, '0.0.0.0', () => console.log(`服务器跑在端口${PORT}，数据库未连接`));
});
