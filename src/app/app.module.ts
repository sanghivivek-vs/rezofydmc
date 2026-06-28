import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnquiryModule } from '../modules/enquiry-intake/enquiry.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EnquiryModule],
})
export class AppModule {}
