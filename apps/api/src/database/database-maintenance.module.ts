import { Module } from '@nestjs/common';
import { PartitionMaintenance } from './partition-maintenance';

/** Housekeeping on the database itself (ADR-0022). */
@Module({ providers: [PartitionMaintenance], exports: [PartitionMaintenance] })
export class DatabaseMaintenanceModule {}
