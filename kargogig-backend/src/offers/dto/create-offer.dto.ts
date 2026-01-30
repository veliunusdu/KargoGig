export class CreateOfferDto {
    announcement_id: number;
    company_id: number;
    driver_id?: number;
    price: number;
    currency?: string;
    estimated_delivery?: string;
    notes?: string;
}
