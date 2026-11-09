/**
 * @param {unknown} value
 */
function n(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * @param {number} paise
 */
function inr(paise) {
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * @param {Record<string, unknown>} statement
 * @param {Record<string, unknown>} [auditResult]
 */
export function buildTaxAutopilotPackage(statement, auditResult = {}) {
  const orders = Array.isArray(statement?.orders) ? statement.orders : [];
  const items = Array.isArray(statement?.items) ? statement.items : [];
  const fromAudit = auditResult?.statutoryTaxSummary || {};

  let grossSalesPaise = 0;
  let totalPlatformFeesPaise = 0;
  let gstr2bInputTaxCredit18PctPaise = n(fromAudit.taxesOnFees18PctPaise);
  let form26asTds194OPaise = n(fromAudit.tds194OPaise);
  let gstr8TcsSec52Paise = n(fromAudit.tcsPaise);
  let section95PassThroughGstPaise = n(fromAudit.gstSection95Paise);

  for (const order of orders) {
    grossSalesPaise += n(order.itemSubtotalPaise);
    totalPlatformFeesPaise +=
      n(order.serviceFeePaise) +
      n(order.paymentMechanismFeePaise) +
      n(order.longDistanceFeePaise) +
      n(order.pocketHeroFeePaise);
    if (!auditResult?.statutoryTaxSummary) {
      gstr2bInputTaxCredit18PctPaise += n(order.taxesOnFees18PctPaise);
      form26asTds194OPaise += n(order.tds194OPaise);
      gstr8TcsSec52Paise += n(order.tcsPaise);
      section95PassThroughGstPaise += n(order.gstSection95Paise);
    }
  }

  for (const item of items) {
    if (item.transactionType === 'SALE') grossSalesPaise += n(item.grossSalePaise);
    totalPlatformFeesPaise +=
      n(item.marketplaceCommissionPaise) +
      n(item.fixedOrClosingFeePaise) +
      n(item.collectionFeePaise) +
      n(item.forwardShippingFeePaise) +
      n(item.reverseShippingFeePaise) +
      n(item.otherDeductionPaise);
    gstr2bInputTaxCredit18PctPaise += n(item.gstOnFees18PctPaise);
    form26asTds194OPaise += n(item.tds194OPaise);
    gstr8TcsSec52Paise += n(item.tcsSec52Paise);
  }

  const bankPaise =
    grossSalesPaise -
    totalPlatformFeesPaise -
    gstr2bInputTaxCredit18PctPaise -
    form26asTds194OPaise -
    gstr8TcsSec52Paise -
    section95PassThroughGstPaise;

  const rows = [
    ['Voucher Type', 'Ledger', 'Debit', 'Credit'],
    ['Journal', 'Bank', inr(bankPaise), '0.00'],
    ['Journal', 'Platform fees', inr(totalPlatformFeesPaise), '0.00'],
    ['Journal', 'GST input credit 18%', inr(gstr2bInputTaxCredit18PctPaise), '0.00'],
    ['Journal', 'TDS 194-O receivable', inr(form26asTds194OPaise), '0.00'],
    ['Journal', 'TCS section 52 receivable', inr(gstr8TcsSec52Paise), '0.00'],
    ['Journal', 'Section 9(5) GST pass-through', inr(section95PassThroughGstPaise), '0.00'],
    ['Journal', 'Sales', '0.00', inr(grossSalesPaise)],
  ];
  const tallyJournalCsv = rows.map((row) => row.join(',')).join('\n');
  const tallyVoucherXml = [
    '<ENVELOPE>',
    '<BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE>',
    `<VOUCHER VCHTYPE="Journal" ACTION="Create">`,
    `<NARRATION>GramSevaMitra payout ${statement?.platform || ''}</NARRATION>`,
    `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales</LEDGERNAME><AMOUNT>${inr(grossSalesPaise)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Platform fees</LEDGERNAME><AMOUNT>-${inr(totalPlatformFeesPaise)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    `<ALLLEDGERENTRIES.LIST><LEDGERNAME>GST input credit 18%</LEDGERNAME><AMOUNT>-${inr(gstr2bInputTaxCredit18PctPaise)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    `<ALLLEDGERENTRIES.LIST><LEDGERNAME>TDS 194-O receivable</LEDGERNAME><AMOUNT>-${inr(form26asTds194OPaise)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    '</VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY>',
    '</ENVELOPE>',
  ].join('');

  return {
    grossSalesPaise,
    totalPlatformFeesPaise,
    gstr2bInputTaxCredit18PctPaise,
    form26asTds194OPaise,
    gstr8TcsSec52Paise,
    section95PassThroughGstPaise,
    tallyJournalCsv,
    tallyVoucherXml,
  };
}
