import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 0. Clean up existing database tables to enable clean re-runs
  await prisma.booking.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.vehicleType.deleteMany({});
  await prisma.location.deleteMany({});

  console.log('Database tables cleared successfully');

  // 1. Seed Admin User
  const adminPasswordHash = await bcrypt.hash('AdminPassword123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ziptrip.com' },
    update: {},
    create: {
      email: 'admin@ziptrip.com',
      password_hash: adminPasswordHash,
      role: 'ADMIN',
      full_name: 'ZipTrip Admin',
      phone: '9876543210',
      kyc_status: 'VERIFIED'
    }
  });
  console.log(`Seeded admin user: ${admin.email}`);

  // 2. Seed Customer User
  const customerPasswordHash = await bcrypt.hash('CustomerPassword123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@ziptrip.com' },
    update: {},
    create: {
      email: 'customer@ziptrip.com',
      password_hash: customerPasswordHash,
      role: 'CUSTOMER',
      full_name: 'Amit Patel',
      phone: '9000011111',
      kyc_status: 'VERIFIED',
      aadhaar_number: '123456789012',
      pan_number: 'ABCDE1234F',
      dl_number: 'GJ0120220034567'
    }
  });
  console.log(`Seeded customer user: ${customer.email}`);

  // 3. Seed Vehicle Types
  const hatchback = await prisma.vehicleType.create({
    data: {
      category_name: 'Hatchback',
      base_price_per_hour: 100,
      base_price_per_day: 1200,
      seating_capacity: 5,
      transmission: 'Manual'
    }
  });

  const sedan = await prisma.vehicleType.create({
    data: {
      category_name: 'Sedan',
      base_price_per_hour: 180,
      base_price_per_day: 2200,
      seating_capacity: 5,
      transmission: 'Automatic'
    }
  });

  const suv = await prisma.vehicleType.create({
    data: {
      category_name: 'SUV',
      base_price_per_hour: 250,
      base_price_per_day: 3500,
      seating_capacity: 7,
      transmission: 'Automatic'
    }
  });

  console.log('Seeded vehicle types (Hatchback, Sedan, SUV)');

  // 4. Seed Operational Locations (Ahmedabad Hubs)
  const sgHighwayHub = await prisma.location.create({
    data: {
      hub_name: 'SG Highway Hub',
      address: 'Near Iscon Cross Road, SG Highway, Ahmedabad, Gujarat 380015',
      latitude: 23.0296,
      longitude: 72.5074,
      capacity: 50
    }
  });

  const airportHub = await prisma.location.create({
    data: {
      hub_name: 'AMD Airport Arrivals Hub',
      address: 'Sardar Vallabhbhai Patel International Airport, Hansol, Ahmedabad, Gujarat 382475',
      latitude: 23.0734,
      longitude: 72.6275,
      capacity: 100
    }
  });

  const prahladNagarHub = await prisma.location.create({
    data: {
      hub_name: 'Prahlad Nagar Zone',
      address: 'Prahlad Nagar Corporate Road, Vejalpur, Ahmedabad, Gujarat 380015',
      latitude: 23.0125,
      longitude: 72.5098,
      capacity: 40
    }
  });

  const navrangpuraHub = await prisma.location.create({
    data: {
      hub_name: 'Navrangpura Hub',
      address: 'Ellis Bridge Parking Area, Navrangpura, Ahmedabad, Gujarat 380009',
      latitude: 23.0225,
      longitude: 72.5714,
      capacity: 60
    }
  });

  console.log('Seeded operational locations');

  // 5. Seed Vehicles (using real high quality Unsplash photos matching the specific models)
  
  // Hatchbacks & Compacts
  await prisma.vehicle.create({
    data: {
      type_id: hatchback.id,
      location_id: sgHighwayHub.id,
      license_plate: 'GJ-01-HA-1234',
      make: 'Maruti Suzuki',
      model: 'Swift',
      year: 2022,
      features: JSON.stringify(['Android Auto', 'Air Conditioning', 'Dual Airbags', 'Parking Sensors']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 100
    }
  });

  await prisma.vehicle.create({
    data: {
      type_id: hatchback.id,
      location_id: navrangpuraHub.id,
      license_plate: 'GJ-01-HA-5678',
      make: 'Hyundai',
      model: 'i20',
      year: 2023,
      features: JSON.stringify(['Sunroof', 'Touchscreen Infotainment', 'Reverse Camera', 'ABS']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 110
    }
  });

  // Nexon 2023 (Seeded as Hatchback/Compact)
  await prisma.vehicle.create({
    data: {
      type_id: hatchback.id,
      location_id: sgHighwayHub.id,
      license_plate: 'GJ-01-NX-2023',
      make: 'Tata',
      model: 'Nexon',
      year: 2023,
      features: JSON.stringify(['Sunroof', 'Touchscreen Media', 'Keyless Lock', 'Airbags']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  // Punch 2025 (Seeded as Hatchback/Compact)
  await prisma.vehicle.create({
    data: {
      type_id: hatchback.id,
      location_id: navrangpuraHub.id,
      license_plate: 'GJ-01-TP-2025',
      make: 'Tata',
      model: 'Punch',
      year: 2025,
      features: JSON.stringify(['Reverse Sensors', 'Bluetooth Play', 'ABS System', 'Air Conditioning']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 100
    }
  });

  // Sedans
  await prisma.vehicle.create({
    data: {
      type_id: sedan.id,
      location_id: sgHighwayHub.id,
      license_plate: 'GJ-01-SE-2468',
      make: 'Honda',
      model: 'City',
      year: 2022,
      features: JSON.stringify(['Leather Seats', 'Cruise Control', 'Push Button Start', 'Automatic Climate Control']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  await prisma.vehicle.create({
    data: {
      type_id: sedan.id,
      location_id: airportHub.id,
      license_plate: 'GJ-01-SE-1357',
      make: 'Hyundai',
      model: 'Verna',
      year: 2023,
      features: JSON.stringify(['Ventilated Seats', 'Sunroof', 'Wireless Charger', 'ADAS Assistance']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  // SUVs
  await prisma.vehicle.create({
    data: {
      type_id: suv.id,
      location_id: airportHub.id,
      license_plate: 'GJ-01-SU-9999',
      make: 'Mahindra',
      model: 'XUV700',
      year: 2023,
      features: JSON.stringify(['Panoramic Sunroof', 'Dual Zone AC', 'ADAS Level 2', '360 Camera', 'Leatherette Upholstery']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  await prisma.vehicle.create({
    data: {
      type_id: suv.id,
      location_id: prahladNagarHub.id,
      license_plate: 'GJ-01-SU-8888',
      make: 'Tata',
      model: 'Harrier',
      year: 2022,
      features: JSON.stringify(['JBL Sound System', 'Terrain Modes', 'Ventilated Seats', 'Wireless CarPlay']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  // Grand Vitara 2025
  await prisma.vehicle.create({
    data: {
      type_id: suv.id,
      location_id: airportHub.id,
      license_plate: 'GJ-01-GV-2025',
      make: 'Maruti Suzuki',
      model: 'Grand Vitara',
      year: 2025,
      features: JSON.stringify(['Smart Hybrid', 'Panoramic Roof', 'Cruise Control', 'Drive Modes']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  // KIA Seltos 2020
  await prisma.vehicle.create({
    data: {
      type_id: suv.id,
      location_id: airportHub.id,
      license_plate: 'GJ-01-KS-2020',
      make: 'KIA',
      model: 'Seltos',
      year: 2020,
      features: JSON.stringify(['Ventilated Seats', 'HUD Display', 'Bose Sound', 'Air Purifier']),
      images: JSON.stringify(['https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=600']),
      status: 'AVAILABLE',
      speed_limit: 120
    }
  });

  console.log('Seeded vehicles successfully');
  console.log('Database seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
