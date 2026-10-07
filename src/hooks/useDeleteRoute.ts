import { useQueryClient, useMutation } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import { EMAIL_QK } from './useEmails';
import type { Email } from '../types/email';

// One route for every Delete button (guardrail #15 / Q9 / Q14):
// TRASH | SPAM | DRAFT → permanentDelete, everything else → moveToTrash.
export const useDeleteRoute = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const emails = qc.getQueryData<Email[]>(EMAIL_QK) ?? [];
      const byId = new Map(emails.map(e => [e.id, e]));
      const permanent = ids.filter(id => {
        const c = byId.get(id)?.container;
        return c === 'TRASH' || c === 'SPAM' || c === 'DRAFT';
      });
      const soft = ids.filter(id => !permanent.includes(id));
      if (permanent.length) await emailService.permanentDelete(permanent);
      if (soft.length) await emailService.moveToTrash(soft);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAIL_QK }),
  });
};
