import { MoreHorizontal, MoreVertical } from "lucide-react";

/** Keep the desktop convention while giving narrow rows a vertical overflow. */
export default function OverflowIcon({ size = 22 }: { size?: number }) {
  return (
    <>
      <MoreHorizontal
        className="overflow-horizontal"
        size={size}
        aria-hidden="true"
      />
      <MoreVertical
        className="overflow-vertical"
        size={size}
        aria-hidden="true"
      />
    </>
  );
}
