import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SmsSenderRegistry } from "./entities/sms-sender-registry.entity";
import { SmsIntakeController } from "./sms-intake.controller";
import { SmsIntakeService } from "./sms-intake.service";
import { SmsSenderRegistryService } from "./sms-sender-registry.service";
import { ImportModule } from "../import.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsSenderRegistry]),
    forwardRef(() => ImportModule),
  ],
  controllers: [SmsIntakeController],
  providers: [SmsIntakeService, SmsSenderRegistryService],
  exports: [SmsIntakeService, SmsSenderRegistryService],
})
export class SmsIntakeModule {}
