import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CandidatesService } from './candidates.service';
 import type {
   AssignGroupRequest,
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
    PublicCheckInRequest,
    PublicSearchByNameRequest,
    PublicUpdateDepartmentsRequest,
    ReassignGroupRequest,
   SubmitScoreRequest,
 } from '@shared/api.interface';
import { ADMIN_NAME, getInterviewerRole } from './candidates.service';

@Controller('api/candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post('pre-register')
  async preRegister(@Body() body: PreRegisterCreateRequest): Promise<Candidate> {
    return this.candidatesService.preRegister(body);
  }

  @Post('pre-register/public')
  async preRegisterPublic(@Body() body: PreRegisterPublicRequest): Promise<Candidate> {
    return this.candidatesService.preRegisterPublic(body);
  }

  @Post('public/search-by-name')
  async searchByNamePublic(@Body() body: PublicSearchByNameRequest): Promise<Candidate[]> {
    return this.candidatesService.searchByNamePublic(body);
  }

  @Post('public/check-in')
  async checkInPublic(@Body() body: PublicCheckInRequest): Promise<Candidate> {
    return this.candidatesService.checkInPublic(body);
  }

  @Post('public/update-departments')
  async publicUpdateDepartments(
    @Body() body: PublicUpdateDepartmentsRequest,
  ): Promise<Candidate> {
    return this.candidatesService.publicUpdateDepartments(
      body.candidateId,
      body.firstDepartment,
      body.secondDepartment,
    );
  }

  @Get('public/detail/:id')
  async getDetailPublic(@Param('id') id: string): Promise<Candidate> {
    return this.candidatesService.getById(id);
  }

  @Get()
  async search(
    @Query('keyword') keyword?: string,
    @Query('groupName') groupName?: string,
    @Query('status') status?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('page') page?: string,
     @Query('pageSize') pageSize?: string,
     @Query('sortBy') sortBy?: string,
     @Query('sortOrder') sortOrder?: string,
   ): Promise<CandidateListResponse> {
     return this.candidatesService.search({
       keyword,
       groupName,
       status,
       minScore: minScore ? Number(minScore) : undefined,
       maxScore: maxScore ? Number(maxScore) : undefined,
       page: page ? parseInt(page, 10) : undefined,
       pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
       sortBy: sortBy as 'globalNumber' | 'score' | 'createdAt' | undefined,
       sortOrder: sortOrder as 'asc' | 'desc' | undefined,
     });
  }

  @Post('check-in')
  async checkIn(@Body() body: CheckInRequest & { operatorName?: string }): Promise<Candidate> {
    const role = body.operatorName ? getInterviewerRole(body.operatorName) : 'interviewer';
    if (role === 'interviewer') {
      throw new ForbiddenException('无权限操作，仅管理员和流动人员可执行');
    }
    return this.candidatesService.checkIn(body);
  }

  @Post('assign-group')
  async assignGroup(@Body() body: AssignGroupRequest & { operatorName?: string }): Promise<Candidate> {
    const role = body.operatorName ? getInterviewerRole(body.operatorName) : 'interviewer';
    if (role === 'interviewer') {
      throw new ForbiddenException('无权限操作，仅管理员和流动人员可执行');
    }
    return this.candidatesService.assignGroup(body);
  }

  @Post('reassign-group')
  async reassignGroup(@Body() body: ReassignGroupRequest & { operatorName?: string }): Promise<Candidate> {
    const role = body.operatorName ? getInterviewerRole(body.operatorName) : 'interviewer';
    if (role === 'interviewer') {
      throw new ForbiddenException('无权限操作，仅管理员和流动人员可执行');
    }
    return this.candidatesService.reassignGroup(body);
  }

  @Post('batch-import')
  async batchImport(@Body() body: { items: PreRegisterCreateRequest[]; operatorName?: string }): Promise<BatchImportResponse> {
    if (body.operatorName !== ADMIN_NAME) {
      throw new ForbiddenException('无权限操作，仅管理员可执行');
    }
    return this.candidatesService.batchImport(body.items);
  }

  @Get('stats')
  async getStats(
    @Query('groupName') groupName?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('keyword') keyword?: string,
    @Query('operatorName') operatorName?: string,
  ): Promise<import('@shared/api.interface').ResultsStats> {
    const role = operatorName ? getInterviewerRole(operatorName) : 'interviewer';
    if (role !== 'admin') {
      throw new ForbiddenException('无权限操作，仅管理员可查看结果统计');
    }
    return this.candidatesService.getStats({
      groupName,
      minScore: minScore ? Number(minScore) : undefined,
      maxScore: maxScore ? Number(maxScore) : undefined,
      keyword,
    });
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Res() res: Response,
    @Query('groupName') groupName?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('keyword') keyword?: string,
  ): Promise<void> {
    const csv = await this.candidatesService.exportCsv({
      groupName,
      minScore: minScore ? Number(minScore) : undefined,
      maxScore: maxScore ? Number(maxScore) : undefined,
      keyword,
    });
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="candidates.csv"',
    );
    res.send(csv);
  }

   @Get('display/big-screen')
   async getBigScreen(): Promise<BigScreenData> {
     return this.candidatesService.getBigScreenData();
   }

   @Get('group-counts')
   async getGroupCounts(): Promise<GroupCountInfo[]> {
     return this.candidatesService.getGroupCounts();
   }


  @Post('interviewer-login')
  async interviewerLogin(
    @Body() body: InterviewerLoginRequest,
  ): Promise<InterviewerLoginResponse> {
    if (!body.name?.trim()) {
      throw new BadRequestException('请输入面试官姓名');
    }
    return this.candidatesService.verifyInterviewer(body.name);
  }

  @Get('group/:groupName')
  async getGroupQueue(
    @Param('groupName') groupName: string,
    @Query('interviewerName') interviewerName?: string,
  ): Promise<Candidate[]> {
    return this.candidatesService.getGroupQueue(groupName, interviewerName);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('interviewerName') interviewerName?: string,
  ): Promise<Candidate> {
    const role = interviewerName ? getInterviewerRole(interviewerName) : 'interviewer';
    if (role === 'floating') {
      throw new ForbiddenException('无权限操作，流动人员仅可查看，不可修改面试状态');
    }
    return this.candidatesService.updateStatus(
      id,
      status,
      interviewerName?.trim(),
    );
  }

  @Post(':id/score')
  async submitScore(
    @Param('id') id: string,
    @Body() body: SubmitScoreRequest & { interviewerName: string },
  ): Promise<Candidate> {
    if (!body.interviewerName?.trim()) {
      throw new BadRequestException('缺少面试官姓名');
    }
    const role = getInterviewerRole(body.interviewerName);
    if (role === 'floating') {
      throw new ForbiddenException('无权限操作，流动人员不可打分');
    }
    return this.candidatesService.submitScore(
      id,
      body.interviewerName.trim(),
      body,
    );
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body('operatorName') operatorName: string,
  ): Promise<Candidate> {
    if (!operatorName?.trim()) {
      throw new BadRequestException('缺少操作人姓名');
    }
    const role = getInterviewerRole(operatorName);
    if (role === 'interviewer') {
      throw new ForbiddenException('无权限操作，仅管理员和流动人员可审批');
    }
    return this.candidatesService.approveCandidate(id, operatorName.trim());
  }
}
