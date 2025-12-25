import { Module } from '@nestjs/common';
import { UserStatsService } from './user-stats.service';
import { UserStatsController } from './user-stats.controller';

@Module({
  providers: [UserStatsService],
  controllers: [UserStatsController],
  exports: [UserStatsService],
})
export class UserStatsModule {}
