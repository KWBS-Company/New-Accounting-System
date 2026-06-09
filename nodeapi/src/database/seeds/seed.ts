import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import dataSource from '../../config/data-source';
import { RoleType, UserRole } from 'src/auth/entities/user_roles.entity';
import { User } from 'src/auth/entities/user.entity';
import { Customer } from 'src/customer/entities/customer.entity';


dotenv.config();

/* ---------------- SUPER ADMIN SEED ---------------- */
async function seedSuperAdmin() {
    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(UserRole);
    const customerRepo = dataSource.getRepository(Customer);
    const adminEmail = 'admin@admin.com';

    // 1. Check if user already exists
    const existingUser = await userRepo.findOne({
        where: { email: adminEmail },
        relations: ['userRoles'],
    });

    if (existingUser) {
        console.log(`  - Super admin already exists: ${adminEmail}`);
        return;
    }

    // 2. Create user
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    const user = userRepo.create({
        email: adminEmail,
        firstName: 'System',
        lastName: 'Super Admin',
        password: hashedPassword,
        isEmailVerified: true,
        isActive: true,
    });

    const savedUser = await userRepo.save(user);

    const systemCustomer = await customerRepo.findOne({
        where: { companyName: 'MASTER' },
    });

    let systemCustomerId: string;
    if (systemCustomer) {
        console.log(`Master company is already there`);
        systemCustomerId = systemCustomer.id;
    } else {
        const created = await customerRepo.save(
            customerRepo.create({
                companyName: 'MASTER',
                companyEmail: 'admin@admin.com',
                companyAddress: '',
                companyPhone: '',
            }),
        );

        systemCustomerId = created.id;
    }

    // 3. Create SUPER_ADMIN role (GLOBAL ROLE → no customer)
    const existingRole = await roleRepo.findOne({
        where: {
            userId: savedUser.id,
            roleType: RoleType.SUPER_ADMIN,
        },
    });

    if (!existingRole) {
        const role = roleRepo.create({
            userId: savedUser.id,
            roleType: RoleType.SUPER_ADMIN,
            customerId: systemCustomerId,
        });

        await roleRepo.save(role);
    }

    console.log(`  ✓ Super admin seeded: ${adminEmail} / Admin@123`);
}

/* ---------------- RUN ---------------- */
async function run() {
    console.log('🌱 Seeding database...');

    await dataSource.initialize();

    console.log('\nSuper Admin:');
    await seedSuperAdmin();

    await dataSource.destroy();

    console.log('\n✅ Seeding complete.');
}

run().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});