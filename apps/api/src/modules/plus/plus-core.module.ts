import { Module } from '@nestjs/common';
import { PlusBenefits } from './plus-benefits.service';

/** What the cart and checkout need from NIXZORA Plus: who is a member, and member prices. */
@Module({ providers: [PlusBenefits], exports: [PlusBenefits] })
export class PlusCoreModule {}
