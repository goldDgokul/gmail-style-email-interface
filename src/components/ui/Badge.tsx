export const Badge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="badge" aria-label={`${count} unread`}>
      {count > 99 ? '99+' : count}
    </span>
  ) : null;
