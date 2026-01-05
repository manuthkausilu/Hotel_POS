import { BillData } from './billMapper';

/**
 * Generates HTML template optimized for 80mm thermal printer (302px width)
 * Uses monospace font for proper alignment
 */
export function generateThermalBillHTML(data: BillData): string {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Generate dashed line separator
  const line = '-'.repeat(48);
  const doubleLine = '='.repeat(48);

  // Build items rows
  const itemsHTML = data.items.map(item => {
    const itemLine1 = item.name;
    const qtyPrice = `${item.quantity} x ${formatCurrency(item.price)}`;
    const itemTotal = formatCurrency(item.total);
    
    return `
      <tr>
        <td colspan="3" style="padding: 4px 0; font-weight: 600;">${itemLine1}</td>
      </tr>
      <tr>
        <td style="padding: 0 0 8px 8px;">${qtyPrice}</td>
        <td></td>
        <td style="text-align: right; padding: 0 0 8px 0; font-weight: 600;">${itemTotal}</td>
      </tr>
    `;
  }).join('');

  // Calculate balance on-demand
  const balance = data.total - data.paidAmount;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=302px, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @page {
          size: 80mm auto;
          margin: 0;
        }
        
        body {
          width: 302px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          padding: 8px;
        }
        
        .center {
          text-align: center;
        }
        
        .bold {
          font-weight: 700;
        }
        
        .header {
          text-align: center;
          margin-bottom: 12px;
        }
        
        .hotel-name {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .hotel-info {
          font-size: 10px;
          line-height: 1.4;
        }
        
        .separator {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        
        .double-separator {
          border-top: 2px solid #000;
          margin: 8px 0;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: 11px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        
        td {
          font-size: 11px;
          vertical-align: top;
        }
        
        .totals-table td {
          padding: 3px 0;
        }
        
        .totals-table .label {
          text-align: left;
          padding-right: 8px;
        }
        
        .totals-table .amount {
          text-align: right;
          font-weight: 600;
        }
        
        .grand-total {
          font-size: 13px;
          font-weight: 700;
          padding-top: 6px !important;
        }
        
        .footer {
          text-align: center;
          margin-top: 16px;
          font-size: 11px;
        }
        
        .thank-you {
          font-size: 12px;
          font-weight: 700;
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="hotel-name">${data.hotelName}</div>
        <div class="hotel-info">
          ${data.hotelAddress ? `${data.hotelAddress}<br>` : ''}
          ${data.hotelCity || data.hotelCountry ? `${[data.hotelCity, data.hotelCountry].filter(Boolean).join(', ')}<br>` : ''}
          ${data.hotelPhone ? `Tel: ${data.hotelPhone}<br>` : ''}
          ${data.hotelEmail ? `${data.hotelEmail}` : ''}
        </div>
      </div>
      
      <div class="double-separator"></div>
      
      <!-- Order Info -->
      <div class="info-row">
        <span>Bill No:</span>
        <span class="bold">#${data.orderId}</span>
      </div>
      <div class="info-row">
        <span>Date:</span>
        <span>${formatDate(data.orderDate)}</span>
      </div>
      <div class="info-row">
        <span>Type:</span>
        <span>${data.orderType}</span>
      </div>
      <div class="info-row">
        <span>Customer:</span>
        <span>${data.customerName}</span>
      </div>
      ${data.roomNumber ? `
      <div class="info-row">
        <span>Room:</span>
        <span>${data.roomNumber}</span>
      </div>
      ` : ''}
      ${data.tableNumber ? `
      <div class="info-row">
        <span>Table:</span>
        <span>${data.tableNumber}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span>Cashier:</span>
        <span>${data.cashier}</span>
      </div>
      
      <div class="double-separator"></div>
      
      <!-- Items -->
      <table>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <div class="separator"></div>
      
      <!-- Totals -->
      <table class="totals-table">
        <tbody>
          <tr>
            <td class="label">Subtotal:</td>
            <td class="amount">${formatCurrency(data.subtotal)}</td>
          </tr>
          ${data.serviceCharge > 0 ? `
          <tr>
            <td class="label">Service Charge${data.serviceChargeRate ? ` (${data.serviceChargeRate.toFixed(1)}%)` : ''}:</td>
            <td class="amount">${formatCurrency(data.serviceCharge)}</td>
          </tr>
          ` : ''}
          <tr>
            <td class="label grand-total">TOTAL:</td>
            <td class="amount grand-total">${formatCurrency(data.total)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="double-separator"></div>
      
      <!-- Payment -->
      <table class="totals-table">
        <tbody>
          <tr>
            <td class="label">Payment Method:</td>
            <td class="amount">${data.paymentMethod}</td>
          </tr>
          <tr>
            <td class="label">Paid:</td>
            <td class="amount">${formatCurrency(data.paidAmount)}</td>
          </tr>
          ${data.paymentMethod === 'Cash' && data.givenAmount > 0 ? `
          <tr>
            <td class="label">Given Amount:</td>
            <td class="amount">${formatCurrency(data.givenAmount)}</td>
          </tr>
          ` : ''}
          ${data.paymentMethod === 'Cash' && data.changeAmount > 0 ? `
          <tr>
            <td class="label">Change:</td>
            <td class="amount" style="color: #059669;">${formatCurrency(data.changeAmount)}</td>
          </tr>
          ` : ''}
          ${balance !== 0 ? `
          <tr>
            <td class="label">${balance > 0 ? 'Balance Due:' : 'Change:'}</td>
            <td class="amount" style="color: ${balance > 0 ? '#d32f2f' : '#059669'};">${formatCurrency(Math.abs(balance))}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>
      
      <div class="separator"></div>
      
      <!-- Footer -->
      <div class="footer">
        <div class="thank-you">Thank You!</div>
        <div>Visit Again</div>
      </div>
    </body>
    </html>
  `;
}
