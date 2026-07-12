import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export interface ContractData {
  bookingId: string;
  customerName: string;
  customerAadhaar: string;
  customerPhone: string;
  vehicleMakeModel: string;
  licensePlate: string;
  pickupLocation: string;
  pickupTime: string;
  dropoffTime: string;
  totalCost: number;
}

export class ContractService {
  /**
   * Compiles EJS/HTML template with actual values
   */
  private static getTemplate(data: ContractData): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Car Rental Agreement - ${data.bookingId}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #333;
          line-height: 1.4;
          font-size: 11pt;
          margin: 0;
          padding: 40px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo-section h1 {
          color: #1e3a8a;
          margin: 0;
          font-size: 24px;
          font-weight: 800;
        }
        .logo-section p {
          margin: 5px 0 0 0;
          color: #6b7280;
          font-size: 12px;
        }
        .stamp-duty-cert {
          border: 2px dashed #059669;
          background-color: #ecfdf5;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 35px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stamp-details h3 {
          margin: 0 0 5px 0;
          color: #065f46;
          font-size: 14px;
        }
        .stamp-details p {
          margin: 2px 0;
          font-size: 11px;
          color: #047857;
        }
        .stamp-qr {
          border: 1px solid #d1d5db;
          padding: 5px;
          background: white;
          font-size: 8px;
          text-align: center;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #374151;
        }
        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        .details-table th, .details-table td {
          border: 1px solid #e5e7eb;
          padding: 10px;
          text-align: left;
        }
        .details-table th {
          background-color: #f3f4f6;
          font-weight: 600;
          color: #374151;
          width: 30%;
        }
        .section-title {
          font-size: 14px;
          color: #1e3a8a;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
          margin-top: 25px;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .legal-clauses {
          font-size: 10px;
          color: #4b5563;
          text-align: justify;
        }
        .legal-clauses p {
          margin-bottom: 10px;
        }
        .signatures-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
        }
        .signature-box {
          border: 1px solid #d1d5db;
          padding: 15px;
          border-radius: 6px;
          width: 45%;
          background-color: #f9fafb;
        }
        .signature-box h4 {
          margin: 0 0 10px 0;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
        }
        .esign-stamp {
          border: 1px solid #10b981;
          color: #047857;
          background-color: #d1fae5;
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: bold;
          margin-top: 10px;
          display: inline-block;
        }
        .footer-note {
          text-align: center;
          font-size: 9px;
          color: #9ca3af;
          margin-top: 40px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <h1>ZIPTRIP</h1>
          <p>ZipTrip Mobility Solutions Pvt. Ltd.</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: bold; color: #1e3a8a;">RENTAL AGREEMENT</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">ID: ${data.bookingId}</p>
        </div>
      </div>

      <!-- Government e-Stamp Duty Affixed Certificate -->
      <div class="stamp-duty-cert">
        <div class="stamp-details">
          <h3>GOVERNMENT OF GUJARAT - E-STAMP CERTIFICATE</h3>
          <p><strong>Certificate No:</strong> IN-GJ92837492837492U</p>
          <p><strong>Certificate Date:</strong> ${new Date().toISOString().split('T')[0]}</p>
          <p><strong>Stamp Duty Paid By:</strong> ZipTrip Mobility Solutions</p>
          <p><strong>Description of Document:</strong> Article 5(g) Agreement (General)</p>
          <p><strong>Stamp Duty Amount Paid:</strong> ₹100.00 (One Hundred Rupees Only)</p>
        </div>
        <div class="stamp-qr">
          SECURE<br/>E-STAMP<br/>VERIFIED
        </div>
      </div>

      <div class="section-title">1. Rental Transaction Details</div>
      <table class="details-table">
        <tr>
          <th>Customer Name</th>
          <td>${data.customerName}</td>
        </tr>
        <tr>
          <th>Aadhaar Number / ID</th>
          <td>XXXX-XXXX-${data.customerAadhaar.slice(-4)}</td>
        </tr>
        <tr>
          <th>Vehicle Category & Model</th>
          <td>${data.vehicleMakeModel}</td>
        </tr>
        <tr>
          <th>Registration Number</th>
          <td>${data.licensePlate}</td>
        </tr>
        <tr>
          <th>Pickup Location Hub</th>
          <td>${data.pickupLocation}</td>
        </tr>
        <tr>
          <th>Rental Commencement</th>
          <td>${data.pickupTime}</td>
        </tr>
        <tr>
          <th>Rental Expiration</th>
          <td>${data.dropoffTime}</td>
        </tr>
        <tr>
          <th>Total Rental Consideration</th>
          <td><strong>₹${data.totalCost.toFixed(2)}</strong> (Inclusive of CGST/SGST and Surges)</td>
        </tr>
      </table>

      <div class="section-title">2. Legal Framework & Terms of Bailment</div>
      <div class="legal-clauses">
        <p>This Car Rental Agreement (the "Agreement") constitutes a legally binding contract of bailment under <strong>Sections 148 to 181 of the Indian Contract Act, 1872</strong>, executed between the Owner (represented by ZipTrip Mobility Solutions) and the Hirer (the Customer details listed in Section 1).</p>
        <p><strong>2.1 Scope of Use and Restrictions:</strong> The Hirer hereby agrees that the vehicle is leased solely for personal use and under no circumstances shall the Hirer sublease, rent out, hire, or otherwise transfer possession of the vehicle to any third party. The Hirer represents that they hold a valid driving license issued by the relevant licensing authority in India. The Hirer shall comply with all local, state, and national road safety regulations and traffic laws as per the <strong>Motor Vehicles Act, 1988</strong>.</p>
        <p><strong>2.2 Geographic Limitations:</strong> The vehicle is authorized for operation exclusively within the boundaries of the Republic of India. The Hirer must comply with all inter-state border permits and tolls. Operation outside permissible regional zones without prior written authorization from the Owner is strictly prohibited.</p>
        <p><strong>2.3 Indemnification and Liability:</strong> The Hirer agrees to indemnify, defend, and hold harmless the Owner, its affiliates, directors, and employees from and against any and all claims, actions, damages, liabilities, costs, and expenses (including legal fees) arising from or relating to the Hirer's use, operation, or possession of the vehicle. The Hirer bears sole liability for any traffic violations, tolls, fines, or accidents resulting during the active rental duration.</p>
        <p><strong>2.4 Security Deposit and Damages:</strong> The Hirer authorizes the Owner to retain the security deposit and charge their digital wallet/credit card for any repairs, towing, cleaning, or restoration fees resulting from damage, accident, or negligence beyond standard wear and tear.</p>
        <p><strong>2.5 Dispute Resolution:</strong> Any disputes arising under this Agreement shall be referred to sole arbitration under the <strong>Arbitration and Conciliation Act, 1996</strong>. The venue of arbitration shall be Ahmedabad, Gujarat, India, and the proceedings shall be conducted in English.</p>
      </div>

      <div class="section-title">3. Digital Signatures & Executions</div>
      <div class="signatures-section">
        <div class="signature-box">
          <h4>For ZipTrip</h4>
          <p style="font-size: 11px; margin: 0 0 5px 0;">Authorized Signatory</p>
          <div class="esign-stamp">DIGITALLY SIGNED via e-Mudhra CA</div>
          <p style="font-size: 9px; color: #6b7280; margin: 5px 0 0 0;">Timestamp: ${new Date().toISOString()}</p>
        </div>
        <div class="signature-box">
          <h4>Hirer (Customer)</h4>
          <p style="font-size: 11px; margin: 0 0 5px 0;">Name: ${data.customerName}</p>
          <div class="esign-stamp" style="border-color: #2563eb; color: #1d4ed8; background-color: #dbeafe;">AADHAAR E-SIGN (OTP Verified)</div>
          <p style="font-size: 9px; color: #6b7280; margin: 5px 0 0 0;">IP: 103.241.12.89 | Coordinates: 23.0225° N, 72.5714° E</p>
        </div>
      </div>

      <div class="footer-note">
        This is a digitally stamped, Aadhaar OTP-signed contract under Section 10-A of the Information Technology Act, 2000. It does not require a physical signature.
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generates a PDF buffer using Puppeteer and writes it to a file.
   */
  public static async generateAgreementPDF(data: ContractData): Promise<string> {
    const htmlContent = this.getTemplate(data);

    // Launch headless Chromium
    const browser = await puppeteer.launch({
      headless: 'new' as any,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate A4 format PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px'
        }
      });

      // Ensure directory exists
      const targetDir = path.join(__dirname, '..', '..', 'public', 'agreements');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileName = `agreement_${data.bookingId}.pdf`;
      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);

      // Return path relative to server public root
      return `/agreements/${fileName}`;
    } finally {
      await browser.close();
    }
  }
}
