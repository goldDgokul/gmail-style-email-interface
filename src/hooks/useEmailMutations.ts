import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import { EMAIL_QK } from './useEmails';

const useMut = <T>(fn: (arg: T) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: EMAIL_QK }) });
};

export const useToggleStar      = () => useMut(emailService.toggleStar);
export const useToggleImportant = () => useMut(emailService.toggleImportant);
export const useArchive         = () => useMut(emailService.archive);
export const useMoveToTrash     = () => useMut(emailService.moveToTrash);
export const usePermanentDelete = () => useMut(emailService.permanentDelete);
export const useMoveToSpam      = () => useMut(emailService.moveToSpam);
export const useRestore         = () => useMut(emailService.restore);
export const useUnsnooze        = () => useMut(emailService.unsnooze);
export const useSendEmail       = () => useMut(emailService.send);
export const useMarkRead        = () => useMut(({ ids, unread }: { ids: string[]; unread: boolean }) => emailService.markRead(ids, unread));
export const useSnooze          = () => useMut(({ id, until }: { id: string; until: string }) => emailService.snooze(id, until));
export const useSaveDraft       = () => useMut(emailService.saveDraft);
