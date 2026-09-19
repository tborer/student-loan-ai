/**
 * Student Loan Repayment Analyzer — Edge Case Handling Components
 * 
 * Implements Tasks 1.17, 1.18: Private-only loan user flow & FFEL/Perkins past deadline handling
 */

export { PrivateOnlyUserFlow } from './PrivateOnlyUserFlow';
export { FFELPerkinsDeadlineMessage } from './FFELPerkinsDeadlineMessage';

// Types
export interface EdgeCaseProps {
  hasFFELPerkins?: boolean;
  currentYear: number; // For deadline comparison (June 30, 2026 per spec)
}