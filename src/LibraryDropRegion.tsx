import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type DragEvent,
} from "react";
import { IconUpload } from "@tabler/icons-react";
type Props = {
  children: ReactNode;
  disabled: boolean;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
};
export function LibraryDropRegion({
  children,
  disabled,
  onDragOver,
  onDrop,
}: Props) {
  const [dragging, setDragging] = useState(false),
    depth = useRef(0);
  const reset = () => {
    depth.current = 0;
    setDragging(false);
  };
  useEffect(() => {
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, []);
  useEffect(() => {
    if (disabled) reset();
  }, [disabled]);
  function enter(e: DragEvent<HTMLElement>) {
    if (disabled || !Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    depth.current++;
    setDragging(true);
  }
  function leave() {
    depth.current = Math.max(0, depth.current - 1);
    if (!depth.current) setDragging(false);
  }
  return (
    <section
      className={
        "resources-panel panel library-drop-region" +
        (dragging ? " file-drag-active" : "")
      }
      onDragEnter={enter}
      onDragLeave={leave}
      onDragOver={onDragOver}
      onDrop={(e) => {
        reset();
        onDrop(e);
      }}
    >
      {children}
      {dragging && (
        <div className="library-drop-overlay" role="status">
          <div className="floating-drop-hint">
            <IconUpload size={28} />
            <strong>Drop media here</strong>
          </div>
        </div>
      )}
    </section>
  );
}
