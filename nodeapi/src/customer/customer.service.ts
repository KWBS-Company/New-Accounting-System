import { InjectRepository } from "@nestjs/typeorm";
import { Customer } from "./entities/customer.entity";
import { DataSource, IsNull, Repository } from "typeorm";
import { PaginatedResponse } from "src/common/dto/pagination.dto";
import { ListCustomerQuery, UpdateCustomerDto } from "./dto/customers.dto";
import { ForbiddenException, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "src/auth/entities/user.entity";
import { RoleType } from "src/auth/entities/user_roles.entity";
import { CustomerFiscalYear } from "./entities/company.fiscal.entity";
import { FiscalYearStatus } from "./types/fiscal_years.status.types";
import { CommonService } from "src/common/utils/common";

export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly commonService: CommonService
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

    qb.andWhere(`customer.deletedAt IS NULL AND customer.companyName <> 'MASTER'`);
    qb.orderBy('customer.updatedAt', 'DESC', 'NULLS LAST');

    if (searchQuery) {
      qb.andWhere('( customer.companyName ILIKE :search OR customer.companyEmail ILIKE :search OR customer.companyPhone ILIKE :search OR customer.companyAddress ILIKE :search )', { search: `%${searchQuery}%` })
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponse(data, total, page, pageSize);
  }


  async updateCustomer(updateCustomerDto: UpdateCustomerDto, id: string, user: User) {
    const roleType = user.userRoles[0].roleType;
    const customerId = user.userRoles[0].customerId;
    if (roleType !== RoleType.SUPER_ADMIN && customerId !== id) {
      throw new ForbiddenException('Cannot perform action due to lack of privilages')
    }
    const { companyName, companyAddress, companyPhone, companyEmail, companyWebsite, description, panNumber, vatNumber, transactionCurrencyCode } = updateCustomerDto;

    const customer = await this.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Customer, id, { companyAddress, companyName, companyPhone, companyWebsite, companyEmail, description, panNumber, vatNumber, transactionCurrencyCode });
      const fiscalYrRecords = await manager.findBy(CustomerFiscalYear, { deletedAt: IsNull(), status: FiscalYearStatus.OPEN, customerId: id });
      const { name, startDate, endDate } = this.commonService.getFiscalYearDates(customer.fiscalStartDate);
      if (fiscalYrRecords.length === 0) {
        this.logger.debug('Adding fiscal yr record');
        const fy = manager.create(CustomerFiscalYear, { name, startDate, endDate, status: FiscalYearStatus.OPEN, customerId: id });
        await manager.save(CustomerFiscalYear, fy);
      }
    })

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
    user: User
  ) {

    const roleType = user.userRoles[0].roleType;
    const customerId = user.userRoles[0].customerId;
    if (roleType !== RoleType.SUPER_ADMIN && customerId !== id) {
      throw new ForbiddenException('Cannot perform action due to lack of privilages')
    }

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