/** Signed integer minor units. ₹1.00 is 100. Never store a rupee float here. */

export type PlatformType = 'SWIGGY' | 'ZOMATO' | 'MEESHO' | 'FLIPKART' | 'AMAZON' | 'SHOPIFY_COD';

export type VerticalType = 'RESTAURANT' | 'ECOMMERCE';

export type DeductionBucket =
  | 'STATUTORY_TAX'
  | 'CONTRACT_FEE'
  | 'CONTESTIBLE_CUT'
  | 'HELD_ORDER'
  | 'LOGISTICS_OVERCHARGE'
  | 'UNPAID_ORDER';

export type EcommerceTransactionType = 'SALE' | 'RETURN' | 'RTO' | 'CLAIM';

export type EcommerceOrderStatus = 'DELIVERED' | 'RTO' | 'CUSTOMER_RETURN' | 'CANCELLED';

export type OcrConfidenceStatus = 'DIGITAL' | 'BROWSER_95' | 'NEEDS_CLOUD' | 'VERIFIED';

export interface ContractRateCard {
  commissionBps?: number | null;
  paymentMechanismFeeBps: number;
  longDistanceOptedIn: boolean;
  pocketHeroOptedIn: boolean;
  approvedWeeklyAdCapPaise: number;
  approvedDiscountShareBps: number;
  skuWeightMapGrams: Record<string, number>;
  categoryCommissionBps?: number | null;
}

export interface CanonicalRestaurantOrderRow {
  orderId: string;
  itemSubtotalPaise: number;
  packagingPaise: number;
  restaurantDiscountPaise: number;
  platformDiscountPaise: number;
  customerGst5Paise: number;
  commissionPaise: number;
  gstOnFeesPaise: number;
  tds194OPaise: number;
  tcsPaise: number;
  otherDeductionPaise: number;
  declaredNetPaise: number;
  sourceTabName: string;
  sourceRowNumber: number;
  rawRowJson: string;
}

export interface CanonicalOutletAdjustment {
  adjustmentType: string;
  totalChargePaise: number;
  settledThisCyclePaise: number;
  outstandingCarryForwardPaise: number;
  sourceTabName: string;
  sourceRowNumber: number;
}

export interface CanonicalHeldOrder {
  orderId: string;
  amountPaise: number;
  reason: string;
  sourceTabName: string;
  sourceRowNumber: number;
}

export interface CanonicalEcommerceOrderItemRow {
  orderId: string;
  orderItemId: string;
  sku: string;
  transactionType: EcommerceTransactionType;
  orderStatus: EcommerceOrderStatus;
  declaredWeightGrams?: number | null;
  billedWeightGrams?: number | null;
  shippingZone?: string | null;
  grossSalePaise: number;
  marketplaceCommissionPaise: number;
  fixedOrClosingFeePaise: number;
  collectionFeePaise: number;
  forwardShippingFeePaise: number;
  reverseShippingFeePaise: number;
  gstOnFees18PctPaise: number;
  tcsSec52Paise: number;
  tds194OPaise: number;
  spfOrReimbursementPaise: number;
  otherDeductionPaise: number;
  declaredSettledPaise: number;
  neftOrUtrId?: string | null;
  sourceTabName: string;
  sourceRowNumber: number;
  ocrConfidenceStatus: OcrConfidenceStatus;
}

export interface SingleCellVerificationPrompt {
  uploadId: string;
  rowNumber: number;
  columnName: string;
  expectedPaise: number;
  extractedPaise: number;
  assignedToRole: 'MUNSHI' | 'ADMIN';
}

export interface CanonicalSettlementStatement {
  platform: PlatformType;
  vertical: VerticalType;
  currencyCode: string;
  minorUnitScale: number;
  declaredNetPayoutPaise: number;
  restaurantOrders: CanonicalRestaurantOrderRow[];
  ecommerceItems: CanonicalEcommerceOrderItemRow[];
  adjustments: CanonicalOutletAdjustment[];
  heldOrders: CanonicalHeldOrder[];
}
