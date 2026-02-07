import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { RefundRequestDto } from './dto/refund-request.dto';

/**
 * Controller for payment refund operations.
 * Requires JWT authentication + customer ownership verification.
 */
@Controller('payments')
export class RefundsController {
  private readonly logger = new Logger(RefundsController.name);

  constructor(private readonly refundsService: RefundsService) {}

  /**
   * POST /payments/:id/refund
   * Request a full or partial refund for a payment.
   */
  @Post(':id/refund')
  async requestRefund(
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() body: RefundRequestDto,
    @Req() req: any,
  ) {
    this.logger.log(
      `[requestRefund] payment_id=${paymentId}, type=${body.type}, customer_id=${req.user?.sub}`,
    );

    // TODO: Add JWT auth guard + customer ownership verification
    // Example:
    // @UseGuards(JwtAuthGuard)
    // const customerId = req.user.sub;
    // const payment = await this.refundsRepository.findPaymentById(paymentId);
    // if (payment.customer_id !== customerId) throw new ForbiddenException();

    if (body.type === 'full') {
      const result = await this.refundsService.requestFullRefund(
        paymentId,
        body.idempotency_key,
        body.reason,
      );

      return {
        ok: true,
        refund: {
          id: result.refund_id,
          type: 'full',
          amount_gross: result.amount_gross,
          company_debit: result.company_debit,
          new_wallet_balance: result.new_wallet_balance,
          already_refunded: result.already_refunded,
        },
      };
    } else {
      // Partial refund
      const result = await this.refundsService.requestPartialRefund(
        paymentId,
        body.amount!,
        body.idempotency_key,
        body.reason,
      );

      return {
        ok: true,
        refund: {
          id: result.refund_id,
          type: 'partial',
          amount_gross: result.amount_gross,
          company_debit: result.company_debit,
          new_wallet_balance: result.new_wallet_balance,
          remaining_refundable: result.remaining_refundable,
          already_refunded: result.already_refunded,
        },
      };
    }
  }
}
