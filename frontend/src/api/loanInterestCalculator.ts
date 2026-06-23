import client from './client'
import type {
  ApiResponse,
  LoanInterestCalculatorPayload,
} from '@/types'

export const loanInterestCalculatorApi = {
  
  loanInterestCalculator: (payload: LoanInterestCalculatorPayload) =>
    client
      .post<ApiResponse<null>>('/interest', payload)
      .then((r) => r.data),
}
