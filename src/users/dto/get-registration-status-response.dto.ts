import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '../entities/pending-registration.entity';

export class GetRegistrationStatusResponseDto {
  @ApiProperty({
    description: 'UUID identifier of the registration request',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
  })
  id: string;

  @ApiProperty({
    description: 'Login of the user being registered',
    example: 'johndoe'
  })
  login: string;

  @ApiProperty({
    description: 'Current status of the registration request',
    enum: RegistrationStatus,
    example: RegistrationStatus.PENDING
  })
  status: RegistrationStatus;

  @ApiProperty({
    description: 'Timestamp when the registration was created',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the registration was last updated',
    example: '2023-01-01T00:00:00.000Z'
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Optional approval comment if approved',
    example: 'Approved by admin',
    required: false
  })
  approvalComment?: string;

  @ApiProperty({
    description: 'Optional rejection reason if rejected',
    example: 'Invalid information provided',
    required: false
  })
  rejectedReason?: string;

  @ApiProperty({
    description: 'Timestamp when the registration was approved (if approved)',
    example: '2023-01-01T00:00:00.000Z',
    required: false
  })
  approvedAt?: Date;
}