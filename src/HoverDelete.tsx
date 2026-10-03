import { IconX } from "@tabler/icons-react";
export function HoverDelete({
  label,
  disabled,
  onDelete,
}: {
  label: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      className="segment-delete"
      title={label}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      <IconX size={13} />
    </button>
  );
}
