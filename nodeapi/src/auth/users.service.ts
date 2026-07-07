import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
    InviteUserDto,
    ListUserQuery,
    ProfileCustomerUserDto,
} from './dto/user.dto';
import { PaginatedResponse } from 'src/common/dto/pagination.dto';
import { RoleType, UserRole } from './entities/user_roles.entity';
import { QueueService } from 'src/queue/queue.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CommonService } from 'src/common/utils/common';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly dataSource: DataSource,
        private readonly queueService: QueueService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly commonService: CommonService,
    ) { }

    async create(data: Partial<User>): Promise<User> {
        const user = this.userRepository.create(data);
        return this.userRepository.save(user);
    }

    async findById(id: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id },
            relations: [
                'userRoles',
                'userRoles.customer',
                'userRoles.customer.fiscalYears',
            ],
        });
    }

    /**
     * @param includePassword - Pass true to include the password column (for login verification)
     */
    async findByEmail(
        email: string,
        includePassword = false,
    ): Promise<User | null> {
        const qb = this.userRepository.createQueryBuilder('user');
        qb.leftJoinAndSelect('user.userRoles', 'role');
        qb.leftJoinAndSelect('role.customer', 'customer');
        qb.leftJoinAndSelect('customer.fiscalYears', 'fy');
        qb.where('user.email = :email', { email });
        qb.andWhere(
            'user.deletedAt IS NULL AND role.deletedAt IS NULL AND customer.deletedAt IS NULL AND fy.deletedAt IS NULL',
        );

        if (includePassword) {
            qb.addSelect('user.password');
        }
        return qb.getOne();
    }

    async findOrFail(id: string): Promise<User> {
        const user = await this.findById(id);
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async update(id: string, data: Partial<User>): Promise<User> {
        await this.userRepository.update(id, data);
        return this.findOrFail(id);
    }

    async findAll(): Promise<User[]> {
        return this.userRepository.find();
    }

    async listUsers(user: User, query: ListUserQuery) {
        const roleType = user.userRoles[0].roleType;
        const customerId = user.userRoles[0].customerId;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const searchQuery = query.search;
        const qb = this.userRepository.createQueryBuilder('user');
        qb.leftJoinAndSelect('user.userRoles', 'role');
        qb.leftJoinAndSelect('role.customer', 'customer');
        if (roleType === RoleType.SUPER_ADMIN) {
            qb.where('1 = 1 AND role.roleType <> :role ', {
                role: RoleType.SUPER_ADMIN,
            });
        } else {
            qb.where('customer.id = :customerId AND role.roleType <> :role ', {
                customerId: customerId,
                role: RoleType.CUSTOMER_ADMIN,
            });
        }
        qb.andWhere(
            'user.deletedAt IS NULL AND role.deletedAt IS NULL AND customer.deletedAt IS NULL',
        );
        qb.orderBy('user.updatedAt', 'DESC', 'NULLS LAST');

        if (searchQuery) {
            qb.andWhere(
                '( user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search )',
                { search: `%${searchQuery}%` },
            );
        }

        qb.skip((page - 1) * pageSize).take(pageSize);

        const [data, total] = await qb.getManyAndCount();
        return new PaginatedResponse(data, total, page, pageSize);
    }

    async inviteUser(user: User, inviteUserDto: InviteUserDto) {
        const currentCustomerId = user.userRoles[0].customerId;
        const { email, firstName } = inviteUserDto;

        const existing = await this.findByEmail(email);

        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const result = await this.dataSource.transaction(async (manager) => {
            const user = manager.create(User, {
                email: email,
                isActive: false,
                isEmailVerified: false,
                firstName: firstName,
                lastName: '',
                password: '',
            });

            const retUser = await manager.save(User, user);

            const userRole = manager.create(UserRole, {
                userId: retUser.id,
                customerId: currentCustomerId,
                roleType: RoleType.CUSTOMER_USER,
            });

            await manager.save(UserRole, userRole);

            const url = await this.getInvitationUrl(retUser);

            return { user: retUser, url };
        });

        // Usually keep external operations outside transaction
        await this.queueService.addEmailToQueue(
            result.user.email,
            'invite-user',
            { firstName: result.user.firstName, invitationUrl: result.url },
        );

        return { message: 'User has been invited.' };
    }

    private async getInvitationUrl(user: User) {
        const secret = this.configService.getOrThrow<string>(
            'jwt.verificationSecret',
        );
        const expiresIn = this.configService.getOrThrow<number>(
            'jwt.verificationExpiresIn',
        );
        const token = this.jwtService.sign(
            { sub: user.id, email: user.email },
            {
                secret: secret,
                expiresIn: expiresIn,
            },
        );

        const frontendUrl =
            this.configService.getOrThrow<string>('app.frontendUrl');
        const verificationUrl = `${frontendUrl}/invite-user?token=${token}`;
        return verificationUrl;
    }

    async deleteUser(id: string) {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        await this.dataSource.transaction(async (manager) => {
            user.deletedAt = new Date();
            await manager.save(User, user);
            user.userRoles[0].deletedAt = new Date();
            await manager.save(UserRole, user.userRoles[0]);
        });

        return { message: 'User has been deleted.' };
    }

    async activateUser(id: string) {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        await this.update(id, { isActive: true });

        return { message: 'User is activated.' };
    }

    async deactivateUser(id: string) {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        await this.update(id, { isActive: false });

        return { message: 'User is deactivated.' };
    }

    async updateProfileForCustomerUser(
        profileCustomerUserDto: ProfileCustomerUserDto,
    ) {
        const { token, password, firstName, lastName, phone } =
            profileCustomerUserDto;
        let payload: { sub: string; email: string };
        try {
            payload = this.jwtService.verify(token, {
                secret: this.configService.getOrThrow<string>(
                    'jwt.verificationSecret',
                ),
            });
        } catch {
            throw new BadRequestException(
                'Invalid or expired invitation url token',
            );
        }

        const user = await this.findById(payload.sub);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        const hashedPassword = await this.commonService.hash(
            password,
            user.salt,
        );
        await this.update(user.id, {
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            isEmailVerified: true,
            isActive: true,
        });
        return { message: 'Profile has been created.' };
    }

    async findUserByCustomerId(customerId: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: {
                deletedAt: IsNull(),
                userRoles: {
                    deletedAt: IsNull(),
                    customerId: customerId,
                    customer: {
                        deletedAt: IsNull(),
                        id: customerId
                    }
                }
            },
            relations: [
                'userRoles',
                'userRoles.customer',
                'userRoles.customer.fiscalYears',
            ],
        });
    }
}
