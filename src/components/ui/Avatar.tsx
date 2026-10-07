const PASTELS = [
  'var(--c-av-1)', 'var(--c-av-2)', 'var(--c-av-3)', 'var(--c-av-4)',
  'var(--c-av-5)', 'var(--c-av-6)', 'var(--c-av-7)', 'var(--c-av-8)',
];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const Avatar = ({ name, large = false }: { name: string; large?: boolean }) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const bg = PASTELS[hash % PASTELS.length];

  return (
    <span
      className={large ? 'avatar avatar--lg' : 'avatar'}
      style={{ background: bg }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
};
