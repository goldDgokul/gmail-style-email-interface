import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;       // aria-label is required — icon-only controls need a name
  small?: boolean;
  danger?: boolean;
  children: ReactNode;
};

export const IconButton = ({ label, small, danger, className = '', children, ...rest }: Props) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={[
      'icon-btn',
      small ? 'icon-btn--sm' : '',
      danger ? 'icon-btn--danger' : '',
      className,
    ].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </button>
);
