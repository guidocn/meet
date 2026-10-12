-- 社团招新面试叫号系统 - D1 数据库 Schema
-- SQLite (Cloudflare D1) 兼容版本

-- 考生表
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || lower(substr(hex(randomblob(2)),2)) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))),
  name TEXT NOT NULL,
  gender TEXT,
  class_name TEXT,
  student_id TEXT,
  phone TEXT,
  qq TEXT,
  first_department TEXT,
  second_department TEXT,
  skills TEXT,
  introduction TEXT,
  free_time TEXT,
  accept_transfer INTEGER DEFAULT 1,
  global_number INTEGER,
  group_name TEXT,
  group_number INTEGER,
  status TEXT DEFAULT 'pre_registered',
  score_total INTEGER DEFAULT 0,
  accept_adjust TEXT DEFAULT '否',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_group_name ON candidates(group_name);
CREATE INDEX IF NOT EXISTS idx_candidates_student_id ON candidates(student_id);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);

-- 打分明细表
CREATE TABLE IF NOT EXISTS interviewer_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || lower(substr(hex(randomblob(2)),2)) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))),
  candidate_id TEXT NOT NULL,
  interviewer_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  score REAL NOT NULL,
  judge_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(candidate_id, interviewer_name),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interviewer_scores_candidate_id ON interviewer_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviewer_scores_interviewer_name ON interviewer_scores(interviewer_name);
CREATE INDEX IF NOT EXISTS idx_interviewer_scores_group_name ON interviewer_scores(group_name);

-- 面试官名单（初始数据）
-- 面试官名单为硬编码配置，见 functions/api/candidates.ts 中的 INTERVIEWERS 数组
-- 如需修改请编辑对应代码文件

-- 管理员账号：guido（硬编码在代码中）
