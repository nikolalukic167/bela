import { useEffect, useRef, type ReactNode } from 'react';

/** daisyUI modal, always open while rendered. */
export function Modal({ title, children }: { title: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  // Keyboard users land inside the dialog (unless a button in it took focus already) and go
  // back where they were when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (!box.current?.contains(document.activeElement)) box.current?.focus();
    return () => {
      if (before && before !== document.body && document.contains(before)) before.focus();
    };
  }, []);
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box outline-none" ref={box} tabIndex={-1}>
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="modal-action">{children}</div>;
}
