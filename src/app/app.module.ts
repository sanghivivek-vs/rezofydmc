import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from '../modules/identity-org/identity.module';
import { EnquiryModule } from '../modules/enquiry-intake/enquiry.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), IdentityModule, EnquiryModule],
})
export class AppModule {}
