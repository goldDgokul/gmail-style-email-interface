import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import { EMAIL_QK } from './useEmails';

// One route for every Delete button (guardrail #15 / Q9 / Q14) — the
// TRASH|SPAM|DRAFT partition lives in emailService.deleteRoute (§0.3).
export const useDeleteRoute = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: emailService.deleteRoute,
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAIL_QK }),
  });
};
