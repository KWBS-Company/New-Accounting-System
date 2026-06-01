import { InjectRepository } from "@nestjs/typeorm";
import { Customer } from "../entities/customer.entity";
import { Repository } from "typeorm";

export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async save(data: Partial<Customer>): Promise<Customer> {
    return this.customerRepository.save(data);
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
}