// import * as dotenv from 'dotenv';
// import * as bcrypt from 'bcryptjs';
// import dataSource from '../../config/data-source';
// import { User, UserRole } from '../../users/entities/user.entity';
// import {
//   Service,
//   ServiceCategory,
// } from '../../services/entities/service.entity';
// import {
//   NotificationTemplate,
//   TemplateType,
// } from '../../notifications/entities/notification-template.entity';

// dotenv.config();

// async function seedTemplates() {
//   const repo = dataSource.getRepository(NotificationTemplate);

//   const templates: Partial<NotificationTemplate>[] = [
//     {
//       name: 'Standard Confirmation',
//       type: TemplateType.CONFIRMATION,
//       subject: 'Your appointment is confirmed, {{customerName}}',
//       body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
//         <h2 style="color:#6b21a8">Appointment Confirmed</h2>
//         <p>Hi {{customerName}},</p>
//         <p>Your <strong>{{serviceName}}</strong> appointment is confirmed.</p>
//         <ul>
//           <li><strong>When:</strong> {{startTime}} - {{endTime}}</li>
//           <li><strong>Duration:</strong> {{durationMinutes}} minutes</li>
//           <li><strong>Price:</strong> $ {{price}}</li>
//         </ul>
//         <p>See you soon!</p>
//       </div>`,
//       description: 'Default confirmation with appointment details',
//     },
//     {
//       name: 'Friendly Confirmation',
//       type: TemplateType.CONFIRMATION,
//       subject: 'Can’t wait to see you, {{customerName}}!',
//       body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
//         <h2 style="color:#c026d3">You’re all set, {{customerName}}</h2>
//         <p>We’ve booked your {{serviceName}} for <strong>{{startTime}}</strong>.</p>
//         <p>Relax — we’ll take it from here.</p>
//       </div>`,
//       description: 'Warm & casual tone',
//     },
//     {
//       name: 'Reminder',
//       type: TemplateType.REMINDER,
//       subject: 'Reminder: {{serviceName}} on {{startTime}}',
//       body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
//         <h2>Quick reminder</h2>
//         <p>Hi {{customerName}}, this is a reminder of your upcoming {{serviceName}} on {{startTime}}.</p>
//       </div>`,
//       description: 'Sent 24h before the appointment',
//     },
//     {
//       name: 'Cancellation',
//       type: TemplateType.CANCELLATION,
//       subject: 'Your appointment was cancelled',
//       body: `<p>Hi {{customerName}}, your {{serviceName}} on {{startTime}} has been cancelled.</p>`,
//       description: 'Cancellation notice',
//     },
//   ];

//   for (const t of templates) {
//     const existing = await repo.findOne({ where: { name: t.name! } });
//     if (!existing) {
//       await repo.save(repo.create(t));
//       console.log(`  ✓ Template seeded: ${t.name}`);
//     } else {
//       console.log(`  - Template exists: ${t.name}`);
//     }
//   }
// }

// async function seedServices() {
//   const repo = dataSource.getRepository(Service);

//   const services: Partial<Service>[] = [
//     {
//       name: "Men's Haircut",
//       description: 'Classic cut with wash and style',
//       category: ServiceCategory.HAIR,
//       durationMinutes: 30,
//       price: 25.0,
//     },
//     {
//       name: "Women's Haircut",
//       description: 'Cut, wash, and blow-dry',
//       category: ServiceCategory.HAIR,
//       durationMinutes: 60,
//       price: 55.0,
//     },
//     {
//       name: 'Manicure',
//       description: 'Nail shaping, cuticle care, and polish',
//       category: ServiceCategory.NAILS,
//       durationMinutes: 45,
//       price: 30.0,
//     },
//     {
//       name: 'Pedicure',
//       description: 'Foot soak, exfoliation, and polish',
//       category: ServiceCategory.NAILS,
//       durationMinutes: 60,
//       price: 45.0,
//     },
//     {
//       name: 'Swedish Massage',
//       description: 'Relaxing full-body massage',
//       category: ServiceCategory.MASSAGE,
//       durationMinutes: 60,
//       price: 80.0,
//     },
//     {
//       name: 'Deep Tissue Massage',
//       description: 'Targeted massage for muscle tension',
//       category: ServiceCategory.MASSAGE,
//       durationMinutes: 90,
//       price: 110.0,
//     },
//     {
//       name: 'Facial',
//       description: 'Cleansing, exfoliating, and moisturizing',
//       category: ServiceCategory.FACIAL,
//       durationMinutes: 60,
//       price: 70.0,
//     },
//     {
//       name: 'Spa Day Package',
//       description: 'Massage + facial + manicure',
//       category: ServiceCategory.SPA,
//       durationMinutes: 180,
//       price: 200.0,
//     },
//   ];

//   for (const s of services) {
//     const existing = await repo.findOne({ where: { name: s.name! } });
//     if (!existing) {
//       await repo.save(repo.create(s));
//       console.log(`  ✓ Service seeded: ${s.name}`);
//     } else {
//       console.log(`  - Service exists: ${s.name}`);
//     }
//   }
// }

// async function seedAdmin() {
//   const repo = dataSource.getRepository(User);
//   const adminEmail = 'admin@salon.local';
//   const existing = await repo.findOne({ where: { email: adminEmail } });

//   if (existing) {
//     console.log(`  - Admin exists: ${adminEmail}`);
//     return;
//   }

//   const password = await bcrypt.hash('Admin@123', 12);
//   await repo.save(
//     repo.create({
//       email: adminEmail,
//       firstName: 'Salon',
//       lastName: 'Admin',
//       password,
//       role: UserRole.ADMIN,
//       isEmailVerified: true,
//       isActive: true,
//     }),
//   );
//   console.log(`  ✓ Admin seeded: ${adminEmail} / Admin@123`);
// }

// async function run() {
//   console.log('🌱 Seeding database...');
//   await dataSource.initialize();
//   console.log('\nTemplates:');
//   await seedTemplates();
//   console.log('\nServices:');
//   await seedServices();
//   console.log('\nAdmin user:');
//   await seedAdmin();
//   await dataSource.destroy();
//   console.log('\n✅ Seeding complete.');
// }

// run().catch((err) => {
//   console.error('❌ Seed failed:', err);
//   process.exit(1);
// });
