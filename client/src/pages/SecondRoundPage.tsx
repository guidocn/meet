import { useState, useEffect, useCallback } from 'react';

const SESSION_KEY = 'second_round_session';
const REFRESH_INTERVAL = 15000; // 15秒刷新一次，减少D1读取

interface Score {
  id: string;
  score: number;
  judgeComment: string | null;
  interviewerName: string;
}

interface Candidate {
  id: string;
  name: string;
  gender: string | null;
  className: string | null;
  phone: string | null;
  firstDepartment: string | null;
  secondDepartment: string | null;
  globalNumber: number | null;
  groupName: string | null;
  groupNumber: number | null;
  status: string;
  averageScore: number | null;
  scoredCount: number;
  scores: Score[];
  secondScore: number | null;
  secondComment: string | null;
  finalDepartment: string | null;
}

const DEPARTMENTS = ['技术部', '宣传部', '外联部'];

export default function SecondRoundPage() {
  const [session, setSession] = useState<{ name: string; role: string; isAdmin: boolean } | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [queue, setQueue] = useState<{ waiting: Candidate[]; interviewing: Candidate[] }>({ waiting: [], interviewing: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 决策表单状态
  const [decisionScore, setDecisionScore] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionResult, setDecisionResult] = useState<'admitted' | 'rejected'>('admitted');
  const [selectedDept, setSelectedDept] = useState('技术部');
  const [submitting, setSubmitting] = useState(false);

  // 登录
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!nameInput.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/candidates/second/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '登录失败');
      setSession(data);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setNameInput('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // 获取队列
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/candidates/second/queue');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '加载失败');
      setQueue(data);
    } catch (err: any) {
      console.error('加载二面队列失败', err);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void fetchQueue();
    
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => void fetchQueue(), REFRESH_INTERVAL);
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    };
    
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, fetchQueue]);

  // 叫号
  const handleStart = async (candidateId: string) => {
    if (!session) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/candidates/second/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, interviewerName: session.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '叫号失败');
      setSuccess('叫号成功');
      setTimeout(() => setSuccess(''), 2000);
      void fetchQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 提交决策
  const handleSubmitDecision = async () => {
    if (!session || queue.interviewing.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/candidates/second/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: queue.interviewing[0].id,
          score: decisionScore ? Number(decisionScore) : null,
          comment: decisionComment,
          decision: decisionResult,
          finalDepartment: decisionResult === 'admitted' ? selectedDept : null,
          interviewerName: session.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '提交失败');
      setSuccess('提交成功');
      setDecisionScore('');
      setDecisionComment('');
      setTimeout(() => setSuccess(''), 2000);
      void fetchQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 登录页
  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="bg-zinc-800 rounded-xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-white text-center mb-6">二面面试官工作台</h1>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="请输入你的姓名"
            className="w-full px-4 py-3 bg-zinc-700 text-white rounded-lg mb-4 outline-none focus:ring-2 ring-cyan-500"
          />
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
          >
            登录
          </button>
          {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  const currentCandidate = queue.interviewing[0];

  return (
    <div className="min-h-screen bg-zinc-900 p-4">
      {/* 顶部栏 */}
      <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">二面面试官工作台</h1>
          <p className="text-zinc-400 text-sm">欢迎，{session.name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm"
        >
          退出登录
        </button>
      </div>

      {error && (
        <div className="max-w-6xl mx-auto mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="max-w-6xl mx-auto mb-4 p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-300 text-sm">
          {success}
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左列：面试中 */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">当前面试中</h2>
          {currentCandidate ? (
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-white">{currentCandidate.name}</p>
                  <p className="text-zinc-400 text-sm">
                    全场序号 #{currentCandidate.globalNumber} · {currentCandidate.groupName}组
                  </p>
                </div>
                <span className="px-3 py-1 bg-yellow-600/30 text-yellow-400 rounded-full text-sm">
                  二面进行中
                </span>
              </div>

              {/* 一面信息 */}
              <div className="bg-zinc-700/50 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-400 mb-2">一面评分</p>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-2xl font-bold text-cyan-400">
                    {currentCandidate.averageScore ?? '—'}
                  </span>
                  <span className="text-zinc-500 text-sm">
                    （{currentCandidate.scoredCount}位面试官打分）
                  </span>
                </div>
                <div className="space-y-2 mt-3">
                  {currentCandidate.scores.map((score) => (
                    <div key={score.id} className="text-sm">
                      <span className="text-zinc-300">{score.interviewerName}：</span>
                      <span className="text-cyan-400 font-medium">{score.score}分</span>
                      {score.judgeComment && (
                        <span className="text-zinc-400 ml-2">备注：{score.judgeComment}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-600">
                  <p className="text-sm text-zinc-400">
                    意向部门：{currentCandidate.firstDepartment}
                    {currentCandidate.secondDepartment ? ` / ${currentCandidate.secondDepartment}` : ''}
                  </p>
                </div>
              </div>

              {/* 决策表单 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">二面评分（0-10分）</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={decisionScore}
                    onChange={(e) => setDecisionScore(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-700 text-white rounded-lg outline-none focus:ring-2 ring-cyan-500"
                    placeholder="请输入分数"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">二面备注</label>
                  <textarea
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-zinc-700 text-white rounded-lg outline-none focus:ring-2 ring-cyan-500"
                    placeholder="请输入备注（可选）"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">面试结果</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDecisionResult('admitted')}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        decisionResult === 'admitted'
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                      }`}
                    >
                      ✅ 录取
                    </button>
                    <button
                      onClick={() => setDecisionResult('rejected')}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        decisionResult === 'rejected'
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                      }`}
                    >
                      ❌ 淘汰
                    </button>
                  </div>
                </div>

                {decisionResult === 'admitted' && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">分配部门</label>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-700 text-white rounded-lg outline-none focus:ring-2 ring-cyan-500"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={handleSubmitDecision}
                  disabled={submitting}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
                >
                  {submitting ? '提交中...' : '提交决策'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              当前没有正在面试的考生
            </div>
          )}
        </div>

        {/* 右列：待二面队列 */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            待二面队列（{queue.waiting.length}人）
          </h2>
          <div className="space-y-3">
            {queue.waiting.length === 0 ? (
              <div className="bg-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                暂无等待二面的考生
              </div>
            ) : (
              queue.waiting.map((candidate) => (
                <div key={candidate.id} className="bg-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium text-white">{candidate.name}</span>
                        <span className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-400">
                          #{candidate.globalNumber}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        一面平均分：
                        <span className="text-cyan-400 font-medium ml-1">
                          {candidate.averageScore ?? '—'}分
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        意向：{candidate.firstDepartment}
                        {candidate.secondDepartment ? ` / ${candidate.secondDepartment}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStart(candidate.id)}
                      disabled={loading || queue.interviewing.length > 0}
                      className="ml-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-600 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                    >
                      叫号
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
