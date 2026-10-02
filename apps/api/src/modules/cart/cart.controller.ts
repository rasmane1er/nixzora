import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type ApplyCoupon,
  ApplyCouponSchema,
  type Cart,
  CartIdSchema,
  type CartItemAdd,
  CartItemAddSchema,
  type CartItemUpdate,
  CartItemUpdateSchema,
  type CartMerge,
  CartMergeSchema,
  US_STATES,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, MaybeUser, OptionalAuth } from '../identity/guards/decorators';
import { type CartOwner, CartService } from './cart.service';

const GuestHeader = CartIdSchema.optional();
const RegionQuery = z.object({ region: z.enum(US_STATES).optional() });

/**
 * Guests identify their cart with the X-Cart-Id header (the storefront keeps it in an
 * HttpOnly cookie). Signed-in customers send their access token and have one cart per account.
 */
@ApiTags('cart')
@ApiHeader({
  name: 'X-Cart-Id',
  required: false,
  description: 'Guest cart id from a previous response',
})
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly carts: CartService) {}

  private owner(
    user: AuthUser | undefined,
    guestId: string | undefined,
    create = false,
  ): CartOwner | null {
    if (user) return { userId: user.id };
    const parsed = GuestHeader.safeParse(guestId || undefined);
    if (!parsed.success) throw new BadRequestException('That cart id is not valid.');
    if (parsed.data) return { guestId: parsed.data };
    return create ? { guestId: CartService.newGuestId() } : null;
  }

  @Get()
  @OptionalAuth()
  @ApiQuery({ name: 'region', required: false, description: 'US state, to estimate tax' })
  async get(
    @MaybeUser() user: AuthUser | undefined,
    @Headers('x-cart-id') cartId: string | undefined,
    @Query(new ZodValidationPipe(RegionQuery)) query: z.infer<typeof RegionQuery>,
  ): Promise<Cart> {
    const owner = this.owner(user, cartId);
    if (!owner) return this.carts.empty();
    return this.carts.view(owner, query.region);
  }

  @Post('items')
  @OptionalAuth()
  @ApiZodBody(CartItemAddSchema)
  add(
    @MaybeUser() user: AuthUser | undefined,
    @Headers('x-cart-id') cartId: string | undefined,
    @Body(new ZodValidationPipe(CartItemAddSchema)) body: CartItemAdd,
  ): Promise<Cart> {
    return this.carts.add(this.owner(user, cartId, true)!, body.variantId, body.quantity);
  }

  @Patch('items/:variantId')
  @OptionalAuth()
  @ApiZodBody(CartItemUpdateSchema)
  update(
    @MaybeUser() user: AuthUser | undefined,
    @Headers('x-cart-id') cartId: string | undefined,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body(new ZodValidationPipe(CartItemUpdateSchema)) body: CartItemUpdate,
  ): Promise<Cart> {
    return this.carts.setQuantity(this.owner(user, cartId, true)!, variantId, body.quantity);
  }

  @Delete('items/:variantId')
  @OptionalAuth()
  remove(
    @MaybeUser() user: AuthUser | undefined,
    @Headers('x-cart-id') cartId: string | undefined,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ): Promise<Cart> {
    return this.carts.setQuantity(this.owner(user, cartId, true)!, variantId, 0);
  }

  @Post('coupon')
  @OptionalAuth()
  @ApiZodBody(ApplyCouponSchema)
  applyCoupon(
    @MaybeUser() user: AuthUser | undefined,
    @Headers('x-cart-id') cartId: string | undefined,
    @Body(new ZodValidationPipe(ApplyCouponSchema)) body: ApplyCoupon,
  ): Promise<Cart> {
    return this.carts.applyCoupon(this.owner(user, cartId, true)!, body.code);
  }

  @Delete('coupon')
  @OptionalAuth()
  removeCoupon(
    @MaybeUser() user: AuthUser | undefined,
    @Headers('x-cart-id') cartId: string | undefined,
  ): Promise<Cart> {
    return this.carts.removeCoupon(this.owner(user, cartId, true)!);
  }

  /** Call right after sign-in so nothing a guest added is lost. */
  @Post('merge')
  @ApiBearerAuth()
  @ApiZodBody(CartMergeSchema)
  merge(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CartMergeSchema)) body: CartMerge,
  ): Promise<Cart> {
    return this.carts.merge(user.id, body.guestCartId);
  }
}
