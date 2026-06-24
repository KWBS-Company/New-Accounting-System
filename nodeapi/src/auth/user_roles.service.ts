import { InjectRepository } from '@nestjs/typeorm';
import { UserRole } from './entities/user_roles.entity';
import { Repository } from 'typeorm';

export class UserRolesService {
    constructor(
        @InjectRepository(UserRole)
        private readonly userRoleRepository: Repository<UserRole>,
    ) {}

    async create(data: Partial<UserRole>): Promise<UserRole> {
        const userRole = this.userRoleRepository.create(data);
        return this.userRoleRepository.save(userRole);
    }
}
