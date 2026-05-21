import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * @param includePassword - Pass true to include the password column (for login verification)
   */
  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const qb = this.userRepository.createQueryBuilder('user');
    qb.where('user.email = :email', { email });
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
}
