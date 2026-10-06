import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.vehiclesService.findAll(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req: any) { return this.vehiclesService.mine(req.user.id); }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Get(':id/quote')
  quote(@Param('id') id: string, @Query() query: any) { return this.vehiclesService.quote(id, query); }

  @Get(':id/schedule')
  @UseGuards(JwtAuthGuard)
  schedule(@Request() req: any, @Param('id') id: string) { return this.vehiclesService.schedule(req.user.id, id); }

  @Get(':id/host-agreement')
  @UseGuards(JwtAuthGuard)
  hostAgreement(@Request() req: any, @Param('id') id: string) { return this.vehiclesService.hostAgreement(req.user, id); }

  @Post(':id/host-agreement/acknowledge')
  @UseGuards(JwtAuthGuard)
  acknowledgeHostAgreement(@Request() req: any, @Param('id') id: string) { return this.vehiclesService.acknowledgeHostAgreement(req.user, id); }

  @Post(':id/availability-blocks')
  @UseGuards(JwtAuthGuard)
  block(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.vehiclesService.block(req.user.id, id, body); }

  @Post(':id/availability-blocks/:blockId/release')
  @UseGuards(JwtAuthGuard)
  releaseBlock(@Request() req: any, @Param('id') id: string, @Param('blockId') blockId: string) { return this.vehiclesService.releaseBlock(req.user.id, id, blockId); }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() body: any) {
    return this.vehiclesService.create(req.user.id, body);
  }
}
