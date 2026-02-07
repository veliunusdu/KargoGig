import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './dto/checkout.dto';
import { PaymentCallbackDto } from './dto/callback.dto';

/**
 * Payments controller - handles checkout and callback endpoints
 */
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments/checkout
   * Create payment checkout session for completed shipment
   */
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async createCheckout(@Body() dto: CreateCheckoutDto, @Req() req: any) {
    const authHeader = req.headers['authorization'] as string | undefined;
    this.logger.log(`[POST /payments/checkout] shipment_id=${dto.shipment_id}`);
    return this.paymentsService.createCheckout(authHeader, dto);
  }

  /**
   * POST /payments/callback/:provider
   * Process payment callback from provider (mock, shopier, etc.)
   */
  @Post('callback/:provider')
  @HttpCode(HttpStatus.OK)
  async processCallback(@Param('provider') provider: string, @Body() dto: PaymentCallbackDto) {
    this.logger.log(`[POST /payments/callback/${provider}]`);
    return this.paymentsService.processCallback(provider, dto);
  }
}

/**
 * Mock payment page controller (for testing without real payment gateway)
 */
@Controller('mock-pay')
export class MockPaymentController {
  private readonly logger = new Logger(MockPaymentController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * GET /mock-pay/:platformOrderId
   * Simple HTML page with "Pay" and "Fail" buttons for testing
   */
  @Get(':platformOrderId')
  async showMockPaymentPage(
    @Param('platformOrderId') platformOrderId: string,
    @Res() res: Response,
  ) {
    this.logger.log(`[GET /mock-pay/${platformOrderId}]`);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Payment - ${platformOrderId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 400px;
      width: 100%;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 8px;
      text-align: center;
    }
    .order-id {
      color: #666;
      font-size: 14px;
      text-align: center;
      margin-bottom: 32px;
      font-family: monospace;
      background: #f5f5f5;
      padding: 8px;
      border-radius: 6px;
    }
    .info {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 16px;
      margin-bottom: 32px;
      border-radius: 4px;
      font-size: 14px;
      color: #555;
    }
    .buttons {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    button {
      flex: 1;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    button:active {
      transform: translateY(0);
    }
    .btn-success {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-fail {
      background: #f0f0f0;
      color: #666;
    }
    .status {
      text-align: center;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .status.visible {
      display: block;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 Mock Payment</h1>
    <div class="order-id">${platformOrderId}</div>
    
    <div class="info">
      <strong>Test Mode:</strong> This is a mock payment page for development. 
      Click "Pay (Success)" to simulate successful payment or "Fail" to simulate failure.
    </div>

    <div class="buttons">
      <button class="btn-success" onclick="processPayment('success')">
        ✓ Pay (Success)
      </button>
      <button class="btn-fail" onclick="processPayment('failed')">
        ✗ Fail
      </button>
    </div>

    <div id="status" class="status"></div>

    <div class="footer">
      Mock Payment Gateway • Development Only
    </div>
  </div>

  <script>
    async function processPayment(status) {
      const statusDiv = document.getElementById('status');
      const buttons = document.querySelectorAll('button');
      
      // Disable buttons
      buttons.forEach(btn => btn.disabled = true);

      try {
        const response = await fetch('/api/v1/payments/callback/mock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            platform_order_id: '${platformOrderId}',
            status: status,
            provider_payment_id: 'MOCK-' + Date.now(),
          }),
        });

        const data = await response.json();

        if (response.ok) {
          statusDiv.className = 'status success visible';
          statusDiv.textContent = status === 'success' 
            ? '✓ Payment successful! You can close this page.'
            : '✗ Payment failed as requested.';
        } else {
          statusDiv.className = 'status error visible';
          statusDiv.textContent = '⚠ Error: ' + (data.message || 'Unknown error');
        }
      } catch (error) {
        statusDiv.className = 'status error visible';
        statusDiv.textContent = '⚠ Network error: ' + error.message;
      }

      // Re-enable buttons after 2 seconds
      setTimeout(() => {
        buttons.forEach(btn => btn.disabled = false);
      }, 2000);
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
