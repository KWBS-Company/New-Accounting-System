import { BaseEntity } from "src/common/entities/base.entity";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { User } from "./user.entity";
import { Customer } from "src/customer/entities/customer.entity";

export enum RoleType {
  SUPER_ADMIN = 'super_admin',
  CUSTOMER_ADMIN = 'customer_admin',
  CUSTOMER_USER = 'customer_user',
}

@Entity('user_roles')
export class UserRole extends BaseEntity {
  @Column({
    type: 'enum',
    enum: RoleType,
    default: RoleType.CUSTOMER_ADMIN,
  })
  roleType: RoleType;


  @Column({
    type: 'uuid',
    name: 'user_id',
    nullable: false,
  })
  userId: string;

  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: "CASCADE" })
  @JoinColumn({ name: 'user_id' })
  user: User;


  @Column({
    type: 'uuid',
    name: 'customer_id',
    nullable: false,
  })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.userRoles, { onDelete: "CASCADE" })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}