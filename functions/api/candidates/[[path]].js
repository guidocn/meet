// Cloudflare Pages Functions - 考生 API
// 对应路由: /api/candidates/*

import {
  handlePreRegister,
  handlePreRegisterPublic,
  handleSearchByNamePublic,
  handleCheckInPublic,
  handlePublicUpdateDepartments,
  handleGetDetailPublic,
  handleSearch,
  handleCheckIn,
  handleAssignGroup,
  handleReassignGroup,
  handleBatchImport,
  handleStats,
  handleExportCsv,
  handleGetBigScreen,
  handleGetGroupCounts,
  handleInterviewerLogin,
  handleGetGroupQueue,
  handleUpdateStatus,
  handleSubmitScore,
  handleApprove,
  handleDeleteCandidate,
  handleDeleteAll,
  // 二面相关
  handleSecondRoundLogin,
  handleGetSecondRoundQueue,
  handleMoveToSecondRound,
  handleAssignSecondGroup,
  handleSecondRoundStart,
  handleSecondRoundDecision,
  handleSecondRoundStats,
  handleGetBackupStatus,
  handleToggleBackup,
  handleGetDisplayMode,
  handleToggleDisplayMode,
} from '../../lib/candidates-handler';

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/candidates/, '');
  const method = request.method.toUpperCase();

  const db = env.DB;

  try {
    // 预报名（后台创建）
    if (method === 'POST' && path === '/pre-register') {
      return jsonResponse(await handlePreRegister(db, await request.json()));
    }

    // 公开预报名（前端表单）
    if (method === 'POST' && path === '/pre-register/public') {
      return jsonResponse(await handlePreRegisterPublic(db, await request.json()));
    }

    // 公开按姓名搜索
    if (method === 'POST' && path === '/public/search-by-name') {
      return jsonResponse(await handleSearchByNamePublic(db, await request.json()));
    }

    // 公开签到
    if (method === 'POST' && path === '/public/check-in') {
      return jsonResponse(await handleCheckInPublic(db, await request.json()));
    }

    // 公开修改意向部门
    if (method === 'POST' && path === '/public/update-departments') {
      return jsonResponse(await handlePublicUpdateDepartments(db, await request.json()));
    }

    // 公开详情
    if (method === 'GET' && path.startsWith('/public/detail/')) {
      const id = path.replace('/public/detail/', '');
      return jsonResponse(await handleGetDetailPublic(db, id));
    }

    // 大屏数据（实时返回，无缓存，确保0延迟）
    if (method === 'GET' && path === '/display/big-screen') {
      return jsonResponse(await handleGetBigScreen(db));
    }

    // 各组统计（实时返回，无缓存）
    if (method === 'GET' && path === '/group-counts') {
      return jsonResponse(await handleGetGroupCounts(db));
    }

    // 面试官登录
    if (method === 'POST' && path === '/interviewer-login') {
      return jsonResponse(await handleInterviewerLogin(db, await request.json()));
    }

    // 批量导入（管理员）
    if (method === 'POST' && path === '/batch-import') {
      const body = await request.json();
      return jsonResponse(await handleBatchImport(db, body));
    }

    // 结果统计
    if (method === 'GET' && path === '/stats') {
      const query = Object.fromEntries(url.searchParams);
      return jsonResponse(await handleStats(db, query));
    }

    // CSV 导出
    if (method === 'GET' && path === '/export') {
      const query = Object.fromEntries(url.searchParams);
      const csv = await handleExportCsv(db, query);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="candidates.csv"',
        },
      });
    }

    // 组别队列
    if (method === 'GET' && path.startsWith('/group/')) {
      const groupName = path.replace('/group/', '');
      const query = Object.fromEntries(url.searchParams);
      return jsonResponse(await handleGetGroupQueue(db, groupName, query.interviewerName));
    }

    // 更新状态
    if (method === 'PATCH' && path.endsWith('/status')) {
      const id = path.replace('/status', '').replace('/', '');
      const body = await request.json();
      return jsonResponse(await handleUpdateStatus(db, id, body));
    }

    // 打分
    if (method === 'POST' && path.endsWith('/score')) {
      const id = path.replace('/score', '').replace('/', '');
      const body = await request.json();
      return jsonResponse(await handleSubmitScore(db, id, body));
    }

    // 审批
    if (method === 'POST' && path.endsWith('/approve')) {
      const id = path.replace('/approve', '').replace('/', '');
      const body = await request.json();
      return jsonResponse(await handleApprove(db, id, body));
    }

    // 单个删除（不需要密码）- 必须在搜索列表之前，且排除已知的二级路径
    if (method === 'DELETE' && path.startsWith('/') && path.split('/').filter(Boolean).length === 1) {
      const id = path.replace(/^\//, '');
      return jsonResponse(await handleDeleteCandidate(db, id));
    }

    // 全部删除（需要密码 6019）
    if (method === 'POST' && path === '/delete-all') {
      const body = await request.json();
      return jsonResponse(await handleDeleteAll(db, body));
    }

    // 签到
    if (method === 'POST' && path === '/check-in') {
      return jsonResponse(await handleCheckIn(db, await request.json()));
    }

    // 分配组别
    if (method === 'POST' && path === '/assign-group') {
      return jsonResponse(await handleAssignGroup(db, await request.json()));
    }

    // 改派组别
    if (method === 'POST' && path === '/reassign-group') {
      return jsonResponse(await handleReassignGroup(db, await request.json()));
    }

    // ========== 二面相关路由 ==========
    // 二面面试官登录
    if (method === 'POST' && path === '/second/login') {
      return jsonResponse(await handleSecondRoundLogin(db, await request.json()));
    }

    // 获取二面队列
    if (method === 'GET' && path === '/second/queue') {
      return jsonResponse(await handleGetSecondRoundQueue(db));
    }

    // 一面通过进入二面（管理员操作）
    if (method === 'POST' && path === '/second/move-to') {
      return jsonResponse(await handleMoveToSecondRound(db, await request.json()));
    }

    // 二面分配组别（E/F组）
    if (method === 'POST' && path === '/second/assign-group') {
      return jsonResponse(await handleAssignSecondGroup(db, await request.json()));
    }

    // 二面叫号
    if (method === 'POST' && path === '/second/start') {
      return jsonResponse(await handleSecondRoundStart(db, await request.json()));
    }

    // 二面决策（打分+录取/淘汰）
    if (method === 'POST' && path === '/second/decision') {
      return jsonResponse(await handleSecondRoundDecision(db, await request.json()));
    }

    // 二面统计
    if (method === 'GET' && path === '/second/stats') {
      return jsonResponse(await handleSecondRoundStats(db));
    }

    // 备用二面官开关状态
    if (method === 'GET' && path === '/second/backup-status') {
      const operatorName = url.searchParams.get('operatorName') || '';
      return jsonResponse(await handleGetBackupStatus(db, operatorName));
    }

    // 切换备用二面官开关
    if (method === 'POST' && path === '/second/toggle-backup') {
      return jsonResponse(await handleToggleBackup(db, await request.json()));
    }

    // 获取候场大屏显示模式
    if (method === 'GET' && path === '/display/mode') {
      const operatorName = url.searchParams.get('operatorName') || '';
      return jsonResponse(await handleGetDisplayMode(db, operatorName));
    }

    // 切换候场大屏显示模式
    if (method === 'POST' && path === '/display/toggle-mode') {
      return jsonResponse(await handleToggleDisplayMode(db, await request.json()));
    }

    // 搜索列表（兜底放最后，避免匹配到更具体的路径）
    if (method === 'GET' && (path === '' || path === '/')) {
      const query = Object.fromEntries(url.searchParams);
      return jsonResponse(await handleSearch(db, query));
    }

    return errorResponse(404, '接口不存在');
  } catch (err) {
    const status = err.status || err.code ? (err.status || 400) : 500;
    const message = err.message || String(err);
    return errorResponse(status, message);
  }
}

function jsonResponse(data, cacheSeconds = 0) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };
  if (cacheSeconds > 0) {
    headers['Cache-Control'] = `public, max-age=${cacheSeconds}, stale-while-revalidate=30`;
  } else {
    headers['Cache-Control'] = 'no-cache';
  }
  return new Response(JSON.stringify(data), { headers });
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ message, statusCode: status, error: true }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
