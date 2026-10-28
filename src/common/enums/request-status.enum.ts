// request-status.enum.ts
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  // заявка без решения дольше срока — закрывает ежесуточная задача
  EXPIRED = 'EXPIRED',
}
