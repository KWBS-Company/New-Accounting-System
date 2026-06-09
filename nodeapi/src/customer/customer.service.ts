import { InjectRepository } from "@nestjs/typeorm";
import { Customer } from "./entities/customer.entity";
import { Repository } from "typeorm";
import { PaginatedResponse } from "src/common/dto/pagination.dto";
import { ListCustomerQuery, UpdateCustomerDto } from "./dto/customers.dto";
import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "src/auth/entities/user.entity";

export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly configService: ConfigService
  ) { }

  async save(data: Partial<Customer>): Promise<Customer> {
    return this.customerRepository.save(data);
  }
  async update(id: string, data: Partial<Customer>) {
    await this.customerRepository.update(id, data);
  }
  async create(data: Partial<Customer>): Promise<Customer> {
    const customer = this.customerRepository.create(data);
    return this.customerRepository.save(customer);
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customerRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find();
  }

  async listCustomers(
    query: ListCustomerQuery,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const searchQuery = query.search;
    const qb = this.customerRepository.createQueryBuilder('customer');

    qb.andWhere('customer.deletedAt IS NULL');
    qb.orderBy('customer.updatedAt', 'DESC', 'NULLS LAST');

    if (searchQuery) {
      qb.andWhere('( user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search )', { search: `%${searchQuery}%` })
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponse(data, total, page, pageSize);
  }


  async updateCustomer(updateCustomerDto: UpdateCustomerDto, id: string) {
    const { companyName, companyAddress, companyPhone, companyEmail, companyWebsite } = updateCustomerDto;

    const customer = await this.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.update(id, { companyAddress, companyName, companyPhone, companyWebsite, companyEmail });

    return { message: 'Customer has been updated.' }
  }

  async updateOwnDetail(updateCustomerDto: UpdateCustomerDto, user: User) {
    const { companyName, companyAddress, companyPhone, companyEmail, companyWebsite } = updateCustomerDto;

    const customerId = user.userRoles[0].customerId;

    const customer = await this.findById(customerId);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.update(customerId, { companyAddress, companyName, companyPhone, companyWebsite, companyEmail });

    return { message: 'Customer has been updated.' }
  }

  async getCustomer(id: string) {

    const customer = await this.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async uploadCompanyLogo(
    file: Express.Multer.File,
    id: string,
  ) {
    const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');
    const customer = await this.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    await this.update(id, { companyLogo: `/uploads/logo/${file.filename}` })
    return {
      message: `Company logo uploaded successfully`,
      avatarUrl: `${backendUrl}/uploads/logo/${file.filename}`,
    };
  }
}