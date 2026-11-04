const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const WEB_ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SAMPLE_VEHICLES = [
  { id: 'preview-creta', make: 'Hyundai', model: 'Creta', year: 2024, category: 'SUV', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, pricePerDay: 3200, locationCity: 'Ahmedabad', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-swift', make: 'Maruti Suzuki', model: 'Swift', year: 2023, category: 'Hatchback', transmission: 'Manual', fuelType: 'Petrol', seats: 5, pricePerDay: 1800, locationCity: 'Vadodara', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-thar', make: 'Mahindra', model: 'Thar 4x4', year: 2024, category: 'SUV', transmission: 'Manual', fuelType: 'Diesel', seats: 4, pricePerDay: 4500, locationCity: 'Ahmedabad', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-innova', make: 'Toyota', model: 'Innova Crysta', year: 2023, category: 'MUV', transmission: 'Manual', fuelType: 'Diesel', seats: 7, pricePerDay: 3800, locationCity: 'Surat', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-city', make: 'Honda', model: 'City', year: 2023, category: 'Sedan', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, pricePerDay: 2600, locationCity: 'Ahmedabad', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-fortuner', make: 'Toyota', model: 'Fortuner', year: 2024, category: 'SUV', transmission: 'Automatic', fuelType: 'Diesel', seats: 7, pricePerDay: 7500, locationCity: 'Gandhinagar', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-dzire', make: 'Maruti Suzuki', model: 'Dzire', year: 2023, category: 'Sedan', transmission: 'Manual', fuelType: 'CNG', seats: 5, pricePerDay: 1700, locationCity: 'Rajkot', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-i20', make: 'Hyundai', model: 'i20', year: 2023, category: 'Hatchback', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, pricePerDay: 2000, locationCity: 'Surat', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
  { id: 'preview-mercedes', make: 'Mercedes-Benz', model: 'C-Class', year: 2023, category: 'Luxury', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, pricePerDay: 8500, locationCity: 'Ahmedabad', status: 'ACTIVE', includedKilometresPerDay: 300, extraKmCharge: 12 },
];

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname || '/');

  // API Fallback handler so the frontend never shows 404 errors when backend is offline
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    if (pathname === '/api/vehicles' || pathname === '/api/vehicles/') {
      res.writeHead(200);
      res.end(JSON.stringify(SAMPLE_VEHICLES));
      return;
    }

    if (pathname.startsWith('/api/vehicles/')) {
      const parts = pathname.replace('/api/vehicles/', '').split('/');
      const vehicleId = decodeURIComponent(parts[0]);

      if (parts[1] === 'quote') {
        const found = SAMPLE_VEHICLES.find(v => v.id === vehicleId) || SAMPLE_VEHICLES[0];
        const days = 1;
        const rental = days * found.pricePerDay;
        const deposit = 5000;
        res.writeHead(200);
        res.end(JSON.stringify({
          rentalDays: days,
          rentalAmount: rental,
          includedKilometres: days * 300,
          securityDeposit: deposit,
          totalAmount: rental + deposit
        }));
        return;
      }

      const vehicle = SAMPLE_VEHICLES.find(v => v.id === vehicleId) || SAMPLE_VEHICLES[0];
      res.writeHead(200);
      res.end(JSON.stringify(vehicle));
      return;
    }

    if (pathname === '/api/auth/profile') {
      res.writeHead(401);
      res.end(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    if (pathname === '/api/contact') {
      res.writeHead(200);
      res.end(JSON.stringify({ phone: '+91 98765 43210', email: 'support@safarselfdrive.com', address: 'Ahmedabad, Gujarat, India' }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Not found' }));
    return;
  }

  // Normalize static file path
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  let filePath = path.join(WEB_ROOT, pathname);

  // If file doesn't exist, check if appending .html works (clean URLs)
  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  }

  // Prevent directory traversal
  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fall back to index.html for unknown routes
      const fallbackPath = path.join(WEB_ROOT, 'index.html');
      if (fs.existsSync(fallbackPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        fs.createReadStream(fallbackPath).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ZipTrip / Safar Portal server running at http://localhost:${PORT}`);
});
