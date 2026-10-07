import { useEffect } from 'react';

export const Toast = ({ message, onDismiss }: { message: string | null; onDismiss: () => void }) => {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
};
