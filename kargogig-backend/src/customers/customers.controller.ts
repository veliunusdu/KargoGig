import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * GET /customers/user/:userId
   * Kullanıcının müşteri kaydını getirir
   */
  @Get('user/:userId')
  async getCustomerByUserId(@Param('userId') userId: string) {
    return this.customersService.getCustomerByUserId(userId);
  }

  /**
   * GET /customers/:id
   * ID ile müşteri getirir
   */
  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    return this.customersService.getCustomerById(parseInt(id, 10));
  }

  /**
   * PATCH /customers/user/:userId
   * Müşteri bilgilerini günceller
   */
  @Patch('user/:userId')
  async updateCustomer(
    @Param('userId') userId: string,
    @Body()
    updateData: {
      billing_address?: string;
      tax_number?: string;
      default_company_id?: number;
    },
  ) {
    return this.customersService.updateCustomer(userId, updateData);
  }
}
