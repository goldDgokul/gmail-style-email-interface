export const LabelChip = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    className="chip"
    onClick={e => {
      e.stopPropagation();   // never let a chip open the email underneath it
      onClick();
    }}
  >
    {label}
  </button>
);
